import { PrismaClient } from "@prisma/client";
import { getIO } from '../socket/socket.service';

const prisma = new PrismaClient();

function getDMRoomId(senderId: string, receiverId: string): string {
    return [senderId, receiverId].sort().join(':');
}

export async function createDirectMessage(data: any) {
    const message = await prisma.directMessage.create({
        data: {
            content: data.content,
            sender: {
                connect: { id: data.senderId }
            },
            receiver: {
                connect: { id: data.receiverId }
            },
            parentId: data.parentId
        },
        include: {
            sender: true,
            receiver: true,
            parent: true
        }
    });

    const dmRoomId = getDMRoomId(data.senderId, data.receiverId);

    if (data.parentId) {
        getIO().emit('new_reply', {
            messageId: data.parentId,
            reply: message
        });
    } else {
        getIO().to(`dm:${dmRoomId}`).emit('new_dm', message);
    }

    return message;
}

export async function getDirectMessages(userId: string, otherUserId: string) {
    console.log(`[DirectMessageService] Fetching DMs between users ${userId} and ${otherUserId}`);

    const messages = await prisma.directMessage.findMany({
        where: {
            OR: [
                { AND: [{ senderId: userId }, { receiverId: otherUserId }] },
                { AND: [{ senderId: otherUserId }, { receiverId: userId }] },
            ],
            parentId: null // Only get top-level messages
        },
        include: {
            sender: {
                select: {
                    id: true,
                    name: true,
                    email: true,
                    avatarUrl: true,
                }
            },
            receiver: {
                select: {
                    id: true,
                    name: true,
                    email: true,
                    avatarUrl: true,
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
                    sender: {
                        select: {
                            id: true,
                            name: true,
                            email: true,
                            avatarUrl: true,
                        }
                    },
                    receiver: {
                        select: {
                            id: true,
                            name: true,
                            email: true,
                            avatarUrl: true,
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
            }
        },
        orderBy: [
            {
                createdAt: 'desc'
            }
        ]
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

    console.log('[DirectMessageService] Found messages:', {
        count: formattedMessages.length,
        messagesWithReactions: formattedMessages.filter(m => m.reactions.length > 0).length
    });

    return formattedMessages;
}

export async function getThreadMessages(messageId: string) {
    console.log('[DirectMessageService] Fetching thread messages for:', messageId);

    const messages = await prisma.directMessage.findMany({
        where: {
            parentId: messageId
        },
        include: {
            sender: {
                select: {
                    id: true,
                    name: true,
                    email: true,
                    avatarUrl: true,
                }
            },
            receiver: {
                select: {
                    id: true,
                    name: true,
                    email: true,
                    avatarUrl: true,
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
        }, [] as Array<{ emoji: string; users: Array<{ id: string; name: string | null; email: string; avatarUrl: string | null; }> }>)
    }));

    console.log('[DirectMessageService] Found thread messages:', {
        count: formattedMessages.length,
        messagesWithReactions: formattedMessages.filter(m => m.reactions.length > 0).length
    });

    return formattedMessages;
} 