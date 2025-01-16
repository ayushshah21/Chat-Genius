"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ENV_CONFIG = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
// Load the appropriate .env file based on NODE_ENV
dotenv_1.default.config({
    path: `.env.${process.env.NODE_ENV || 'development'}`
});
exports.ENV_CONFIG = {
    PORT: process.env.PORT || 4000,
    DATABASE_URL: process.env.DATABASE_URL,
    FRONTEND_URL: process.env.FRONTEND_URL,
    JWT_SECRET: process.env.JWT_SECRET,
    GOOGLE: {
        CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
        CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
        CALLBACK_URL: process.env.GOOGLE_CALLBACK_URL
    },
    ELEVENLABS_API_KEY: process.env.ELEVENLABS_API_KEY
};
