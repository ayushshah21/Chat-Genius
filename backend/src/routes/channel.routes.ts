import express, { Request, Response } from 'express';
import { authGuard } from '../middlewares/auth.middleware';
import * as channelController from '../controllers/channel.controller';

const router = express.Router();

// Apply authGuard to all routes
router.use(authGuard);

// Create a new channel
router.post("/", async (req: Request, res: Response) => {
    await channelController.createChannel(req, res);
});

// Get user's channels
router.get("/", async (req: Request, res: Response) => {
    await channelController.getUserChannels(req, res);
});

// Get channel by ID
router.get("/:channelId", async (req: Request, res: Response) => {
    await channelController.getChannelById(req, res);
});

// Join a channel
router.post("/:channelId/join", async (req: Request, res: Response) => {
    await channelController.joinChannel(req, res);
});

// Leave a channel
router.post("/:channelId/leave", async (req: Request, res: Response) => {
    await channelController.leaveChannel(req, res);
});

export default router; 