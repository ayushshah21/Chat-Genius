import { Request, Response } from "express";
import * as channelService from "../services/channel.service";

export async function createChannel(req: Request, res: Response) {
    const { name, type, memberIds } = req.body;
    const userId = (req as any).userId; // From auth middleware

    try {
        const channel = await channelService.createChannel(
            name,
            type,
            userId,
            memberIds
        );
        res.status(201).json(channel);
    } catch (error: any) {
        res.status(400).json({ error: error.message });
    }
}

export async function getUserChannels(req: Request, res: Response) {
    const userId = (req as any).userId;

    try {
        const channels = await channelService.getUserChannels(userId);
        res.json(channels);
    } catch (error: any) {
        res.status(400).json({ error: error.message });
    }
}

export async function getChannelById(req: Request, res: Response) {
    const { channelId } = req.params;
    const userId = (req as any).userId;

    try {
        const channel = await channelService.getChannelById(channelId);
        if (!channel) {
            return res.status(404).json({ error: "Channel not found" });
        }

        // Check if user is a member of the channel
        const isMember = channel.members.some(member => member.id === userId);
        if (!isMember && channel.type !== "PUBLIC") {
            return res.status(403).json({ error: "Not authorized to view this channel" });
        }

        res.json(channel);
    } catch (error: any) {
        res.status(400).json({ error: error.message });
    }
}

export async function joinChannel(req: Request, res: Response) {
    const { channelId } = req.params;
    const userId = (req as any).userId;

    try {
        const channel = await channelService.getChannelById(channelId);
        if (!channel) {
            return res.status(404).json({ error: "Channel not found" });
        }

        if (channel.type === "PRIVATE") {
            return res.status(403).json({ error: "Cannot join private channel" });
        }

        const updatedChannel = await channelService.addMemberToChannel(channelId, userId);
        res.json(updatedChannel);
    } catch (error: any) {
        res.status(400).json({ error: error.message });
    }
}

export async function leaveChannel(req: Request, res: Response) {
    const { channelId } = req.params;
    const userId = (req as any).userId;

    try {
        const channel = await channelService.getChannelById(channelId);
        if (!channel) {
            return res.status(404).json({ error: "Channel not found" });
        }

        if (channel.createdBy === userId) {
            return res.status(400).json({ error: "Channel creator cannot leave" });
        }

        await channelService.removeMemberFromChannel(channelId, userId);
        res.json({ message: "Successfully left channel" });
    } catch (error: any) {
        res.status(400).json({ error: error.message });
    }
} 