import { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import axios from "axios";

const prisma = new PrismaClient();
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
const ELEVENLABS_BASE_URL = 'https://api.elevenlabs.io/v1';

export async function textToSpeech(req: Request, res: Response) {
    try {
        const { text, userId: targetUserId } = req.body;
        const requestingUserId = (req as any).userId;

        // Input validation
        if (!text || typeof text !== 'string') {
            return res.status(400).json({ error: 'Text is required and must be a string' });
        }

        if (!requestingUserId) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        // If no targetUserId is provided, use the requesting user's voice
        const userIdToUse = targetUserId || requestingUserId;

        const user = await prisma.user.findUnique({
            where: { id: userIdToUse }
        });

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        if (!user.elevenLabsVoiceId) {
            return res.status(403).json({ error: 'User does not have a custom voice configured' });
        }

        try {
            const response = await axios.post(
                `${ELEVENLABS_BASE_URL}/text-to-speech/${user.elevenLabsVoiceId}`,
                {
                    text,
                    voice_settings: {
                        stability: 0.5,
                        similarity_boost: 0.5,
                    },
                },
                {
                    headers: {
                        'xi-api-key': ELEVENLABS_API_KEY,
                        'Content-Type': 'application/json',
                    },
                    responseType: 'arraybuffer',
                }
            );

            res.setHeader('Content-Type', 'audio/mpeg');
            return res.send(response.data);
        } catch (elevenLabsError: any) {
            // Handle ElevenLabs specific errors
            console.error('ElevenLabs API error:', elevenLabsError);
            if (elevenLabsError.response?.status === 429) {
                return res.status(429).json({ error: 'Rate limit exceeded. Please try again later.' });
            }
            if (elevenLabsError.response?.status === 401 || elevenLabsError.response?.status === 403) {
                return res.status(500).json({ error: 'Voice service configuration error' });
            }
            throw elevenLabsError; // Re-throw for general error handling
        }
    } catch (error) {
        console.error('Error in text-to-speech:', error);
        return res.status(500).json({ error: 'Failed to generate speech' });
    }
}

export async function getVoices(req: Request, res: Response) {
    try {
        const userId = (req as any).userId;
        if (!userId) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        const response = await axios.get(`${ELEVENLABS_BASE_URL}/voices`, {
            headers: {
                'xi-api-key': ELEVENLABS_API_KEY,
            },
        });
        return res.json(response.data);
    } catch (error: any) {
        console.error('Error fetching voices:', error);
        if (error.response?.status === 429) {
            return res.status(429).json({ error: 'Rate limit exceeded. Please try again later.' });
        }
        return res.status(500).json({ error: 'Failed to fetch voices' });
    }
}

export async function initializeUserVoice(req: Request, res: Response) {
    try {
        const { voiceId } = req.body;
        const userId = (req as any).userId;

        if (!userId) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        if (!voiceId || typeof voiceId !== 'string') {
            return res.status(400).json({ error: 'Voice ID is required and must be a string' });
        }

        // Verify the voice exists in ElevenLabs
        try {
            await axios.get(`${ELEVENLABS_BASE_URL}/voices/${voiceId}`, {
                headers: {
                    'xi-api-key': ELEVENLABS_API_KEY,
                },
            });
        } catch (elevenLabsError: any) {
            if (elevenLabsError.response?.status === 404) {
                return res.status(400).json({ error: 'Invalid voice ID' });
            }
            throw elevenLabsError;
        }

        const user = await prisma.user.update({
            where: { id: userId },
            data: { elevenLabsVoiceId: voiceId }
        });
        return res.json(user);
    } catch (error: any) {
        console.error('Error initializing voice:', error);
        if (error.code === 'P2025') {
            return res.status(404).json({ error: 'User not found' });
        }
        return res.status(500).json({ error: 'Failed to initialize voice' });
    }
} 