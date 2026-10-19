import http from 'http';
import { Server } from 'socket.io';

import { config } from '../config/config';
import Logging from '../library/Logging';
import { VerifySocketToken } from '../middleware/SocketAuth';
import Message from '../models/Message';
import type { ChatJoinPayload, ChatMessage, ChatMessagePayload, ChatServer, ChatStatusPayload, ChatUserStatus, OnlineUser } from '../models/Message';

const HISTORY_LIMIT = 50;
const MAX_TEXT_LENGTH = 2000;

const onlineUsers = new Map<string, number>();
const userStatuses = new Map<string, ChatUserStatus>();

const isChatUserStatus = (status: unknown): status is ChatUserStatus => {
    return status === 'online' || status === 'busy' || status === 'invisible';
};

const emitOnlineUsers = (io: ChatServer) => {
    const users: OnlineUser[] = [...onlineUsers.keys()]
        .filter((userId) => (userStatuses.get(userId) ?? 'online') !== 'invisible')
        .map((userId) => ({
            id: userId,
            status: userStatuses.get(userId) ?? 'online'
        }));

    io.emit('users:online', users);
};

export const canJoinRoom = (room: string, userId: string): boolean => {
    if (room === 'general') {
        return true;
    }

    if (room.startsWith('group:')) {
        return room.length > 'group:'.length && room.length <= 100;
    }

    if (room.startsWith('direct:')) {
        const ids = room.slice('direct:'.length).split(':');

        return ids.length === 2 && ids[0] < ids[1] && ids.includes(userId);
    }

    return false;
};

export const StartChat = (server: http.Server) => {
    const io: ChatServer = new Server(server, {
        cors: {
            origin: config.cors.origin,
            methods: ['GET', 'POST'],
            credentials: true
        }
    });

    io.use(VerifySocketToken);

    io.on('connection', (socket) => {
        const userId = socket.data.user.id;
        Logging.info(`Socket connected for user ${userId}`);

        onlineUsers.set(userId, (onlineUsers.get(userId) ?? 0) + 1);
        userStatuses.set(userId, userStatuses.get(userId) ?? 'online');
        emitOnlineUsers(io);

        socket.on('chat:status', (payload: ChatStatusPayload) => {
            if (!payload || !isChatUserStatus(payload.status)) {
                socket.emit('chat:error', { message: 'El estado indicado no es válido.' });
                return;
            }

            userStatuses.set(userId, payload.status);
            emitOnlineUsers(io);
            socket.emit('chat:status', payload.status);
        });

        socket.on('chat:join', async (payload: ChatJoinPayload) => {
            if (!payload || typeof payload.room !== 'string' || payload.room.trim().length === 0) {
                socket.emit('chat:error', { message: 'La sala indicada no és vàlida.' });
                return;
            }

            const room = payload.room.trim();

            if (!canJoinRoom(room, userId)) {
                Logging.warning(`User ${userId} tried to join room ${room}`);
                socket.emit('chat:error', { message: 'No puedes entrar en esta sala.' });
                return;
            }

            try {
                await socket.join(room);
                const history = await Message.find({ room }).sort({ timestamp: -1 }).limit(HISTORY_LIMIT).populate('user', 'name').lean();
                socket.emit('chat:history', history.reverse() as unknown as ChatMessage[]);
            } catch (error) {
                Logging.error(error);
                socket.emit('chat:error', { message: 'No se pudo cargar el historial de la sala.' });
            }
        });

        socket.on('chat:message', async (payload: ChatMessagePayload) => {
            if (!payload || typeof payload.room !== 'string' || typeof payload.text !== 'string' || payload.room.trim().length === 0 || payload.text.trim().length === 0) {
                socket.emit('chat:error', { message: 'La sala y el texto del mensaje son obligatorios.' });
                return;
            }

            const room = payload.room.trim();
            const text = payload.text.trim();

            if (text.length > MAX_TEXT_LENGTH) {
                socket.emit('chat:error', { message: `El mensaje no puede tener más de ${MAX_TEXT_LENGTH} caracteres.` });
                return;
            }

            if (!socket.rooms.has(room)) {
                socket.emit('chat:error', { message: 'Debes entrar a la sala antes de enviar mensajes.' });
                return;
            }

            try {
                const message = await Message.create({ room, user: userId, text });
                await message.populate('user', 'name');
                io.to(room).emit('chat:message', message.toJSON() as unknown as ChatMessage);
            } catch (error) {
                Logging.error(error);
                socket.emit('chat:error', { message: 'No se pudo guardar el mensaje.' });
            }
        });

        socket.on('disconnect', () => {
            Logging.info(`Socket disconnected for user ${userId}`);

            const sockets = (onlineUsers.get(userId) ?? 1) - 1;
            if (sockets > 0) {
                onlineUsers.set(userId, sockets);
            } else {
                onlineUsers.delete(userId);
                userStatuses.delete(userId);
            }
            emitOnlineUsers(io);
        });
    });

    return io;
};
