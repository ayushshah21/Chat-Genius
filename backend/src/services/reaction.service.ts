import { PrismaClient } from '@prisma/client';
import { io } from '../socket/socket.service';

const prisma = new PrismaClient();

export async function addReaction(
    emoji: string,
    userId: string,
    messageId?: string,
    directMessageId?: string
) {
    try {
        // Check if reaction already exists
        const existingReaction = await prisma.emojiReaction.findFirst({
            where: {
                emoji,
                userId,
                ...(messageId ? { messageId } : {}),
                ...(directMessageId ? { directMessageId } : {})
            },
        });

        if (existingReaction) {
            return existingReaction;
        }

        // Create new reaction
        const reaction = await prisma.emojiReaction.create({
            data: {
                emoji,
                userId,
                ...(messageId ? { messageId } : {}),
                ...(directMessageId ? { directMessageId } : {})
            },
            include: {
                user: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        avatarUrl: true,
                    },
                },
            },
        });

        return reaction;
    } catch (error) {
        console.error("[ReactionService] Error adding reaction:", error);
        throw error;
    }
}

export async function removeReaction(
    emoji: string,
    userId: string,
    messageId?: string,
    directMessageId?: string
) {
    try {
        const result = await prisma.emojiReaction.deleteMany({
            where: {
                emoji,
                userId,
                messageId,
                directMessageId
            }
        });

        return result;
    } catch (error) {
        console.error('[ReactionService] Error removing reaction:', error);
        throw error;
    }
}

export async function getReactions(messageId?: string, directMessageId?: string) {
    try {
        const reactions = await prisma.emojiReaction.findMany({
            where: {
                messageId,
                directMessageId
            },
            include: {
                user: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        avatarUrl: true
                    }
                }
            }
        });

        return reactions;
    } catch (error) {
        console.error('[ReactionService] Error getting reactions:', error);
        throw error;
    }
} 