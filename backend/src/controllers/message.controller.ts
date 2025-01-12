import { Request, Response } from "express";
import * as messageService from "../services/message.service";

export async function getChannelMessages(req: Request, res: Response) {
    const { channelId } = req.params;
    try {
        const messages = await messageService.getChannelMessages(channelId);
        res.json(messages);
    } catch (error: any) {
        console.error('[MessageController] Error getting channel messages:', error);

        if (error.name === 'UnauthorizedError' || error.message.includes('unauthorized')) {
            return res.status(401).json({ error: 'Unauthorized access' });
        }

        if (error.name === 'ForbiddenError' || error.message.includes('forbidden')) {
            return res.status(403).json({ error: 'Forbidden access' });
        }

        if (error.name === 'ValidationError' || error.message.includes('invalid')) {
            return res.status(400).json({ error: error.message });
        }

        res.status(500).json({ error: 'Internal server error' });
    }
}

export async function createMessage(req: Request, res: Response) {
    const { content, channelId, parentId } = req.body;
    const userId = (req as any).userId;
    try {
        const message = await messageService.createMessage(content, channelId, userId, parentId);
        res.status(201).json(message);
    } catch (error: any) {
        res.status(400).json({ error: error.message });
    }
}

export async function getThreadMessages(req: Request, res: Response) {
    const { messageId } = req.params;
    try {
        const messages = await messageService.getThreadMessages(messageId);
        res.json(messages);
    } catch (error: any) {
        res.status(400).json({ error: error.message });
    }
}