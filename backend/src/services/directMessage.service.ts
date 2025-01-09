import { PrismaClient } from "@prisma/client";
import { io } from '../socket/socket.service';

const prisma = new PrismaClient();

export async function createDirectMessage(
    content: string,
    senderId: string,
    receiverId: string,
    parentId?: string,
    fileIds?: string[]
) {
    console.log('[DirectMessageService] Creating direct message:', {
        content,
        senderId,
        receiverId,
        parentId,
        fileIds
    });

    const message = await prisma.directMessage.create({
        data: {
            content,
            senderId,
            receiverId,
            parentId,
            ...(fileIds && {
                files: {
                    connect: fileIds.map(id => ({ id }))
                }
            })
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
                }
            }
        }
    });

    // Format reactions like we do for other messages
    const formattedMessage = {
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
    };

    // Create a unique room ID for this DM conversation
    const dmRoomId = [senderId, receiverId].sort().join(':');

    console.log('[DirectMessageService] Emitting message to room:', `dm:${dmRoomId}`, {
        messageId: formattedMessage.id,
        reactionCount: formattedMessage.reactions.length
    });

    // Emit different events based on whether it's a reply or not
    if (parentId) {
        io.emit('new_reply', formattedMessage);
    } else {
        io.to(`dm:${dmRoomId}`).emit('new_dm', formattedMessage);
    }

    return formattedMessage;
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