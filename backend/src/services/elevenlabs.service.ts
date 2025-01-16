import axios from 'axios';
import { PrismaClient } from "@prisma/client";
import { ENV_CONFIG } from '../config/env.config';

const prisma = new PrismaClient();

class ElevenLabsService {
    private baseUrl = 'https://api.elevenlabs.io/v1';

    async textToSpeech(text: string, userId: string): Promise<Buffer> {
        try {
            const user = await prisma.user.findUnique({
                where: { id: userId }
            });

            if (!user?.elevenLabsVoiceId) {
                throw new Error('User does not have a custom voice configured');
            }

            const response = await axios.post(
                `${this.baseUrl}/text-to-speech/${user.elevenLabsVoiceId}`,
                {
                    text,
                    voice_settings: {
                        stability: 0.5,
                        similarity_boost: 0.5,
                    },
                },
                {
                    headers: {
                        'xi-api-key': ENV_CONFIG.ELEVENLABS_API_KEY,
                        'Content-Type': 'application/json',
                    },
                    responseType: 'arraybuffer',
                }
            );

            return response.data;
        } catch (error) {
            console.error('Error in textToSpeech:', error);
            throw error;
        }
    }

    async getVoices(): Promise<any> {
        try {
            const response = await axios.get(`${this.baseUrl}/voices`, {
                headers: {
                    'xi-api-key': ENV_CONFIG.ELEVENLABS_API_KEY,
                },
            });
            return response.data;
        } catch (error) {
            console.error('Error fetching voices:', error);
            throw error;
        }
    }

    async initializeUserVoice(userId: string, voiceId: string) {
        try {
            return await prisma.user.update({
                where: { id: userId },
                data: { elevenLabsVoiceId: voiceId }
            });
        } catch (error) {
            console.error('Error initializing user voice:', error);
            throw error;
        }
    }
}

export const elevenLabsService = new ElevenLabsService(); 