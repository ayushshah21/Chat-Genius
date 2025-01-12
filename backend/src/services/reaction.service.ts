import { PrismaClient } from '@prisma/client';
import { getIO} from '../socket/socket.service';

const prisma = new PrismaClient();

export async function addReaction(
    emoji: string,
    userId: string,
    messageId?: string,
    dmId?: string
) {
    try {
        // Check if reaction already exists
        const existingReaction = await prisma.emojiReaction.findFirst({
            where: {
                emoji,
                userId,
                ...(messageId ? { messageId } : {}),
                ...(dmId ? { dmId } : {})
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
                ...(dmId ? { dmId } : {})
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
    dmId?: string
) {
    try {
        const result = await prisma.emojiReaction.deleteMany({
            where: {
                emoji,
                userId,
                messageId,
                dmId
            }
        });

        return result;
    } catch (error) {
        console.error('[ReactionService] Error removing reaction:', error);
        throw error;
    }
}

export async function getReactions(messageId?: string, dmId?: string) {
    try {
        const reactions = await prisma.emojiReaction.findMany({
            where: {
                messageId,
                dmId
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