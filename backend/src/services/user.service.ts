import { PrismaClient } from "@prisma/client";
import { getIO } from '../socket/socket.service';

const prisma = new PrismaClient();

interface UpdateUserProfileData {
    name?: string | null;
    email?: string;
    avatarUrl?: string | null;
}

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
    getIO().emit('user.status', user);
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

export async function getUserProfile(userId: string) {
    console.log(`[UserService] Fetching user profile for ${userId}`);
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
            id: true,
            email: true,
            name: true,
            avatarUrl: true,
            status: true,
            googleId: true,
            createdAt: true,
            updatedAt: true,
        }
    });
    console.log(`[UserService] Found user profile:`, user);
    return user;
}

export async function updateUserProfile(userId: string, data: UpdateUserProfileData) {
    console.log(`[UserService] Updating profile for user ${userId}:`, data);
    const user = await prisma.user.update({
        where: { id: userId },
        data,
        select: {
            id: true,
            email: true,
            name: true,
            avatarUrl: true,
            status: true,
            googleId: true,
            createdAt: true,
            updatedAt: true,
        }
    });
    console.log(`[UserService] Updated user profile:`, user);
    return user;
}

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
