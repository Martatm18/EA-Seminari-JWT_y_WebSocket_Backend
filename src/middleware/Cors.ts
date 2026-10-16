import cors from "cors";
import { config } from "../config/config";

export const Cors = cors({
  origin: config.cors.origin,
  credentials: true, // Debemos poner esto para que el navegador acepte y envíe cookies
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: [
    "Origin",
    "X-Requested-With",
    "Content-Type",
    "Accept",
    "Authorization",
  ],
});
