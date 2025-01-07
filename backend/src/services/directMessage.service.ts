import { PrismaClient } from "@prisma/client";
import { io } from '../socket/socket.service';

const prisma = new PrismaClient();

export async function createDirectMessage(
    content: string,
    senderId: string,
    receiverId: string
) {
    const message = await prisma.directMessage.create({
        data: {
            content,
            senderId,
            receiverId,
        },
        include: {
            sender: {
                select: {
                    id: true,
                    name: true,
                    email: true,
                    avatarUrl: true,
                },
            },
            receiver: {
                select: {
                    id: true,
                    name: true,
                    email: true,
                    avatarUrl: true,
                },
            },
        },
    });

    // Emit to both sender and receiver
    io.to(senderId).to(receiverId).emit('new_dm', message);
    return message;
}

export async function getDirectMessages(userId: string, otherUserId: string) {
    return await prisma.directMessage.findMany({
        where: {
            OR: [
                { AND: [{ senderId: userId }, { receiverId: otherUserId }] },
                { AND: [{ senderId: otherUserId }, { receiverId: userId }] },
            ],
        },
        include: {
            sender: {
                select: {
                    id: true,
                    name: true,
                    email: true,
                    avatarUrl: true,
                },
            },
            receiver: {
                select: {
                    id: true,
                    name: true,
                    email: true,
                    avatarUrl: true,
                },
            },
        },
        orderBy: {
            createdAt: 'asc',
        },
    });
} 