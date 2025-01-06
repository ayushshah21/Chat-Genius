import { PrismaClient, Channel } from "@prisma/client";

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
            members: {
                some: {
                    id: userId
                }
            }
        },
        include: {
            members: true,
            _count: {
                select: { messages: true }
            }
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