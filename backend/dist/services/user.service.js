"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateUserStatus = updateUserStatus;
exports.getUserById = getUserById;
exports.getUserProfile = getUserProfile;
exports.updateUserProfile = updateUserProfile;
exports.getAvailableUsers = getAvailableUsers;
const client_1 = require("@prisma/client");
const socket_service_1 = require("../socket/socket.service");
const prisma = new client_1.PrismaClient();
function updateUserStatus(userId, status) {
    return __awaiter(this, void 0, void 0, function* () {
        console.log(`[UserService] Updating status for user ${userId} to ${status}`);
        const user = yield prisma.user.update({
            where: { id: userId },
            data: { status },
            select: {
                id: true,
                email: true,
                name: true,
                avatarUrl: true,
                status: true,
                autoReplyEnabled: true,
            }
        });
        console.log(`[UserService] Broadcasting status update for user ${userId}:`, user);
        // Broadcast the status update to all connected clients
        (0, socket_service_1.getIO)().emit('user.status', user);
        return user;
    });
}
function getUserById(userId) {
    return __awaiter(this, void 0, void 0, function* () {
        console.log(`[UserService] Fetching user ${userId}`);
        const user = yield prisma.user.findUnique({
            where: { id: userId },
            select: {
                id: true,
                email: true,
                name: true,
                avatarUrl: true,
                status: true,
                autoReplyEnabled: true,
            }
        });
        console.log(`[UserService] Found user:`, user);
        return user;
    });
}
function getUserProfile(userId) {
    return __awaiter(this, void 0, void 0, function* () {
        console.log(`[UserService] Fetching user profile for ${userId}`);
        const user = yield prisma.user.findUnique({
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
                autoReplyEnabled: true,
            }
        });
        console.log(`[UserService] Found user profile:`, user);
        return user;
    });
}
function updateUserProfile(userId, data) {
    return __awaiter(this, void 0, void 0, function* () {
        console.log(`[UserService] Updating profile for user ${userId}:`, data);
        const user = yield prisma.user.update({
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
                autoReplyEnabled: true,
            }
        });
        console.log(`[UserService] Updated user profile:`, user);
        return user;
    });
}
function getAvailableUsers(currentUserId) {
    return __awaiter(this, void 0, void 0, function* () {
        return yield prisma.user.findMany({
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
                status: true,
                autoReplyEnabled: true,
            }
        });
    });
}
