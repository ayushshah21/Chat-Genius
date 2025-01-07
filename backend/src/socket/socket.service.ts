import { Server } from 'socket.io';
import { createMessage } from '../services/message.service';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export let io: Server;

export function setupSocketIO(server: Server) {
    io = server;  // Assign the server instance

    io.on('connection', (socket) => {
        console.log('Socket connected:', socket.id);

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

        socket.on('disconnect', () => {
            console.log('Socket disconnected:', socket.id);
        });

        socket.on('create_channel', async (channel) => {
            console.log('Socket: Received create_channel event:', channel);
            io.emit('new_channel', channel);
            console.log('Socket: Emitted new_channel event to all clients');
        });
    });
} 