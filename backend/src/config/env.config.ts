import dotenv from 'dotenv';

// Load the appropriate .env file based on NODE_ENV
dotenv.config({
    path: `.env.${process.env.NODE_ENV || 'development'}`
});

export const ENV_CONFIG = {
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