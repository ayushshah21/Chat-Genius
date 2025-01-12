import { PrismaClient, Channel } from "@prisma/client";
import { getIO } from '../socket/socket.service';

const prisma = new PrismaClient();

export async function createChannel(data: any) {
    const channel = await prisma.channel.create({
        data: {
            name: data.name,
            type: data.type || 'PUBLIC',
            creator: {
                connect: { id: data.userId }
            },
            members: {
                connect: [{ id: data.userId }]
            }
        },
        include: {
            creator: true,
            members: true
        }
    });

    // Emit socket event for new channel
    getIO().emit('new_channel', channel);

    return channel;
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