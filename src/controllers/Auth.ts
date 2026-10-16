import { NextFunction, Request, Response } from 'express';
import AuthService from '../services/AuthService';
import { config } from '../config/config';

// Opciones comunes para la cookie del refresh token
const getCookieOptions = () => ({
    httpOnly: true,
    secure: config.server.env === 'production', // Solo true si estamos en producción real con HTTPS
    sameSite: 'lax' as const, // 'lax' es compatible en local entre puertos diferentes (4200 y 3000)
    path: '/auth',
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 días
});

const register = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const user = await AuthService.register(req.body);
        res.status(201).json({ user });
    } catch (error) {
        next(error);
    }
};

const login = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const result = await AuthService.login(req.body.email, req.body.password);

        if (result) {
            const { refreshToken, token, user } = result;

            // Guardamos el refresh token en una cookie HttpOnly
            res.cookie('refreshToken', refreshToken, getCookieOptions());

            // Devolvemos al frontend solo el access token y el usuario (NUNCA el refresh token en el JSON)
            res.status(200).json({ token, user });
        } else {
            res.status(401).json({ message: 'Email o contraseña incorrectos' });
        }
    } catch (error) {
        next(error);
    }
};

const refresh = async (req: Request, res: Response, next: NextFunction) => {
    try {
        // Leemos el refresh token de la cookie HttpOnly
        const refreshToken = req.cookies?.refreshToken;

        if (!refreshToken) {
            return res.status(401).json({ message: 'No refresh token provided' });
        }

        const result = await AuthService.refresh(refreshToken);

        if (result) {
            res.status(200).json(result);
        } else {
            res.status(401).json({ message: 'El usuario ya no existe' });
        }
    } catch (error) {
        next(error);
    }
};

const logout = async (req: Request, res: Response, next: NextFunction) => {
    try {
        // Borramos la cookie utilizando exactamente las mismas opciones con las que se creó
        res.clearCookie('refreshToken', getCookieOptions());

        res.status(200).json({ message: 'Sesión cerrada correctamente' });
    } catch (error) {
        next(error);
    }
};

export default { register, login, refresh, logout };
