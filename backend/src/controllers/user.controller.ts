import { Request, Response } from "express";
import * as channelService from "../services/channel.service";

export async function getAvailableUsers(req: Request, res: Response) {
    const currentUserId = (req as any).userId;
    try {
        const users = await channelService.getAvailableUsers(currentUserId);
        res.json(users);
    } catch (error: any) {
        res.status(400).json({ error: error.message });
    }
} 