import { PrismaClient, Message } from '@prisma/client';
import { io } from '../socket/socket.service';

const prisma = new PrismaClient();

export async function createMessage(
    content: string | null,
    channelId: string,
    userId: string,
    parentId?: string,
    fileIds?: string[]
) {
    const message = await prisma.message.create({
        data: {
            content,
            channelId,
            userId,
            parentId,
            ...(fileIds && {
                files: {
                    connect: fileIds.map(id => ({ id }))
                }
            })
        },
        include: {
            user: {
                select: {
                    id: true,
                    name: true,
                    email: true,
                    avatarUrl: true
                }
            },
            files: true,
            reactions: {
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
            },
            _count: {
                select: {
                    replies: true
                }
            }
        }
    });

    return message;
}

export async function getChannelMessages(channelId: string) {
    try {
        const messages = await prisma.message.findMany({
            where: {
                channelId,
                parentId: null // Only get top-level messages
            },
            orderBy: {
                createdAt: 'desc'
            },
            include: {
                user: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        avatarUrl: true
                    }
                },
                files: true,
                reactions: {
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
                },
                replies: {
                    include: {
                        user: {
                            select: {
                                id: true,
                                name: true,
                                email: true,
                                avatarUrl: true
                            }
                        },
                        files: true,
                        reactions: {
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
                        }
                    }
                }
            }
        });

        // Transform reactions into the expected format for each message
        const formattedMessages = messages.map(message => ({
            ...message,
            reactions: message.reactions.reduce((acc, reaction) => {
                const existingReaction = acc.find(r => r.emoji === reaction.emoji);
                if (existingReaction) {
                    existingReaction.users.push(reaction.user);
                } else {
                    acc.push({
                        emoji: reaction.emoji,
                        users: [reaction.user]
                    });
                }
                return acc;
            }, [] as Array<{ emoji: string; users: Array<{ id: string; name: string | null; email: string; avatarUrl: string | null; }> }>),
            replies: message.replies.map(reply => ({
                ...reply,
                reactions: reply.reactions.reduce((acc, reaction) => {
                    const existingReaction = acc.find(r => r.emoji === reaction.emoji);
                    if (existingReaction) {
                        existingReaction.users.push(reaction.user);
                    } else {
                        acc.push({
                            emoji: reaction.emoji,
                            users: [reaction.user]
                        });
                    }
                    return acc;
                }, [] as Array<{ emoji: string; users: Array<{ id: string; name: string | null; email: string; avatarUrl: string | null; }> }>)
            }))
        }));

        console.log('[MessageService] Found messages:', {
            count: formattedMessages.length,
            messagesWithReactions: formattedMessages.filter(m => m.reactions.length > 0).length
        });

        return formattedMessages;
    } catch (error) {
        console.error('[MessageService] Error getting channel messages:', error);
        throw error;
    }
}

export async function getThreadMessages(parentId: string) {
    return await prisma.message.findMany({
        where: {
            parentId
        },
        include: {
            user: {
                select: {
                    id: true,
                    name: true,
                    email: true,
                    avatarUrl: true
                }
            },
            files: true,
            reactions: {
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
            }
        },
        orderBy: {
            createdAt: 'asc'
        }
    });
}

export async function deleteMessage(messageId: string, userId: string): Promise<void> {
    try {
        // First check if the message exists and belongs to the user
        const message = await prisma.message.findUnique({
            where: { id: messageId },
            include: { user: true }
        });

        if (!message) {
            throw new Error('Message not found');
        }

        if (message.user.id !== userId) {
            throw new Error('Unauthorized to delete this message');
        }

        // Delete the message and its associated reactions
        await prisma.$transaction([
            prisma.emojiReaction.deleteMany({
                where: { messageId }
            }),
            prisma.message.delete({
                where: { id: messageId }
            })
        ]);
    } catch (error) {
        console.error('[MessageService] Error deleting message:', error);
        throw error;
    }
}

export async function deleteDirectMessage(messageId: string, userId: string): Promise<void> {
    try {
        // First check if the DM exists and belongs to the user
        const dm = await prisma.directMessage.findUnique({
            where: { id: messageId },
            include: { sender: true }
        });

        if (!dm) {
            throw new Error('Direct message not found');
        }

        if (dm.sender.id !== userId) {
            throw new Error('Unauthorized to delete this message');
        }

        // Delete the DM and its associated reactions
        await prisma.$transaction([
            prisma.emojiReaction.deleteMany({
                where: { directMessageId: messageId }
            }),
            prisma.directMessage.delete({
                where: { id: messageId }
            })
        ]);
    } catch (error) {
        console.error('[MessageService] Error deleting direct message:', error);
        throw error;
    }
} 