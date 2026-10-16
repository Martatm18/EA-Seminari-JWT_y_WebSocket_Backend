import express from "express";
import controller from "../controllers/Auth";
import { Schemas, ValidateJoi } from "../middleware/Joi";

const router = express.Router();

router.post(
  "/register",
  ValidateJoi(Schemas.auth.register),
  controller.register,
);
router.post("/login", ValidateJoi(Schemas.auth.login), controller.login);
router.post("/refresh", controller.refresh); // Quitamos ValidateJoi porque ya no viene en el body
router.post("/logout", controller.logout); // Esta es la nueva ruta de logout

export = router;

// Documentacion de Swagger de las tres rutas.
// security: [] quita el candado: son las unicas rutas que no necesitan token.

/**
 * @openapi
 * /auth/register:
 *   post:
 *     tags: [Auth]
 *     summary: Registra un usuario nuevo
 *     description: El usuario se crea siempre con el rol user. No devuelve token, hay que hacer login despues.
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/RegisterInput' }
 *     responses:
 *       201:
 *         description: Usuario creado
 *         content:
 *           application/json:
 *             schema: { type: object, properties: { user: { $ref: '#/components/schemas/User' } } }
 *       409: { $ref: '#/components/responses/Conflict' }
 *       422: { $ref: '#/components/responses/Unprocessable' }
 *
 * /auth/login:
 *   post:
 *     tags: [Auth]
 *     summary: Inicia sesion
 *     description: Devuelve el access token (para la cabecera Authorization), el refresh token y el usuario.
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/LoginInput' }
 *     responses:
 *       200: { $ref: '#/components/responses/LoginOk' }
 *       401: { $ref: '#/components/responses/BadCredentials' }
 *       422: { $ref: '#/components/responses/Unprocessable' }
 *
 * /auth/refresh:
 *   post:
 *     tags: [Auth]
 *     summary: Pide un access token nuevo
 *     description: Se usa cuando el access token ha caducado. Se envia el refresh token que devolvio el login.
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/RefreshInput' }
 *     responses:
 *       200:
 *         description: Access token nuevo
 *         content:
 *           application/json:
 *             example: { token: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9... }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       422: { $ref: '#/components/responses/Unprocessable' }
 */
