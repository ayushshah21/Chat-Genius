import { Request, Response } from "express";
import * as directMessageService from "../services/directMessage.service";

export async function createDirectMessage(req: Request, res: Response) {
    const { content, receiverId, parentId } = req.body;
    const senderId = (req as any).userId;

    try {
        const message = await directMessageService.createDirectMessage({
            content,
            senderId,
            receiverId,
            parentId
        });
        res.status(201).json(message);
    } catch (error: any) {
        console.error('[DirectMessageController] Error creating message:', error);

        // Handle specific error types
        if (error.message?.includes('unauthorized') || error.message?.includes('authentication')) {
            return res.status(401).json({ error: error.message });
        }
        if (error.message?.includes('permission') || error.message?.includes('forbidden')) {
            return res.status(403).json({ error: error.message });
        }
        if (error.message?.includes('validation') || error.message?.includes('required') || error.message?.includes('invalid')) {
            return res.status(400).json({ error: error.message });
        }

        // Default to 500 for unexpected errors
        res.status(500).json({ error: 'Internal server error' });
    }
}

export async function getDirectMessages(req: Request, res: Response) {
    const { otherUserId } = req.params;
    const userId = (req as any).userId;

    try {
        const messages = await directMessageService.getDirectMessages(userId, otherUserId);
        res.json(messages);
    } catch (error: any) {
        console.error('[DirectMessageController] Error getting messages:', error);

        // Handle specific error types
        if (error.message?.includes('unauthorized') || error.message?.includes('authentication')) {
            return res.status(401).json({ error: error.message });
        }
        if (error.message?.includes('permission') || error.message?.includes('forbidden')) {
            return res.status(403).json({ error: error.message });
        }
        if (error.message?.includes('validation') || error.message?.includes('required') || error.message?.includes('invalid')) {
            return res.status(400).json({ error: error.message });
        }

        // Default to 500 for unexpected errors
        res.status(500).json({ error: 'Internal server error' });
    }
}

export async function getThreadMessages(req: Request, res: Response) {
    const { messageId } = req.params;
    const userId = (req as any).userId;

    try {
        const messages = await directMessageService.getThreadMessages(messageId);
        res.json(messages);
    } catch (error: any) {
        console.error('[DirectMessageController] Error getting thread messages:', error);

        // Handle specific error types
        if (error.message?.includes('unauthorized') || error.message?.includes('authentication')) {
            return res.status(401).json({ error: error.message });
        }
        if (error.message?.includes('permission') || error.message?.includes('forbidden')) {
            return res.status(403).json({ error: error.message });
        }
        if (error.message?.includes('validation') || error.message?.includes('required') || error.message?.includes('invalid')) {
            return res.status(400).json({ error: error.message });
        }

        // Default to 500 for unexpected errors
        res.status(500).json({ error: 'Internal server error' });
    }
} 