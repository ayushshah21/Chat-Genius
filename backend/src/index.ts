import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import cors from "cors";
import passport from "./config/passport";
import authRoutes from "./routes/auth.routes";
import dotenv from "dotenv";
import session from "express-session";
import channelRoutes from "./routes/channel.routes";
import { setupSocketIO } from "./socket/socket.service";
import messageRoutes from "./routes/message.routes";
import userRoutes from "./routes/user.routes";
import directMessageRoutes from "./routes/directMessage.routes";
import searchRoutes from "./routes/search.routes";

dotenv.config({
  path: `.env.${process.env.NODE_ENV || 'development'}`
});

const app = express();
const httpServer = createServer(app);

// Configure CORS origins
const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
const allowedOrigins = process.env.NODE_ENV === 'production'
  ? [frontendUrl]
  : [frontendUrl, 'http://localhost:5173'];

// Enable pre-flight requests for all routes
app.options('*', cors());

const corsOptions = {
  origin: (requestOrigin: string | undefined, callback: (err: Error | null, origin?: boolean) => void) => {
    if (!requestOrigin || allowedOrigins.includes(requestOrigin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Origin', 'Accept'],
  exposedHeaders: ['Content-Range', 'X-Content-Range']
};

const io = new Server(httpServer, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization', 'Origin', 'Accept']
  }
});

// Middlewares
app.use(cors(corsOptions));

app.use(
  session({
    secret: process.env.SESSION_SECRET || "some_secret_key",
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 1000 * 60 * 60 * 24, // 1 day
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    },
  })
);

app.use(express.json());
app.use(passport.initialize());

// Setup Socket.IO
setupSocketIO(io);

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/channels", channelRoutes);
app.use("/api/messages", messageRoutes);
app.use("/api/users", userRoutes);
app.use("/api/direct-messages", directMessageRoutes);
app.use("/api/search", searchRoutes);

const PORT = process.env.PORT || 4000;

httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});