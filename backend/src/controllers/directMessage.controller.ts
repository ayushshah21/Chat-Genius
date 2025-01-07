import { Request, Response } from "express";
import * as directMessageService from "../services/directMessage.service";

export async function createDirectMessage(req: Request, res: Response) {
    const { content, receiverId } = req.body;
    const senderId = (req as any).userId;

    try {
        const message = await directMessageService.createDirectMessage(
            content,
            senderId,
            receiverId
        );
        res.status(201).json(message);
    } catch (error: any) {
        res.status(400).json({ error: error.message });
    }
}

export async function getDirectMessages(req: Request, res: Response) {
    const { otherUserId } = req.params;
    const userId = (req as any).userId;

    try {
        const messages = await directMessageService.getDirectMessages(userId, otherUserId);
        res.json(messages);
    } catch (error: any) {
        res.status(400).json({ error: error.message });
    }
} 