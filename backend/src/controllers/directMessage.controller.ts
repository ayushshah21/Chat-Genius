import { Request, Response } from "express";
import * as directMessageService from "../services/directMessage.service";

export async function createDirectMessage(req: Request, res: Response) {
    try {
        const { content, receiverId, parentId, fileIds } = req.body;
        const senderId = (req as any).userId;

        const message = await directMessageService.createDirectMessage({
            content,
            senderId,
            receiverId,
            parentId,
            fileIds
        });

        res.json(message);
    } catch (error) {
        console.error('Error creating direct message:', error);
        res.status(500).json({ error: 'Failed to create direct message' });
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

export async function getThreadMessages(req: Request, res: Response) {
    const { messageId } = req.params;

    try {
        const messages = await directMessageService.getThreadMessages(messageId);
        res.json(messages);
    } catch (error: any) {
        res.status(400).json({ error: error.message });
    }
} 