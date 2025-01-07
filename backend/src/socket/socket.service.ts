import { Server, Socket } from 'socket.io';
import { createMessage } from '../services/message.service';
import jwt from 'jsonwebtoken';

export function setupSocketIO(io: Server) {
    io.on('connection', (socket: Socket) => {
        console.log('User connected:', socket.id);

        // Join a channel
        socket.on('join_channel', (channelId: string) => {
            socket.join(channelId);
            console.log(`User ${socket.id} joined channel ${channelId}`);
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
                const message = await createMessage(
                    data.content,
                    data.channelId,
                    decoded.userId,
                    data.parentId
                );
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
            console.log('User disconnected:', socket.id);
        });
    });
} 