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
    console.log('[MessageService] Getting messages for channel:', channelId);
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