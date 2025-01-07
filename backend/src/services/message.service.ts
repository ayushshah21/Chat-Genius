import { PrismaClient } from "@prisma/client";
import { io } from '../socket/socket.service';

const prisma = new PrismaClient();

export async function createMessage(
    content: string,
    channelId: string,
    userId: string,
    parentId?: string
) {
    const message = await prisma.message.create({
        data: {
            content,
            channelId,
            userId,
            parentId
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
            replies: true
        }
    });

    // Emit different events based on whether it's a reply or not
    if (parentId) {
        io.emit('new_reply', message);
    } else {
        io.to(channelId).emit('new_message', message);
    }

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
                    avatarUrl: true,
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
                    }
                }
            }
        },
        orderBy: {
            createdAt: 'asc'
        }
    });
}

export async function getThreadMessages(messageId: string) {
    return await prisma.message.findMany({
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
            }
        },
        orderBy: {
            createdAt: 'asc'
        }
    });
} 