import { PrismaClient, Channel } from "@prisma/client";
import { io } from '../socket/socket.service';

const prisma = new PrismaClient();

export async function createChannel(
    name: string,
    type: "PUBLIC" | "PRIVATE" | "DM",
    createdById: string,
    memberIds: string[] = []
) {
    const channel = await prisma.channel.create({
        data: {
            name,
            type,
            createdBy: createdById,
            members: {
                connect: [...memberIds, createdById].map(id => ({ id }))
            }
        },
        include: {
            members: true,
            creator: true
        }
    });

    // Emit the new channel to all connected clients
    console.log('Channel Service: Broadcasting new channel:', channel.name);
    io.emit('new_channel', channel);

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

export async function createDMChannel(userId: string, otherUserId: string) {
    console.log("Channel Service: Creating DM channel", { userId, otherUserId });

    // First check if DM channel already exists between these users
    const existingDM = await prisma.channel.findFirst({
        where: {
            type: "DM",
            AND: [
                { members: { some: { id: userId } } },
                { members: { some: { id: otherUserId } } }
            ]
        },
        include: {
            members: {
                select: {
                    id: true,
                    name: true,
                    avatarUrl: true
                }
            }
        }
    });

    if (existingDM) {
        console.log("Channel Service: Found existing DM channel:", existingDM);
        return existingDM;
    }

    console.log("Channel Service: No existing DM channel found, creating new one");

    // Create new DM channel
    const channel = await prisma.channel.create({
        data: {
            name: "dm", // Will be overridden in UI with user names
            type: "DM",
            createdBy: userId,
            isPrivate: true,
            members: {
                connect: [
                    { id: userId },
                    { id: otherUserId }
                ]
            }
        },
        include: {
            members: {
                select: {
                    id: true,
                    name: true,
                    avatarUrl: true
                }
            }
        }
    });

    console.log("Channel Service: Created new DM channel:", channel);
    io.emit('new_channel', channel);
    return channel;
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