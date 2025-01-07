import { Request, Response } from "express";
import * as messageService from "../services/message.service";

export async function getChannelMessages(req: Request, res: Response) {
    const { channelId } = req.params;
    try {
        const messages = await messageService.getChannelMessages(channelId);
        res.json(messages);
    } catch (error: any) {
        res.status(400).json({ error: error.message });
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