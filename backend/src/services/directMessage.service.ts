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
                    }
                }
            }
        }
    });

    // Create a unique room ID for this DM conversation
    const dmRoomId = [senderId, receiverId].sort().join(':');

    // Emit different events based on whether it's a reply or not
    if (parentId) {
        io.emit('new_reply', message);
    } else {
        io.to(`dm:${dmRoomId}`).emit('new_dm', message);
    }

    return message;
}

export async function getDirectMessages(userId: string, otherUserId: string) {
    console.log(`Fetching DMs between users ${userId} and ${otherUserId}`);

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
                    files: true
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

    console.log('Messages from DB (ordered by createdAt asc):',
        messages.map(m => ({
            id: m.id,
            content: m.content ? m.content.substring(0, 20) + '...' : '[no content]',
            createdAt: m.createdAt,
            timestamp: new Date(m.createdAt).getTime(),
            replyCount: m.replies?.length || 0
        }))
    );

    return messages;
}

export async function getThreadMessages(messageId: string) {
    return await prisma.directMessage.findMany({
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
            files: true
        },
        orderBy: {
            createdAt: 'asc'
        }
    });
} 