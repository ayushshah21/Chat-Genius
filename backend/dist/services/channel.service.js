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
exports.createChannel = createChannel;
exports.getChannelById = getChannelById;
exports.getUserChannels = getUserChannels;
exports.addMemberToChannel = addMemberToChannel;
exports.removeMemberFromChannel = removeMemberFromChannel;
exports.getAvailableUsers = getAvailableUsers;
const client_1 = require("@prisma/client");
const socket_service_1 = require("../socket/socket.service");
const prisma = new client_1.PrismaClient();
function createChannel(name_1, type_1, createdById_1) {
    return __awaiter(this, arguments, void 0, function* (name, type, createdById, memberIds = []) {
        const channel = yield prisma.channel.create({
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
        socket_service_1.io.emit('new_channel', channel);
        return channel;
    });
}
function getChannelById(channelId) {
    return __awaiter(this, void 0, void 0, function* () {
        return yield prisma.channel.findUnique({
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
    });
}
function getUserChannels(userId) {
    return __awaiter(this, void 0, void 0, function* () {
        return yield prisma.channel.findMany({
            where: {
                OR: [
                    { type: "PUBLIC" }, // All public channels
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
    });
}
function addMemberToChannel(channelId, userId) {
    return __awaiter(this, void 0, void 0, function* () {
        return yield prisma.channel.update({
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
    });
}
function removeMemberFromChannel(channelId, userId) {
    return __awaiter(this, void 0, void 0, function* () {
        return yield prisma.channel.update({
            where: { id: channelId },
            data: {
                members: {
                    disconnect: { id: userId }
                }
            }
        });
    });
}
// Add this to get all available users for DMs
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
                status: true
            }
        });
    });
}
