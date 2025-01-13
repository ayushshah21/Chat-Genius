import { Request, Response } from "express";
import * as channelService from "../services/channel.service";

export async function createChannel(req: Request, res: Response) {
    const { name, type } = req.body;
    const userId = (req as any).userId;

    console.log('[ChannelController] Received create channel request:', {
        body: req.body,
        extractedData: { name, type, userId },
        contentType: req.headers['content-type']
    });

    try {
        const channel = await channelService.createChannel({ name, type, userId });
        console.log('[ChannelController] Channel created successfully:', channel);
        res.status(201).json(channel);
    } catch (error: any) {
        console.error('[ChannelController] Error creating channel:', {
            error,
            stack: error.stack,
            body: req.body
        });

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

export async function getUserChannels(req: Request, res: Response) {
    const userId = (req as any).userId;

    try {
        const channels = await channelService.getUserChannels(userId);
        res.json(channels);
    } catch (error: any) {
        console.error('[ChannelController] Error getting channels:', error);

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

export async function getChannelById(req: Request, res: Response) {
    const { channelId } = req.params;
    const userId = (req as any).userId;

    try {
        const channel = await channelService.getChannelById(channelId);
        if (!channel) {
            return res.status(404).json({ error: 'Channel not found' });
        }
        res.json(channel);
    } catch (error: any) {
        console.error('[ChannelController] Error getting channel by id:', error);
        if (error.message?.includes('unauthorized') || error.message?.includes('authentication')) {
            return res.status(401).json({ error: error.message });
        }
        if (error.message?.includes('permission') || error.message?.includes('forbidden')) {
            return res.status(403).json({ error: error.message });
        }
        if (error.message?.includes('validation') || error.message?.includes('required') || error.message?.includes('invalid')) {
            return res.status(400).json({ error: error.message });
        }
        res.status(500).json({ error: 'Internal server error' });
    }
}

export async function getChannelMessages(req: Request, res: Response) {
    const { channelId } = req.params;
    const userId = (req as any).userId;

    try {
        const messages = await channelService.getChannelMessages(channelId, userId);
        res.json(messages);
    } catch (error: any) {
        console.error('[ChannelController] Error getting channel messages:', error);
        if (error.message?.includes('unauthorized') || error.message?.includes('authentication')) {
            return res.status(401).json({ error: error.message });
        }
        if (error.message?.includes('permission') || error.message?.includes('forbidden')) {
            return res.status(403).json({ error: error.message });
        }
        if (error.message?.includes('validation') || error.message?.includes('required') || error.message?.includes('invalid')) {
            return res.status(400).json({ error: error.message });
        }
        res.status(500).json({ error: 'Internal server error' });
    }
}

export async function getThreadMessages(req: Request, res: Response) {
    const { messageId } = req.params;
    const userId = (req as any).userId;

    try {
        const messages = await channelService.getThreadMessages(messageId, userId);
        res.json(messages);
    } catch (error: any) {
        console.error('[ChannelController] Error getting thread messages:', error);
        if (error.message?.includes('unauthorized') || error.message?.includes('authentication')) {
            return res.status(401).json({ error: error.message });
        }
        if (error.message?.includes('permission') || error.message?.includes('forbidden')) {
            return res.status(403).json({ error: error.message });
        }
        if (error.message?.includes('validation') || error.message?.includes('required') || error.message?.includes('invalid')) {
            return res.status(400).json({ error: error.message });
        }
        res.status(500).json({ error: 'Internal server error' });
    }
}

export async function joinChannel(req: Request, res: Response) {
    const { channelId } = req.params;
    const userId = (req as any).userId;

    try {
        const channel = await channelService.addMemberToChannel(channelId, userId);
        res.json(channel);
    } catch (error: any) {
        console.error('[ChannelController] Error joining channel:', error);
        if (error.message?.includes('unauthorized') || error.message?.includes('authentication')) {
            return res.status(401).json({ error: error.message });
        }
        if (error.message?.includes('permission') || error.message?.includes('forbidden')) {
            return res.status(403).json({ error: error.message });
        }
        if (error.message?.includes('validation') || error.message?.includes('required') || error.message?.includes('invalid')) {
            return res.status(400).json({ error: error.message });
        }
        res.status(500).json({ error: 'Internal server error' });
    }
}

export async function leaveChannel(req: Request, res: Response) {
    const { channelId } = req.params;
    const userId = (req as any).userId;

    try {
        const channel = await channelService.removeMemberFromChannel(channelId, userId);
        res.json(channel);
    } catch (error: any) {
        console.error('[ChannelController] Error leaving channel:', error);
        if (error.message?.includes('unauthorized') || error.message?.includes('authentication')) {
            return res.status(401).json({ error: error.message });
        }
        if (error.message?.includes('permission') || error.message?.includes('forbidden')) {
            return res.status(403).json({ error: error.message });
        }
        if (error.message?.includes('validation') || error.message?.includes('required') || error.message?.includes('invalid')) {
            return res.status(400).json({ error: error.message });
        }
        res.status(500).json({ error: 'Internal server error' });
    }
}
