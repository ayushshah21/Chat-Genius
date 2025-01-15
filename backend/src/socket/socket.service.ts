import { Server } from 'socket.io';
import { createServer } from 'http';
import express from 'express';
import { createMessage } from '../services/message.service';
import jwt from 'jsonwebtoken';
import { PrismaClient, Message, DirectMessage } from '@prisma/client';
import * as userService from '../services/user.service';
import * as reactionService from '../services/reaction.service';
import * as messageService from '../services/message.service';
import { AIService } from '../services/ai.service';
import { contextService } from '../services/context.service';
import { ConfigService } from '@nestjs/config';
import { VectorService } from '../services/vector.service';
import { PrismaService } from '../services/prisma.service';

const prisma = new PrismaClient();
let aiService: AIService;
let isInitialized = false;

async function initializeServices() {
    if (isInitialized) return;

    try {
        console.log('[SocketService] Initializing services...');
        const vectorService = new VectorService(new ConfigService(), new PrismaService());
        // Initialize vector service
        await vectorService.onModuleInit();
        aiService = new AIService(new ConfigService(), vectorService);
        isInitialized = true;
        console.log('[SocketService] Services initialized successfully');
    } catch (error) {
        console.error('[SocketService] Error initializing services:', error);
        throw error;
    }
}

// Keep track of disconnect timeouts and connected users
const disconnectTimeouts: Record<string, NodeJS.Timeout> = {};
const connectedUsers: Set<string> = new Set();
const OFFLINE_TIMEOUT = 10000; // 10 seconds

// Keep track of suggestion requests to implement rate limiting
const suggestionRequests: Record<string, number> = {};
const SUGGESTION_LIMIT = 5; // Maximum suggestions per minute
const SUGGESTION_WINDOW = 60000; // 1 minute window

let io: Server;

export function getIO() {
    return io;
}

export function initializeIO() {
    const app = express();
    const httpServer = createServer(app);

    io = new Server(httpServer, {
        cors: {
            origin: '*',
            methods: ['GET', 'POST']
        }
    });

    return io;
}

