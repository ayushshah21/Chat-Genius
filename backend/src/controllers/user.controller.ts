import { Request, Response } from "express";
import * as userService from "../services/user.service";
import * as channelService from "../services/channel.service";

export async function getProfile(req: Request, res: Response) {
    const userId = (req as any).userId;
    try {
        const user = await userService.getUserProfile(userId);
        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }
        res.json(user);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
}

export async function updateProfile(req: Request, res: Response) {
    const userId = (req as any).userId;
    const { name, email, avatarUrl } = req.body;

    try {
        const updatedUser = await userService.updateUserProfile(userId, {
            name,
            email,
            avatarUrl,
        });
        res.json(updatedUser);
    } catch (error: any) {
        if (error.code === 'P2002') {
            return res.status(400).json({ error: "Email already exists" });
        }
        res.status(500).json({ error: error.message });
    }
}

export async function getAvailableUsers(req: Request, res: Response) {
    const currentUserId = (req as any).userId;
    try {
        const users = await channelService.getAvailableUsers(currentUserId);
        res.json(users);
    } catch (error: any) {
        res.status(400).json({ error: error.message });
    }
} 