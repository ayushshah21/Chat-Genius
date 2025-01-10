import { Server } from 'socket.io';
import { createMessage } from '../services/message.service';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import * as userService from '../services/user.service';
import * as reactionService from '../services/reaction.service';
import * as messageService from '../services/message.service';

const prisma = new PrismaClient();

// Keep track of disconnect timeouts and connected users
const disconnectTimeouts: Record<string, NodeJS.Timeout> = {};
const connectedUsers: Set<string> = new Set();
const OFFLINE_TIMEOUT = 10000; // 10 seconds

export let io: Server;

export function setupSocketIO(server: Server) {
    io = server;

    io.on('connection', async (socket) => {
        // Keep essential connection log
        console.log('Socket connected:', socket.id);

        // Handle user presence on connection
        try {
            const token = socket.handshake.auth.token;
            if (token) {
                const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { userId: string };

                if (disconnectTimeouts[decoded.userId]) {
                    clearTimeout(disconnectTimeouts[decoded.userId]);
                    delete disconnectTimeouts[decoded.userId];
                }

                if (!connectedUsers.has(decoded.userId)) {
                    await userService.updateUserStatus(decoded.userId, 'online');
                }

                connectedUsers.add(decoded.userId);
                socket.data.userId = decoded.userId;
            }
        } catch (error) {
            console.error('[Presence] Error handling user presence:', error);
        }

        // Join a channel
        socket.on('join_channel', (channelId: string) => {
            socket.join(channelId);
            socket.join(`channel_${channelId}`);
            socket.emit('channel_joined', channelId);
        });

        // Leave a channel
        socket.on('leave_channel', (channelId: string) => {
            socket.leave(channelId);
            socket.leave(`channel_${channelId}`);
        });

        // New message
        socket.on('send_message', async (data: {
            content: string | null;
            channelId: string;
            parentId?: string;
        }) => {
            const token = socket.handshake.auth.token;
            if (!token) {
                socket.emit('message_error', { error: 'Authentication required' });
                return;
            }

            try {
                const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { userId: string };

                // Ensure socket is in both channel rooms before allowing message
                if (!socket.rooms.has(data.channelId)) {
                    socket.join(data.channelId); // Auto-join if not in room
                }
                if (!socket.rooms.has(`channel_${data.channelId}`)) {
                    socket.join(`channel_${data.channelId}`); // Auto-join reaction room
                }

                const message = await createMessage(
                    data.content,
                    data.channelId,
                    decoded.userId,
                    data.parentId
                );

                // Broadcast to all clients in the channel, including sender
                if (data.parentId) {
                    io.emit('new_reply', message);
                } else {
                    io.to(data.channelId).emit('new_message', message);
                }
            } catch (error) {
                console.error('Error sending message:', error);
                socket.emit('message_error', { error: 'Failed to send message' });
            }
        });

        // Typing indicator
        socket.on('typing_start', (data: { channelId: string; userId: string }) => {
            socket.to(data.channelId).emit('user_typing', { userId: data.userId });
        });

        socket.on('typing_stop', (data: { channelId: string; userId: string }) => {
            socket.to(data.channelId).emit('user_stop_typing', { userId: data.userId });
        });

        // Handle explicit logout
        socket.on('logout', async () => {
            if (socket.data.userId) {
                console.log(`[Presence] User ${socket.data.userId} logged out`);
                // Clear any existing timeout
                if (disconnectTimeouts[socket.data.userId]) {
                    clearTimeout(disconnectTimeouts[socket.data.userId]);
                    delete disconnectTimeouts[socket.data.userId];
                }
                // Force offline status immediately
                await userService.updateUserStatus(socket.data.userId, 'offline');
                connectedUsers.delete(socket.data.userId);
                console.log(`[Presence] Updated connected users after logout:`, Array.from(connectedUsers));
            }
        });

        // Handle user presence on disconnection
        socket.on('disconnect', async () => {
            console.log(`[Presence] Socket ${socket.id} disconnected`);
            if (socket.data.userId) {
                console.log(`[Presence] Starting disconnect timeout for user ${socket.data.userId}`);

                // Set a timeout before marking the user as offline
                disconnectTimeouts[socket.data.userId] = setTimeout(async () => {
                    try {
                        // Check if the user has another active connection
                        if (!connectedUsers.has(socket.data.userId)) {
                            console.log(`[Presence] Marking user ${socket.data.userId} as offline`);
                            await userService.updateUserStatus(socket.data.userId, 'offline');
                        } else {
                            console.log(`[Presence] User ${socket.data.userId} still has active connections`);
                        }
                        delete disconnectTimeouts[socket.data.userId];
                    } catch (error) {
                        console.error('[Presence] Error updating user status on disconnect:', error);
                    }
                }, OFFLINE_TIMEOUT);

                connectedUsers.delete(socket.data.userId);
                console.log(`[Presence] Updated connected users:`, Array.from(connectedUsers));
            }
        });

        // Manual status update handler
        socket.on('update_status', async (status: string) => {
            if (socket.data.userId) {
                try {
                    await userService.updateUserStatus(socket.data.userId, status);
                } catch (error) {
                    console.error('Error updating user status:', error);
                }
            }
        });

        socket.on('create_channel', async (channel) => {
            console.log('Socket: Received create_channel event:', channel);
            io.emit('new_channel', channel);
            console.log('Socket: Emitted new_channel event to all clients');
        });

        socket.on('join_dm', (otherUserId: string) => {
            const token = socket.handshake.auth.token;
            if (!token) return;

            try {
                const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { userId: string };
                // Create a unique room ID for this DM conversation
                const dmRoomId = [decoded.userId, otherUserId].sort().join(':');
                socket.join(`dm:${dmRoomId}`);
                console.log(`User ${decoded.userId} joined DM room ${dmRoomId}`);
            } catch (error) {
                console.error('Error joining DM room:', error);
            }
        });

        socket.on('leave_dm', (otherUserId: string) => {
            const token = socket.handshake.auth.token;
            if (!token) return;

            try {
                const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { userId: string };
                // Create a unique room ID for this DM conversation
                const dmRoomId = [decoded.userId, otherUserId].sort().join(':');
                socket.leave(`dm:${dmRoomId}`);
                console.log(`User ${decoded.userId} left DM room ${dmRoomId}`);
            } catch (error) {
                console.error('Error leaving DM room:', error);
            }
        });

        socket.on('send_dm', async (data: {
            content: string;
            receiverId: string;
            parentId?: string;
            fileIds?: string[];
        }) => {
            const token = socket.handshake.auth.token;
            if (!token) {
                socket.emit('message_error', { error: 'Authentication required' });
                return;
            }

            try {
                const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { userId: string };
                const message = await prisma.directMessage.create({
                    data: {
                        content: data.content,
                        senderId: decoded.userId,
                        receiverId: data.receiverId,
                        parentId: data.parentId,
                        ...(data.fileIds && {
                            files: {
                                connect: data.fileIds.map(id => ({ id }))
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
                        files: true
                    }
                });

                // Create a unique room ID for this DM conversation
                const dmRoomId = [decoded.userId, data.receiverId].sort().join(':');

                // Emit different events based on whether it's a reply or not
                if (data.parentId) {
                    io.emit('new_reply', message);
                } else {
                    io.to(`dm:${dmRoomId}`).emit('new_dm', message);
                }

                return message;
            } catch (error) {
                console.error('Error sending DM:', error);
                socket.emit('message_error', { error: 'Failed to send message' });
            }
        });

        // Handle file upload notification
        socket.on('file_upload_complete', async (data: {
            channelId?: string,
            dmUserId?: string,
            fileId: string,
            size: number,
            messageId?: string,
            parentId?: string
        }) => {
            try {
                console.log('[SocketService] Received file_upload_complete:', data);

                if (!data.fileId) {
                    console.error('[SocketService] Missing fileId in file_upload_complete event');
                    return;
                }

                // Update file size
                const updatedFile = await prisma.file.update({
                    where: { id: data.fileId },
                    data: { size: data.size },
                    include: {
                        message: {
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
                                parent: true,
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
                            }
                        },
                        directMessage: {
                            include: {
                                sender: {
                                    select: {
                                        id: true,
                                        name: true,
                                        email: true,
                                        avatarUrl: true
                                    }
                                },
                                receiver: {
                                    select: {
                                        id: true,
                                        name: true,
                                        email: true,
                                        avatarUrl: true
                                    }
                                },
                                files: true,
                                parent: true,
                                replies: {
                                    include: {
                                        sender: {
                                            select: {
                                                id: true,
                                                name: true,
                                                email: true,
                                                avatarUrl: true
                                            }
                                        },
                                        receiver: {
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
                            }
                        }
                    }
                });

                if (data.channelId && updatedFile.message) {
                    // Handle channel message
                    const message = updatedFile.message;
                    // If it's a thread reply, emit new_reply event
                    if (message.parentId) {
                        io.emit('new_reply', {
                            ...message,
                            parentMessage: message.parent
                        });
                    } else {
                        // Otherwise emit to the channel
                        io.to(data.channelId).emit('new_message', message);
                    }
                } else if (data.dmUserId && updatedFile.directMessage) {
                    // Handle DM message
                    const dm = updatedFile.directMessage;
                    // Create a unique room ID for this DM conversation
                    const dmRoomId = [dm.sender.id, dm.receiver.id].sort().join(':');
                    const roomId = `dm:${dmRoomId}`;

                    console.log('[SocketService] Emitting DM file update to room:', {
                        roomId,
                        messageId: dm.id,
                        hasFiles: dm.files?.length > 0,
                        isReply: !!dm.parentId
                    });

                    // If it's a thread reply, emit new_reply event
                    if (dm.parentId && dm.parent) {
                        io.emit('new_reply', {
                            ...dm,
                            parentMessage: dm.parent
                        });
                    } else {
                        // Otherwise emit to the DM room
                        io.to(roomId).emit('new_dm', dm);
                    }
                }
            } catch (error) {
                console.error('[SocketService] Error in file_upload_complete:', error);
            }
        });

        // Add reaction to message
        socket.on("add_reaction", async (data: { emoji: string; messageId: string; isDM: boolean }) => {
            try {
                console.log("[SocketService] Received add_reaction:", {
                    emoji: data.emoji,
                    messageId: data.messageId,
                    isDM: data.isDM,
                    userId: socket.data.userId
                });

                // First check if message exists
                let messageExists = false;
                let messageDetails = null;
                let isActuallyDM = data.isDM;  // Track the actual message type

                if (data.isDM) {
                    messageDetails = await prisma.directMessage.findUnique({
                        where: { id: data.messageId },
                        include: {
                            sender: { select: { id: true } },
                            receiver: { select: { id: true } },
                        },
                    });
                    console.log("[SocketService] DM lookup result:", {
                        messageId: data.messageId,
                        found: !!messageDetails,
                        details: messageDetails
                    });
                    messageExists = !!messageDetails;
                } else {
                    messageDetails = await prisma.message.findUnique({
                        where: { id: data.messageId },
                        include: { channel: true },
                    });
                    console.log("[SocketService] Channel message lookup result:", {
                        messageId: data.messageId,
                        found: !!messageDetails,
                        details: messageDetails
                    });
                    messageExists = !!messageDetails;
                }

                if (!messageExists) {
                    // Try the opposite table as a fallback
                    if (data.isDM) {
                        messageDetails = await prisma.message.findUnique({
                            where: { id: data.messageId },
                            include: { channel: true },
                        });
                        if (messageDetails) isActuallyDM = false;
                    } else {
                        messageDetails = await prisma.directMessage.findUnique({
                            where: { id: data.messageId },
                            include: {
                                sender: { select: { id: true } },
                                receiver: { select: { id: true } },
                            },
                        });
                        if (messageDetails) isActuallyDM = true;
                    }
                    console.log("[SocketService] Fallback lookup result:", {
                        messageId: data.messageId,
                        isDM: data.isDM,
                        isActuallyDM,
                        found: !!messageDetails,
                        details: messageDetails
                    });

                    if (messageDetails) {
                        console.log("[SocketService] Found message in opposite table than expected. Adjusting isDM flag.");
                    }
                }

                if (!messageExists && !messageDetails) {
                    throw new Error("Message not found");
                }

                // Add the reaction using the appropriate service method based on where we found the message
                const reaction = await reactionService.addReaction(
                    data.emoji,
                    socket.data.userId,
                    isActuallyDM ? undefined : data.messageId,
                    isActuallyDM ? data.messageId : undefined
                );

                console.log("[SocketService] Successfully added reaction:", {
                    emoji: data.emoji,
                    messageId: data.messageId,
                    isDM: isActuallyDM,
                    reactionId: reaction.id
                });

                // Emit to the appropriate room based on where we found the message
                if (isActuallyDM && messageDetails) {
                    const dmMessage = messageDetails as any;
                    const dmRoomId = [dmMessage.sender.id, dmMessage.receiver.id].sort().join(':');

                    // Get all reactions for this message
                    const allReactions = await prisma.emojiReaction.findMany({
                        where: { directMessageId: data.messageId },
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

                    io.to(`dm:${dmRoomId}`).emit("dm_reaction_added", {
                        messageId: data.messageId,
                        reactions: allReactions,
                    });

                    console.log("[SocketService] Emitting dm_reaction_added:", {
                        messageId: data.messageId,
                        reactionCount: allReactions.length,
                        dmRoomId
                    });
                } else if (!isActuallyDM && messageDetails) {
                    const channelMessage = messageDetails as any;
                    const channelRoom = `channel_${channelMessage.channel.id}`;

                    // Get all reactions for this message
                    const allReactions = await prisma.emojiReaction.findMany({
                        where: { messageId: data.messageId },
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

                    // Emit to the channel room with the correct format
                    io.to(`channel_${channelMessage.channel.id}`).emit("message_reaction_added", {
                        messageId: data.messageId,
                        reactions: allReactions,
                    });

                    console.log("[SocketService] Emitting message_reaction_added:", {
                        messageId: data.messageId,
                        reactionCount: allReactions.length,
                        channelRoom: `channel_${channelMessage.channel.id}`
                    });
                }
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
                console.error("[SocketService] Error adding reaction:", {
                    error: errorMessage,
                    emoji: data.emoji,
                    messageId: data.messageId,
                    isDM: data.isDM,
                    stack: error instanceof Error ? error.stack : undefined
                });
                socket.emit("error", { message: errorMessage });
            }
        });

        // Remove reaction from message
        socket.on("remove_reaction", async (data: { emoji: string; messageId: string; isDM: boolean }) => {
            try {
                console.log("[SocketService] Received remove_reaction:", {
                    emoji: data.emoji,
                    messageId: data.messageId,
                    isDM: data.isDM,
                    userId: socket.data.userId
                });

                // First check if message exists
                let messageExists = false;
                let messageDetails = null;
                let isActuallyDM = data.isDM;  // Track the actual message type

                if (data.isDM) {
                    messageDetails = await prisma.directMessage.findUnique({
                        where: { id: data.messageId },
                        include: {
                            sender: { select: { id: true } },
                            receiver: { select: { id: true } },
                        },
                    });
                    console.log("[SocketService] DM lookup result:", {
                        messageId: data.messageId,
                        found: !!messageDetails,
                        details: messageDetails
                    });
                    messageExists = !!messageDetails;
                } else {
                    messageDetails = await prisma.message.findUnique({
                        where: { id: data.messageId },
                        include: { channel: true },
                    });
                    console.log("[SocketService] Channel message lookup result:", {
                        messageId: data.messageId,
                        found: !!messageDetails,
                        details: messageDetails
                    });
                    messageExists = !!messageDetails;
                }

                if (!messageExists) {
                    // Try the opposite table as a fallback
                    if (data.isDM) {
                        messageDetails = await prisma.message.findUnique({
                            where: { id: data.messageId },
                            include: { channel: true },
                        });
                        if (messageDetails) isActuallyDM = false;
                    } else {
                        messageDetails = await prisma.directMessage.findUnique({
                            where: { id: data.messageId },
                            include: {
                                sender: { select: { id: true } },
                                receiver: { select: { id: true } },
                            },
                        });
                        if (messageDetails) isActuallyDM = true;
                    }
                    console.log("[SocketService] Fallback lookup result:", {
                        messageId: data.messageId,
                        isDM: data.isDM,
                        isActuallyDM,
                        found: !!messageDetails,
                        details: messageDetails
                    });

                    if (messageDetails) {
                        console.log("[SocketService] Found message in opposite table than expected. Adjusting isDM flag.");
                    }
                }

                if (!messageExists && !messageDetails) {
                    throw new Error("Message not found");
                }

                // Remove the reaction using the appropriate service method
                const reaction = await reactionService.removeReaction(
                    data.emoji,
                    socket.data.userId,
                    isActuallyDM ? undefined : data.messageId,
                    isActuallyDM ? data.messageId : undefined
                );

                console.log("[SocketService] Successfully removed reaction:", {
                    emoji: data.emoji,
                    messageId: data.messageId,
                    isDM: isActuallyDM,
                });

                // Emit to the appropriate room based on where we found the message
                if (isActuallyDM && messageDetails) {
                    const dmMessage = messageDetails as any;
                    const dmRoomId = [dmMessage.sender.id, dmMessage.receiver.id].sort().join(':');

                    // Get all remaining reactions for this message
                    const allReactions = await prisma.emojiReaction.findMany({
                        where: { directMessageId: data.messageId },
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

                    io.to(`dm:${dmRoomId}`).emit("dm_reaction_removed", {
                        messageId: data.messageId,
                        reactions: allReactions,
                    });

                    console.log("[SocketService] Emitting dm_reaction_removed:", {
                        messageId: data.messageId,
                        reactionCount: allReactions.length,
                        dmRoomId
                    });
                } else if (!isActuallyDM && messageDetails) {
                    const channelMessage = messageDetails as any;
                    const channelRoom = `channel_${channelMessage.channel.id}`;

                    // Get all remaining reactions for this message
                    const allReactions = await prisma.emojiReaction.findMany({
                        where: { messageId: data.messageId },
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

                    io.to(channelRoom).emit("message_reaction_removed", {
                        messageId: data.messageId,
                        reactions: allReactions,
                    });

                    console.log("[SocketService] Emitting message_reaction_removed:", {
                        messageId: data.messageId,
                        reactionCount: allReactions.length,
                        channelRoom
                    });
                }
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
                console.error("[SocketService] Error removing reaction:", {
                    error: errorMessage,
                    emoji: data.emoji,
                    messageId: data.messageId,
                    isDM: data.isDM,
                    stack: error instanceof Error ? error.stack : undefined
                });
                socket.emit("error", { message: errorMessage });
            }
        });

        // Delete message
        socket.on('delete_message', async (data: { messageId: string, channelId?: string, isDM: boolean }) => {
            try {
                const token = socket.handshake.auth.token;
                if (!token) {
                    socket.emit('error', { message: 'Authentication required' });
                    return;
                }

                const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { userId: string };

                if (data.isDM) {
                    const dm = await prisma.directMessage.findUnique({
                        where: { id: data.messageId },
                        select: {
                            senderId: true,
                            receiverId: true,
                            parentId: true
                        }
                    });

                    if (dm) {
                        await messageService.deleteDirectMessage(data.messageId, decoded.userId);
                        const dmRoomId = [dm.senderId, dm.receiverId].sort().join(':');
                        const roomId = `dm:${dmRoomId}`;

                        if (dm.parentId) {
                            io.to(roomId).emit('reply_deleted', {
                                messageId: data.messageId,
                                parentId: dm.parentId
                            });
                        } else {
                            io.to(roomId).emit('dm_deleted', {
                                messageId: data.messageId
                            });
                        }
                    }
                } else {
                    const message = await prisma.message.findUnique({
                        where: { id: data.messageId },
                        select: { parentId: true }
                    });

                    if (message && data.channelId) {
                        await messageService.deleteMessage(data.messageId, decoded.userId);
                        const channelRoom = `channel_${data.channelId}`;

                        if (message.parentId) {
                            io.to(data.channelId).emit('reply_deleted', {
                                messageId: data.messageId,
                                parentId: message.parentId
                            });
                            io.to(channelRoom).emit('reply_deleted', {
                                messageId: data.messageId,
                                parentId: message.parentId
                            });
                        } else {
                            io.to(data.channelId).emit('message_deleted', {
                                messageId: data.messageId,
                                channelId: data.channelId
                            });
                            io.to(channelRoom).emit('message_deleted', {
                                messageId: data.messageId,
                                channelId: data.channelId
                            });
                        }
                    }
                }
            } catch (error) {
                console.error('[SocketService] Error deleting message:', {
                    error: error instanceof Error ? error.message : error,
                    stack: error instanceof Error ? error.stack : undefined,
                    messageId: data.messageId,
                    channelId: data.channelId,
                    isDM: data.isDM
                });
                socket.emit('error', {
                    message: error instanceof Error ? error.message : 'Failed to delete message'
                });
            }
        });
    });
} 