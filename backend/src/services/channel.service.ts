import { PrismaClient, Channel, ChannelType } from "@prisma/client";
import { getIO } from '../socket/socket.service';

const prisma = new PrismaClient();

interface CreateChannelData {
    name: string;
    userId: string;
    type?: ChannelType;
}

export async function createChannel(data: CreateChannelData) {
    console.log('[ChannelService] Creating channel with data:', {
        name: data.name,
        type: data.type,
        userId: data.userId
    });

    try {
        const channel = await prisma.channel.create({
            data: {
                name: data.name,
                type: data.type || "PUBLIC",
                creator: {
                    connect: { id: data.userId }
                },
                members: {
                    connect: [{ id: data.userId }]
                }
            },
            include: {
                members: true,
                creator: true
            }
        });

        console.log('[ChannelService] Successfully created channel:', {
            id: channel.id,
            name: channel.name,
            type: channel.type
        });

        // Emit socket event for new channel
        getIO().emit('new_channel', channel);

        return channel;
    } catch (error) {
        console.error('[ChannelService] Error in channel creation:', {
            error,
            data: {
                name: data.name,
                type: data.type,
                userId: data.userId
            }
        });
        throw error;
    }
}

export async function getChannelById(channelId: string) {
    return await prisma.channel.findUnique({
        where: { id: channelId },
        include: {
            members: true,
            messages: {
                include: {
                    user: true
                },
                orderBy: {
                    createdAt: 'desc'
                },
                take: 50
            }
        }
    });
}

export async function getUserChannels(userId: string) {
    return await prisma.channel.findMany({
        where: {
            OR: [
                { type: "PUBLIC" },  // All public channels
                {
                    members: {
                        some: { id: userId }
                    }
                }
            ]
        },
        include: {
            members: {
                select: {
                    id: true,
                    email: true,
                    name: true,
                    avatarUrl: true
                }
            },
            creator: {
                select: {
                    id: true,
                    email: true,
                    name: true
                }
            },
            _count: {
                select: { messages: true }
            }
        },
        orderBy: {
            createdAt: 'desc'
        }
    });
}

export async function addMemberToChannel(channelId: string, userId: string) {
    return await prisma.channel.update({
        where: { id: channelId },
        data: {
            members: {
                connect: { id: userId }
            }
        },
        include: {
            members: true
        }
    });
}

export async function removeMemberFromChannel(channelId: string, userId: string) {
    return await prisma.channel.update({
        where: { id: channelId },
        data: {
            members: {
                disconnect: { id: userId }
            }
        }
    });
}

// Add this to get all available users for DMs
export async function getAvailableUsers(currentUserId: string) {
    return await prisma.user.findMany({
        where: {
            NOT: {
                id: currentUserId
            }
        },
        select: {
            id: true,
            name: true,
            email: true,
            avatarUrl: true,
            status: true
        }
    });
}

export async function getChannelMessages(channelId: string, userId: string) {
    const messages = await prisma.message.findMany({
        where: {
            channelId,
            parentId: null // Only get top-level messages
        },
        include: {
            user: {
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
                    user: {
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
        orderBy: {
            createdAt: 'desc'
        }
    });

    // Transform reactions into the expected format
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

    return formattedMessages;
}

export async function getThreadMessages(messageId: string, userId: string) {
    const messages = await prisma.message.findMany({
        where: {
            parentId: messageId
        },
        include: {
            user: {
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

    // Transform reactions into the expected format
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

    return formattedMessages;
} 