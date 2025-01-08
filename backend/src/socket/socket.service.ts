import { Server } from 'socket.io';
import { createMessage } from '../services/message.service';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import * as userService from '../services/user.service';

const prisma = new PrismaClient();

// Keep track of disconnect timeouts and connected users
const disconnectTimeouts: Record<string, NodeJS.Timeout> = {};
const connectedUsers: Set<string> = new Set();
const OFFLINE_TIMEOUT = 10000; // 10 seconds

export let io: Server;

export function setupSocketIO(server: Server) {
    io = server;

    io.on('connection', async (socket) => {
        console.log('Socket connected:', socket.id);

        // Handle user presence on connection
        try {
            const token = socket.handshake.auth.token;
            if (token) {
                const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { userId: string };
                console.log(`[Presence] User ${decoded.userId} connected with socket ${socket.id}`);

                // Clear any existing disconnect timeout for this user
                if (disconnectTimeouts[decoded.userId]) {
                    console.log(`[Presence] Clearing disconnect timeout for user ${decoded.userId}`);
                    clearTimeout(disconnectTimeouts[decoded.userId]);
                    delete disconnectTimeouts[decoded.userId];
                }

                // Only update status if user wasn't already connected
                if (!connectedUsers.has(decoded.userId)) {
                    await userService.updateUserStatus(decoded.userId, 'online');
                }

                connectedUsers.add(decoded.userId);
                console.log(`[Presence] Connected users:`, Array.from(connectedUsers));

                socket.data.userId = decoded.userId;
            }
        } catch (error) {
            console.error('[Presence] Error handling user presence:', error);
        }

        // Join a channel
        socket.on('join_channel', (channelId: string) => {
            socket.join(channelId);
            console.log(`User ${socket.id} joined channel ${channelId}`);

            // Emit a join confirmation
            socket.emit('channel_joined', channelId);
        });

        // Leave a channel
        socket.on('leave_channel', (channelId: string) => {
            socket.leave(channelId);
            console.log(`User ${socket.id} left channel ${channelId}`);
        });

        // New message
        socket.on('send_message', async (data: {
            content: string;
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

                // Ensure socket is in the channel room before allowing message
                if (!socket.rooms.has(data.channelId)) {
                    socket.join(data.channelId); // Auto-join if not in room
                }

                const message = await createMessage(
                    data.content,
                    data.channelId,
                    decoded.userId,
                    data.parentId
                );

                // Broadcast to all clients in the channel, including sender
                io.to(data.channelId).emit('new_message', message);
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
                        }
                    }
                });

                // Create a unique room ID for this DM conversation
                const dmRoomId = [decoded.userId, data.receiverId].sort().join(':');

                // Emit only to the specific DM room
                io.to(`dm:${dmRoomId}`).emit('new_dm', message);
            } catch (error) {
                console.error('Error sending DM:', error);
                socket.emit('message_error', { error: 'Failed to send message' });
            }
        });
    });
} 