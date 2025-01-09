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
    return await prisma.message.findMany({
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
                    avatarUrl: true
                }
            },
            files: true,
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
                    files: true
                }
            }
        },
        orderBy: {
            createdAt: 'desc'
        }
    });
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
            files: true
        },
        orderBy: {
            createdAt: 'asc'
        }
    });
} 