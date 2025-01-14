"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const http_1 = require("http");
const socket_io_1 = require("socket.io");
const cors_1 = __importDefault(require("cors"));
const passport_1 = __importDefault(require("./config/passport"));
const auth_routes_1 = __importDefault(require("./routes/auth.routes"));
const dotenv_1 = __importDefault(require("dotenv"));
const express_session_1 = __importDefault(require("express-session"));
const channel_routes_1 = __importDefault(require("./routes/channel.routes"));
const socket_service_1 = require("./socket/socket.service");
const message_routes_1 = __importDefault(require("./routes/message.routes"));
const user_routes_1 = __importDefault(require("./routes/user.routes"));
const directMessage_routes_1 = __importDefault(require("./routes/directMessage.routes"));
const search_routes_1 = __importDefault(require("./routes/search.routes"));
const file_routes_1 = __importDefault(require("./routes/file.routes"));
dotenv_1.default.config({
    path: `.env.${process.env.NODE_ENV || 'development'}`
});
const app = (0, express_1.default)();
const httpServer = (0, http_1.createServer)(app);
// Configure CORS origins
const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
const allowedOrigins = process.env.NODE_ENV === 'production'
    ? [
        'https://chat-genius-pied.vercel.app',
        'https://chat-genius-fzev9646z-ayushshah21s-projects.vercel.app',
        'https://chat-genius-git-main-ayushshah21s-projects.vercel.app',
        'https://chat-genius-git-ai-features-clean-ayushshah21s-projects.vercel.app'
    ]
    : [frontendUrl, 'http://localhost:5173'];
// Enable pre-flight requests for all routes
app.options('*', (0, cors_1.default)());
const corsOptions = {
    origin: (requestOrigin, callback) => {
        if (!requestOrigin || allowedOrigins.includes(requestOrigin)) {
            callback(null, true);
        }
        else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Origin', 'Accept'],
    exposedHeaders: ['Content-Range', 'X-Content-Range']
};
const io = new socket_io_1.Server(httpServer, {
    cors: {
        origin: allowedOrigins,
        methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        credentials: true,
        allowedHeaders: ['Content-Type', 'Authorization', 'Origin', 'Accept']
    }
});
// Middlewares
app.use((0, cors_1.default)(corsOptions));
app.use((0, express_session_1.default)({
    secret: process.env.SESSION_SECRET || "some_secret_key",
    resave: false,
    saveUninitialized: false,
    cookie: {
        maxAge: 1000 * 60 * 60 * 24, // 1 day
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
        domain: process.env.NODE_ENV === 'production' ? '.onrender.com' : undefined
    },
}));
app.use(express_1.default.json());
app.use(passport_1.default.initialize());
// Setup Socket.IO
(0, socket_service_1.setupSocketIO)(io);
// Routes
app.use("/api/auth", auth_routes_1.default);
app.use("/api/channels", channel_routes_1.default);
app.use("/api/messages", message_routes_1.default);
app.use("/api/users", user_routes_1.default);
app.use("/api/direct-messages", directMessage_routes_1.default);
app.use("/api/search", search_routes_1.default);
app.use("/api/files", file_routes_1.default);
const PORT = process.env.PORT || 4000;
httpServer.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
