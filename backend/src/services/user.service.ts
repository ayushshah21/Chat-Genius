import { PrismaClient } from "@prisma/client";
import { io } from '../socket/socket.service';

const prisma = new PrismaClient();

export async function updateUserStatus(userId: string, status: string) {
    console.log(`[UserService] Updating status for user ${userId} to ${status}`);
    const user = await prisma.user.update({
        where: { id: userId },
        data: { status },
        select: {
            id: true,
            email: true,
            name: true,
            avatarUrl: true,
            status: true,
        }
    });

    console.log(`[UserService] Broadcasting status update for user ${userId}:`, user);
    // Broadcast the status update to all connected clients
    io.emit('user.status', user);
    return user;
}

export async function getUserById(userId: string) {
    console.log(`[UserService] Fetching user ${userId}`);
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
            id: true,
            email: true,
            name: true,
            avatarUrl: true,
            status: true,
        }
    });
    console.log(`[UserService] Found user:`, user);
    return user;
}
