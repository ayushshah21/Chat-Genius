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
exports.getChannelMessages = getChannelMessages;
exports.getThreadMessages = getThreadMessages;
const client_1 = require("@prisma/client");
const socket_service_1 = require("../socket/socket.service");
const prisma = new client_1.PrismaClient();
function createChannel(data) {
    return __awaiter(this, void 0, void 0, function* () {
        console.log('[ChannelService] Creating channel with data:', {
            name: data.name,
            type: data.type,
            userId: data.userId
        });
        try {
            const channel = yield prisma.channel.create({
                data: {
                    name: data.name,
                    type: data.type || "PUBLIC",
                    creator: {
                        connect: { id: data.userId }
                    },
                    members: {
                        connect: [{ id: data.userId }]
                    }
                },
                include: {
                    members: true,
                    creator: true
                }
            });
            console.log('[ChannelService] Successfully created channel:', {
                id: channel.id,
                name: channel.name,
                type: channel.type
            });
            // Emit socket event for new channel
            (0, socket_service_1.getIO)().emit('new_channel', channel);
            return channel;
        }
        catch (error) {
            console.error('[ChannelService] Error in channel creation:', {
                error,
                data: {
                    name: data.name,
                    type: data.type,
                    userId: data.userId
                }
            });
            throw error;
        }
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
function getChannelMessages(channelId, userId) {
    return __awaiter(this, void 0, void 0, function* () {
        const messages = yield prisma.message.findMany({
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
                files: true,
                reactions: {
                    include: {
                        user: {
                            select: {
                                id: true,
                                name: true,
                                email: true,
                                avatarUrl: true
                            }
                        }
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
                        },
                        files: true,
                        reactions: {
                            include: {
                                user: {
                                    select: {
                                        id: true,
                                        name: true,
                                        email: true,
                                        avatarUrl: true
                                    }
                                }
                            }
                        }
                    },
                    orderBy: {
                        createdAt: 'asc'
                    }
                }
            },
            orderBy: {
                createdAt: 'desc'
            }
        });
        // Transform reactions into the expected format
        const formattedMessages = messages.map(message => (Object.assign(Object.assign({}, message), { reactions: message.reactions.reduce((acc, reaction) => {
                const existingReaction = acc.find(r => r.emoji === reaction.emoji);
                if (existingReaction) {
                    existingReaction.users.push(reaction.user);
                }
                else {
                    acc.push({
                        emoji: reaction.emoji,
                        users: [reaction.user]
                    });
                }
                return acc;
            }, []), replies: message.replies.map(reply => (Object.assign(Object.assign({}, reply), { reactions: reply.reactions.reduce((acc, reaction) => {
                    const existingReaction = acc.find(r => r.emoji === reaction.emoji);
                    if (existingReaction) {
                        existingReaction.users.push(reaction.user);
                    }
                    else {
                        acc.push({
                            emoji: reaction.emoji,
                            users: [reaction.user]
                        });
                    }
                    return acc;
                }, []) }))) })));
        return formattedMessages;
    });
}
function getThreadMessages(messageId, userId) {
    return __awaiter(this, void 0, void 0, function* () {
        const messages = yield prisma.message.findMany({
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
                },
                files: true,
                reactions: {
                    include: {
                        user: {
                            select: {
                                id: true,
                                name: true,
                                email: true,
                                avatarUrl: true
                            }
                        }
                    }
                }
            },
            orderBy: {
                createdAt: 'asc'
            }
        });
        // Transform reactions into the expected format
        const formattedMessages = messages.map(message => (Object.assign(Object.assign({}, message), { reactions: message.reactions.reduce((acc, reaction) => {
                const existingReaction = acc.find(r => r.emoji === reaction.emoji);
                if (existingReaction) {
                    existingReaction.users.push(reaction.user);
                }
                else {
                    acc.push({
                        emoji: reaction.emoji,
                        users: [reaction.user]
                    });
                }
                return acc;
            }, []) })));
        return formattedMessages;
    });
}
