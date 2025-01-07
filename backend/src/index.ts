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


dotenv.config();

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: process.env.FRONTEND_URL,
    methods: ["GET", "POST"],
    credentials: true
  }
});

// Middlewares
app.use(
  session({
    secret: process.env.SESSION_SECRET || "some_secret_key",
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 1000 * 60 * 60 * 24, // 1 day
    },
  })
);
app.use(cors({ origin: process.env.FRONTEND_URL, credentials: true }));
app.use(express.json());
app.use(passport.initialize());

// Setup Socket.IO
setupSocketIO(io);

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/channels", channelRoutes);
app.use("/api/messages", messageRoutes);

const PORT = process.env.PORT || 4000;

httpServer.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});