export async function setupSocketIO(server: Server) {
    io = server;

    try {
        // Initialize services before setting up socket handlers
        await initializeServices();

        io.on('connection', async (socket) => {
            // Keep essential connection log
            console.log('Socket connected:', socket.id);

            // Handle user presence on connection
            try {
                const token = socket.handshake.auth.token;
                if (token) {
                    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { userId: string };

                    // Check if user exists before updating status
                    const userExists = await prisma.user.findUnique({
                        where: { id: decoded.userId }
                    });

                    if (userExists) {
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
                dmUserId?: string;
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
                        socket.join(data.channelId);
                    }
                    if (!socket.rooms.has(`channel_${data.channelId}`)) {
                        socket.join(`channel_${data.channelId}`);
                    }

                    const message = await createMessage(
                        data.content,
                        data.channelId,
                        decoded.userId,
                        data.parentId
                    );

                    // Emit original message immediately
                    if (data.channelId) {
                        console.log('[SocketService] Emitting original channel message:', {
                            channelId: data.channelId,
                            messageId: message.id
                        });
                        io.to(data.channelId).emit('new_message', message);
                    }

                    // Index all messages with content
                    if (message.content) {
                        console.log('[SocketService] Indexing message:', {
                            messageId: message.id
                        });

                        const indexResult = await contextService.handleRealTimeUpdate(
                            message,
                            data.channelId ? 'channel' : 'dm'
                        );

                        if (!indexResult.success) {
                            console.error('[SocketService] Failed to index message:', {
                                messageId: message.id,
                                error: indexResult.error
                            });
                        }
                    }

                    let shouldAutoRespond = false;
                    let autoRespondUser = null;

                    // For channel messages, check mentions
                    if (data.channelId && data.content) {
                        // Extract both @username and @email mentions
                        const mentions = data.content.match(/@(\S+)/g)?.map(m => m.slice(1)) || [];

                        const mentionedUsers = await prisma.user.findMany({
                            where: {
                                OR: [
                                    { name: { in: mentions } },
                                    { email: { in: mentions } }
                                ]
                            },
                            select: {
                                id: true,
                                name: true,
                                communicationStyle: true,
                                commonPhrases: true,
                                autoReplyEnabled: true
                            }
                        });

                        console.log('[SocketService] Found mentioned users:', {
                            mentions,
                            foundUsers: mentionedUsers.map(u => u.name)
                        });

                        // Find first user with auto-reply enabled
                        autoRespondUser = mentionedUsers.find(u => u.autoReplyEnabled);
                        shouldAutoRespond = !!autoRespondUser;
                    }

                    // Handle AI auto-response if needed
                    if (shouldAutoRespond && autoRespondUser && message.content) {
                        try {
                            console.log('[SocketService] Generating auto-response:', {
                                messageId: message.id,
                                userId: decoded.userId,
                                autoRespondUserId: autoRespondUser.id
                            });

                            // Generate enhanced response with indexed context
                            const autoResponse = await aiService.generateEnhancedPersonalityResponse(
                                message.content,
                                autoRespondUser.communicationStyle || 'casual',
                                autoRespondUser.id,
                                data.channelId
                            );

                            // Create and emit response
                            const responseMessage = await createMessage(
                                autoResponse,
                                data.channelId,
                                autoRespondUser.id,
                                undefined  // parentId
                            );

                            console.log('[SocketService] Emitting AI response:', {
                                messageId: responseMessage.id,
                                originalMessageId: message.id
                            });

                            io.to(data.channelId).emit('new_message', responseMessage);

                        } catch (error) {
                            console.error('[SocketService] Error generating AI response:', {
                                error: error instanceof Error ? error.message : error,
                                messageId: message.id
                            });

                            socket.emit('message_error', {
                                error: 'Failed to generate AI response',
                                messageId: message.id
                            });
                        }
                    }

                    // Handle parent message notifications
                    if (data.parentId) {
                        io.emit('new_reply', message);
                    }

                } catch (error) {
                    console.error('[SocketService] Error in message handling:', error);
                    socket.emit('message_error', { error: 'Failed to process message' });
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
            }) => {
                console.log('[SocketService] Received send_dm event:', {
                    content: data.content,
                    receiverId: data.receiverId,
                    parentId: data.parentId
                });

                const token = socket.handshake.auth.token;
                if (!token) {
                    socket.emit('message_error', { error: 'Authentication required' });
                    return;
                }

                try {
                    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { userId: string };
                    console.log('[SocketService] Authenticated user:', {
                        userId: decoded.userId,
                        receiverId: data.receiverId
                    });

                    // Create the DM
                    const message = await prisma.directMessage.create({
                        data: {
                            content: data.content,
                            senderId: decoded.userId,
                            receiverId: data.receiverId,
                            parentId: data.parentId
                        },
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
                                    avatarUrl: true,
                                    autoReplyEnabled: true,
                                    communicationStyle: true,
                                    commonPhrases: true
                                }
                            }
                        }
                    });

                    console.log('[SocketService] Created DM:', {
                        messageId: message.id,
                        senderId: message.sender.id,
                        receiverId: message.receiver.id,
                        receiverAutoReply: message.receiver.autoReplyEnabled
                    });

                    // Emit original message first
                    const dmRoomId = [decoded.userId, data.receiverId].sort().join(':');

                    // Ensure socket is in DM room for original message
                    if (!socket.rooms.has(`dm:${dmRoomId}`)) {
                        console.log('[SocketService] Joining DM room for original message:', `dm:${dmRoomId}`);
                        socket.join(`dm:${dmRoomId}`);
                    }

                    console.log('[SocketService] Emitting original DM:', {
                        dmRoomId,
                        messageId: message.id,
                        socketRooms: Array.from(socket.rooms)
                    });

                    io.to(`dm:${dmRoomId}`).emit('new_dm', message);

                    // Then handle auto-response if enabled
                    if (message.receiver.autoReplyEnabled) {
                        console.log('[SocketService] Auto-response enabled for DM receiver:', {
                            receiverId: data.receiverId,
                            receiverName: message.receiver.name
                        });

                        // Get context and generate response
                        const contextType = 'dm';
                        const contextId = data.receiverId;
                        const context = await contextService.getChatContext(contextId, contextType);

                        console.log('[SocketService] Retrieved context for auto-response:', {
                            contextType,
                            contextId,
                            contextLength: context.length
                        });

                        const prompt = `Based on this conversation, provide an appropriate response.
                        The message "${data.content}" was directed at you.
                        
                        Recent conversation:
                        ${context.join('\n')}

                        Rules:
                        1. Don't prefix responses with sender names or acknowledgments
                        2. For direct questions, give a brief, focused answer and stop
                        3. Don't try to change topics or steer the conversation
                        4. Keep responses concise and natural
                        5. You ARE the person in the conversation - don't talk TO them, BE them
                        6. Don't use phrases like "your" or "you" unless asking a question
                        7. Don't acknowledge previous messages with phrases like "as mentioned earlier"
                        8. Respond in first person as if expressing your own thoughts/preferences
                        9. DO include specific names (like player names, person names, etc.) when they are relevant to the content`;

                        const autoResponse = await aiService.generatePersonalityResponse(
                            prompt,
                            message.receiver.communicationStyle || 'casual',
                            context.join('\n')
                        );

                        console.log('[SocketService] Generated auto-response:', {
                            responseLength: autoResponse?.length,
                            preview: autoResponse?.slice(0, 50) + '...'
                        });

                        // Create and emit auto-response message after a short delay
                        setTimeout(async () => {
                            const responseMessage = await prisma.directMessage.create({
                                data: {
                                    content: autoResponse,
                                    senderId: data.receiverId,
                                    receiverId: decoded.userId,
                                    isAI: true
                                },
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
                                    }
                                }
                            });

                            console.log('[SocketService] Emitting DM auto-response:', {
                                dmRoomId,
                                messageId: responseMessage.id,
                                senderId: data.receiverId,
                                receiverId: decoded.userId,
                                messageContent: autoResponse?.slice(0, 50) + '...'
                            });

                            io.to(`dm:${dmRoomId}`).emit('new_dm', responseMessage);
                        }, 500); // Add a small delay to ensure message order
                    }

                } catch (error) {
                    console.error('Error sending DM:', error);
                    socket.emit('message_error', { error: 'Failed to send direct message' });
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

                    // Update file size and fetch related data
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
                                    channel: true,
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
                            dm: {
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

                    // Handle channel message
                    if (data.channelId && updatedFile.message) {
                        const message = updatedFile.message;
                        if (message.parentId) {
                            io.emit('new_reply', {
                                ...message,
                                parentMessage: message.parent
                            });
                        } else {
                            io.to(data.channelId).emit('new_message', message);
                        }
                    }
                    // Handle DM message
                    else if (data.dmUserId && updatedFile.dm) {
                        const dm = updatedFile.dm;
                        const dmRoomId = [dm.sender.id, dm.receiver.id].sort().join(':');
                        const roomId = `dm:${dmRoomId}`;

                        console.log('[SocketService] Emitting DM file update to room:', {
                            roomId,
                            messageId: dm.id,
                            hasFiles: dm.files?.length > 0,
                            isReply: !!dm.parentId
                        });

                        if (dm.parentId && dm.parent) {
                            io.emit('new_reply', {
                                ...dm,
                                parentMessage: dm.parent
                            });
                        } else {
                            io.to(roomId).emit('new_dm', dm);
                        }
                    }
                } catch (error) {
                    console.error('[SocketService] Error in file_upload_complete:', error);
                }
            });

            // Add reaction to message
            socket.on("add_reaction", async (data: {
                emoji: string;
                messageId: string;
                channelId?: string;
                dmUserId?: string;
            }) => {
                try {
                    console.log("[SocketService] Adding reaction:", {
                        emoji: data.emoji,
                        messageId: data.messageId,
                        channelId: data.channelId,
                        dmUserId: data.dmUserId
                    });

                    const userId = socket.data.userId;
                    if (!userId) {
                        throw new Error('User not authenticated');
                    }

                    // First check if message exists
                    let messageExists = false;
                    let messageDetails = null;
                    let isActuallyDM = !!data.dmUserId;  // Track the actual message type

                    if (data.dmUserId) {
                        messageDetails = await prisma.directMessage.findUnique({
                            where: { id: data.messageId },
                            include: {
                                sender: { select: { id: true } },
                                receiver: { select: { id: true } },
                            },
                        });
                        messageExists = !!messageDetails;
                    } else {
                        messageDetails = await prisma.message.findUnique({
                            where: { id: data.messageId },
                            include: { channel: true },
                        });
                        messageExists = !!messageDetails;
                    }

                    if (!messageExists) {
                        throw new Error('Message not found');
                    }

                    // Add the reaction
                    await reactionService.addReaction(
                        data.emoji,
                        userId,
                        isActuallyDM ? undefined : data.messageId,
                        isActuallyDM ? data.messageId : undefined
                    );

                    if (isActuallyDM && messageDetails) {
                        const dmMessage = messageDetails as any;
                        const dmRoomId = [dmMessage.sender.id, dmMessage.receiver.id].sort().join(':');

                        // Get all reactions for this message
                        const allReactions = await prisma.emojiReaction.findMany({
                            where: { dmId: data.messageId },
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

                        io.to(channelRoom).emit("message_reaction_added", {
                            messageId: data.messageId,
                            reactions: allReactions,
                        });
                    }
                } catch (error) {
                    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
                    console.error("[SocketService] Error adding reaction:", {
                        error: errorMessage,
                        emoji: data.emoji,
                        messageId: data.messageId,
                        dmUserId: data.dmUserId,
                        stack: error instanceof Error ? error.stack : undefined
                    });
                    socket.emit("error", { message: errorMessage });
                }
            });

            // Remove reaction from message
            socket.on("remove_reaction", async (data: {
                emoji: string;
                messageId: string;
                channelId?: string;
                dmUserId?: string;
            }) => {
                try {
                    console.log("[SocketService] Removing reaction:", {
                        emoji: data.emoji,
                        messageId: data.messageId,
                        channelId: data.channelId,
                        dmUserId: data.dmUserId
                    });

                    const userId = socket.data.userId;
                    if (!userId) {
                        throw new Error('User not authenticated');
                    }

                    // First check if message exists
                    let messageExists = false;
                    let messageDetails = null;
                    let isActuallyDM = !!data.dmUserId;  // Track the actual message type

                    if (data.dmUserId) {
                        messageDetails = await prisma.directMessage.findUnique({
                            where: { id: data.messageId },
                            include: {
                                sender: { select: { id: true } },
                                receiver: { select: { id: true } },
                            },
                        });
                        messageExists = !!messageDetails;
                    } else {
                        messageDetails = await prisma.message.findUnique({
                            where: { id: data.messageId },
                            include: { channel: true },
                        });
                        messageExists = !!messageDetails;
                    }

                    if (!messageExists) {
                        throw new Error('Message not found');
                    }

                    // Remove the reaction
                    await reactionService.removeReaction(
                        data.emoji,
                        userId,
                        isActuallyDM ? undefined : data.messageId,
                        isActuallyDM ? data.messageId : undefined
                    );

                    if (isActuallyDM && messageDetails) {
                        const dmMessage = messageDetails as any;
                        const dmRoomId = [dmMessage.sender.id, dmMessage.receiver.id].sort().join(':');

                        // Get all remaining reactions for this message
                        const allReactions = await prisma.emojiReaction.findMany({
                            where: { dmId: data.messageId },
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
                    }
                } catch (error) {
                    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
                    console.error("[SocketService] Error removing reaction:", {
                        error: errorMessage,
                        emoji: data.emoji,
                        messageId: data.messageId,
                        dmUserId: data.dmUserId,
                        stack: error instanceof Error ? error.stack : undefined
                    });
                    socket.emit("error", { message: errorMessage });
                }
            });

            // Delete message
            socket.on('delete_message', async (data: {
                messageId: string,
                channelId?: string,
                dmUserId?: string
            }) => {
                try {
                    const userId = socket.data.userId;
                    if (!userId) {
                        throw new Error('User not authenticated');
                    }

                    const isActuallyDM = !!data.dmUserId;

                    if (isActuallyDM) {
                        const message = await prisma.directMessage.findUnique({
                            where: { id: data.messageId },
                            include: {
                                sender: true,
                                receiver: true
                            }
                        });

                        if (!message) {
                            throw new Error('Message not found');
                        }

                        if (message.senderId !== userId) {
                            throw new Error('Not authorized to delete this message');
                        }

                        await prisma.directMessage.delete({
                            where: { id: data.messageId }
                        });

                        const dmRoomId = [message.sender.id, message.receiver.id].sort().join(':');
                        io.to(`dm:${dmRoomId}`).emit('message_deleted', {
                            messageId: data.messageId
                        });
                    } else {
                        const message = await prisma.message.findUnique({
                            where: { id: data.messageId },
                            include: {
                                user: true,
                                channel: true
                            }
                        });

                        if (!message) {
                            throw new Error('Message not found');
                        }

                        if (message.userId !== userId) {
                            throw new Error('Not authorized to delete this message');
                        }

                        await prisma.message.delete({
                            where: { id: data.messageId }
                        });

                        io.to(`channel_${message.channel.id}`).emit('message_deleted', {
                            messageId: data.messageId
                        });
                    }
                } catch (error) {
                    console.error('[SocketService] Error deleting message:', error);
                    socket.emit('error', {
                        message: error instanceof Error ? error.message : 'Failed to delete message'
                    });
                }
            });

            // AI suggestion request handler
            socket.on('ai_suggestion_request', async (data: {
                channelId?: string;
                dmUserId?: string;
                content: string;
            }) => {
                const token = socket.handshake.auth.token;
                if (!token) {
                    socket.emit('suggestion_error', { error: 'Authentication required' });
                    return;
                }

                try {
                    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { userId: string };

                    // Implement basic rate limiting
                    const now = Date.now();
                    const userRequests = suggestionRequests[decoded.userId] || 0;
                    if (userRequests >= SUGGESTION_LIMIT) {
                        socket.emit('suggestion_error', {
                            error: 'Rate limit exceeded. Please wait before requesting more suggestions.'
                        });
                        return;
                    }
                    suggestionRequests[decoded.userId] = userRequests + 1;
                    setTimeout(() => {
                        suggestionRequests[decoded.userId]--;
                    }, SUGGESTION_WINDOW);

                    // Get recent context
                    const contextId = data.channelId || data.dmUserId;
                    if (!contextId) {
                        throw new Error('Either channelId or dmUserId must be provided');
                    }
                    const contextType = data.channelId ? 'channel' : 'dm';
                    const context = await contextService.getChatContext(contextId, contextType);

                    // Get user's style preferences
                    const user = await prisma.user.findUnique({
                        where: { id: decoded.userId },
                        select: {
                            name: true,
                            communicationStyle: true,
                            commonPhrases: true
                        }
                    });

                    if (!user) {
                        throw new Error('User not found');
                    }

                    // Generate suggestion
                    const prompt = `Based on this conversation, provide an appropriate response.

                    Recent conversation:
                    ${context.join('\n')}

                    Rules:
                    1. Don't prefix responses with sender names or acknowledgments
                    2. For direct questions, give a brief, focused answer and stop
                    3. Don't try to change topics or steer the conversation
                    4. Keep responses concise and natural
                    5. You ARE the person in the conversation - don't talk TO them, BE them
                    6. Don't use phrases like "your" or "you" unless asking a question
                    7. Don't acknowledge previous messages with phrases like "as mentioned earlier"
                    8. Respond in first person as if expressing your own thoughts/preferences
                    9. DO include specific names (like player names, person names, etc.) when they are relevant to the content`;

                    const suggestion = await aiService.generatePersonalityResponse(
                        prompt,
                        user.communicationStyle || 'casual',
                        context.join('\n')
                    );

                    // Send suggestion back to user
                    socket.emit('ai_suggestion', {
                        suggestion,
                        originalContent: data.content
                    });

                } catch (error) {
                    console.error('Error generating AI suggestion:', error);
                    socket.emit('suggestion_error', {
                        error: 'Failed to generate suggestion'
                    });
                }
            });

            // AI message suggestion handler
            socket.on('request_ai_suggestion', async (data: {
                channelId?: string,
                dmUserId?: string,
                messageContent?: string,
                parentId?: string
            }) => {
                try {
                    console.log('[SocketService] Received AI suggestion request:', {
                        channelId: data.channelId,
                        dmUserId: data.dmUserId,
                        hasContent: !!data.messageContent,
                        parentId: data.parentId
                    });

                    const userId = socket.data.userId;
                    if (!userId) {
                        throw new Error('User not authenticated');
                    }

                    // Get recent context
                    const contextId = data.channelId || data.dmUserId;
                    if (!contextId) {
                        throw new Error('Either channelId or dmUserId must be provided');
                    }
                    const contextType = data.channelId ? 'channel' : 'dm';
                    const context = await contextService.getChatContext(contextId, contextType);

                    // Rate limit check
                    const now = Date.now();
                    const userRequests = suggestionRequests[userId] || 0;
                    if (userRequests >= SUGGESTION_LIMIT) {
                        throw new Error('Rate limit exceeded. Please wait before requesting more suggestions.');
                    }
                    suggestionRequests[userId] = (suggestionRequests[userId] || 0) + 1;
                    setTimeout(() => {
                        suggestionRequests[userId]--;
                    }, SUGGESTION_WINDOW);

                    // Get user's style preferences
                    const user = await prisma.user.findUnique({
                        where: { id: userId },
                        select: {
                            name: true,
                            communicationStyle: true,
                            commonPhrases: true
                        }
                    });

                    if (!user) {
                        throw new Error('User not found');
                    }

                    // Generate suggestion
                    const prompt = `Based on this conversation, provide an appropriate response.

                    Recent conversation:
                    ${context.join('\n')}

                    Rules:
                    1. Don't prefix responses with sender names or acknowledgments
                    2. For direct questions, give a brief, focused answer and stop
                    3. Don't try to change topics or steer the conversation
                    4. Keep responses concise and natural
                    5. You ARE the person in the conversation - don't talk TO them, BE them
                    6. Don't use phrases like "your" or "you" unless asking a question
                    7. Don't acknowledge previous messages with phrases like "as mentioned earlier"
                    8. Respond in first person as if expressing your own thoughts/preferences
                    9. DO include specific names (like player names, person names, etc.) when they are relevant to the content`;

                    const suggestion = await aiService.generatePersonalityResponse(
                        prompt,
                        user.communicationStyle || 'casual',
                        context.join('\n')
                    );

                    // Emit suggestion back to user
                    socket.emit('ai_suggestion', {
                        suggestion,
                        messageContent: data.messageContent,
                        channelId: data.channelId,
                        dmUserId: data.dmUserId,
                        parentId: data.parentId
                    });

                } catch (error) {
                    console.error('[SocketService] Error generating AI suggestion:', error);
                    socket.emit('error', {
                        message: error instanceof Error ? error.message : 'Failed to generate AI suggestion'
                    });
                }
            });
        });
    } catch (error) {
        console.error('[SocketService] Failed to initialize socket service:', error);
        throw error;
    }
} 