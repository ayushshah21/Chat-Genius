import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function createMessage(
    content: string,
    channelId: string,
    userId: string,
    parentId?: string
) {
    return await prisma.message.create({
        data: {
            content,
            channel: {
                connect: { id: channelId }
            },
            user: {
                connect: { id: userId }
            },
            ...(parentId ? { parent: { connect: { id: parentId } } } : {}),
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
}

export async function getChannelMessages(channelId: string, limit = 50) {
    return await prisma.message.findMany({
        where: {
            channelId,
            parentId: null,
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
            replies: {
                include: {
                    user: true,
                },
            },
        },
        orderBy: {
            createdAt: "asc",
        },
        take: limit,
    });
} 