import { PrismaClient } from '@prisma/client';
import { DynamoDBClient, GetItemCommand, PutItemCommand } from '@aws-sdk/client-dynamodb';
import { dynamoDbClient, CHAT_MEMORY_TABLE } from '../config/dynamodb';
import { AIService } from './ai.service';
import { ConfigService } from '@nestjs/config';
import { VectorService, VectorSearchResult } from './vector.service';
import { PrismaService } from './prisma.service';
import { Injectable } from '@nestjs/common';
import { Document } from 'langchain/document';
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
import { MessageWithUser, DirectMessageWithSender } from '../types/message.types';
import { VectorMetadata } from '../types/vector';

const prisma = new PrismaClient();

interface TopicSummary {
    topic: string;
    summary: string;
    messageCount: number;
    startTime: Date;
    endTime: Date;
}

@Injectable()
export class ContextService {
    private aiService: AIService;
    private vectorService: VectorService;
    private textSplitter: RecursiveCharacterTextSplitter;

    constructor(
        private configService: ConfigService,
        private prismaService: PrismaService,
        vectorService?: VectorService
    ) {
        this.vectorService = vectorService || new VectorService(configService, prismaService);
        this.aiService = new AIService(configService, this.vectorService);
        this.textSplitter = new RecursiveCharacterTextSplitter({
            chunkSize: 1000,
            chunkOverlap: 200,
        });
    }

    async handleRealTimeUpdate(
        message: MessageWithUser | DirectMessageWithSender,
        type: 'channel' | 'dm'
    ): Promise<{ success: boolean; error?: string }> {
        try {
            console.log('[ContextService] Starting real-time update:', {
                messageId: message.id,
                type,
                hasContent: !!message.content
            });

            if (!message.content) {
                return { success: true };
            }

            // Create metadata
            const metadata: VectorMetadata = {
                messageId: message.id,
                type,
                userId: 'sender' in message ? message.senderId : message.userId || '',
                userName: ('sender' in message ? message.sender?.name : message.user?.name) || null,
                channelId: type === 'channel' ? ('channelId' in message ? message.channelId : undefined) : undefined,
                createdAt: message.createdAt.toISOString(),
                isAI: message.isAI,
                senderId: type === 'dm' && 'senderId' in message ? message.senderId : undefined,
                receiverId: type === 'dm' && 'receiverId' in message ? message.receiverId : undefined
            };

            // Split and store message
            const result = await this.vectorService.addDocuments([{
                pageContent: message.content,
                metadata
            }]);

            console.log('[ContextService] Added documents to vector store:', {
                messageId: message.id,
                success: true
            });

            // Wait longer for initial indexing
            await new Promise(resolve => setTimeout(resolve, 5000));

            // Verify with retries
            let retries = 0;
            const maxRetries = 5;
            const retryDelay = 2000;

            while (retries < maxRetries) {
                try {
                    // Try to find the message in the index with more results
                    const results = await this.vectorService.queryVectors(message.content, { k: 5 });

                    console.log('[ContextService] Verification attempt:', {
                        messageId: message.id,
                        attempt: retries + 1,
                        found: results.length > 0,
                        resultCount: results.length,
                        firstResult: results[0]?.metadata
                    });

                    // Check if our message is in any of the results
                    const found = results.some(doc => doc.metadata.messageId === message.id);

                    if (found) {
                        console.log('[ContextService] Message verified in index:', {
                            messageId: message.id,
                            attempts: retries + 1
                        });
                        return { success: true };
                    }

                    // If we have results but our message isn't found, log them for debugging
                    if (results.length > 0) {
                        console.log('[ContextService] Found other messages in index:', {
                            messageId: message.id,
                            attempt: retries + 1,
                            foundIds: results.map(r => r.metadata.messageId)
                        });
                    }

                    console.log('[ContextService] Message not found in index, retrying:', {
                        messageId: message.id,
                        attempt: retries + 1
                    });

                    retries++;
                    await new Promise(resolve => setTimeout(resolve, retryDelay));
                } catch (error) {
                    console.error('[ContextService] Error during verification:', {
                        messageId: message.id,
                        attempt: retries + 1,
                        error: error instanceof Error ? error.message : error
                    });
                    retries++;
                    await new Promise(resolve => setTimeout(resolve, retryDelay));
                }
            }

            throw new Error('Message failed to index after retries');
        } catch (error) {
            console.error('[ContextService] Error in handleRealTimeUpdate:', {
                error: error instanceof Error ? error.message : error,
                messageId: message.id
            });
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error during indexing'
            };
        }
    }

    private async verifyMessageIndexed(messageId: string, content: string): Promise<boolean> {
        try {
            // Try to find the message in the vector store
            const results = await this.vectorService.queryVectors(content, { k: 1 });
            return results.some(result => result.metadata.messageId === messageId);
        } catch (error) {
            console.error('[ContextService] Error verifying message index:', {
                error: error instanceof Error ? error.message : error,
                messageId
            });
            return false;
        }
    }

    /**
     * Enhanced version of getChatContext that combines DynamoDB and vector search
     */
    async getChatContext(contextId: string, type: "channel" | "dm"): Promise<string[]> {
        try {
            // First get context from DynamoDB
            const command = new GetItemCommand({
                TableName: CHAT_MEMORY_TABLE,
                Key: {
                    contextId: { S: contextId },
                    type: { S: type }
                }
            });

            const { Item } = await dynamoDbClient.send(command);

            // Get messages from database
            const dbMessages = type === "channel"
                ? await this.getChannelHistory(contextId)
                : await this.getDMHistory(contextId);

            if (dbMessages.length === 0) {
                return [];
            }

            // Get traditional context
            const traditionalContext = dbMessages
                .filter(msg => msg.content !== null)
                .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
                .map(msg => `[Context] ${msg.user?.name || 'Unknown'}: ${msg.content}`)
                .slice(-10);

            // Get vector-based context if we have a latest message
            const latestMessage = dbMessages[dbMessages.length - 1];
            if (latestMessage?.content) {
                try {
                    const query = `${latestMessage.user?.name || 'Unknown'}: ${latestMessage.content}`;
                    const similarMessages = await this.vectorService.queryVectors(query, { k: 5 });
                    const vectorContext = similarMessages.map((msg: VectorSearchResult) =>
                        `[Similar] ${msg.metadata.userName || 'Unknown'}: ${msg.pageContent}`
                    );

                    // Combine both contexts, prioritizing traditional context
                    return [...traditionalContext, ...vectorContext];
                } catch (error) {
                    console.error('[ContextService] Error getting vector-based context:', error);
                    // Fall back to traditional context if vector search fails
                    return traditionalContext;
                }
            }

            return traditionalContext;
        } catch (error) {
            console.error("Error getting chat context:", error);
            throw new Error("Failed to retrieve chat context");
        }
    }

    /**
     * Get channel message history from PostgreSQL
     */
    private async getChannelHistory(channelId: string): Promise<MessageWithUser[]> {
        const messages = await prisma.message.findMany({
            where: {
                channelId,
                content: { not: null }
            },
            orderBy: { createdAt: "desc" },
            take: 50,
            select: {
                id: true,
                content: true,
                userId: true,
                createdAt: true,
                isAI: true,
                user: {
                    select: {
                        name: true
                    }
                }
            }
        });

        return messages as MessageWithUser[];
    }

    /**
     * Get DM history from PostgreSQL
     */
    private async getDMHistory(dmId: string): Promise<MessageWithUser[]> {
        // Split the dmId into sender and receiver IDs
        const [user1Id, user2Id] = dmId.split(':');

        const messages = await prisma.directMessage.findMany({
            where: {
                AND: [
                    { content: { not: null } },
                    {
                        OR: [
                            {
                                AND: [
                                    { senderId: user1Id },
                                    { receiverId: user2Id }
                                ]
                            },
                            {
                                AND: [
                                    { senderId: user2Id },
                                    { receiverId: user1Id }
                                ]
                            }
                        ]
                    }
                ]
            },
            orderBy: { createdAt: "desc" },
            take: 50,
            select: {
                id: true,
                content: true,
                senderId: true,
                createdAt: true,
                isAI: true,
                sender: {
                    select: {
                        name: true
                    }
                }
            }
        });

        // Map DM fields to Message interface
        return messages.map(msg => ({
            id: msg.id,
            content: msg.content,
            userId: msg.senderId,
            user: msg.sender,
            createdAt: msg.createdAt,
            isAI: msg.isAI
        }));
    }

    private async summarizeMessages(messages: MessageWithUser[]): Promise<string> {
        const messageTexts = messages
            .filter(msg => msg.content)
            .map(msg => `${msg.user?.name || 'Unknown'}: ${msg.content}`)
            .join('\n');

        const prompt = `Below is a conversation. Please provide a brief summary of the key points discussed:

Conversation:
${messageTexts}

Summary:`;

        try {
            const summary = await this.aiService.generateResponse(prompt);
            return summary;
        } catch (error) {
            console.error('Error summarizing messages:', error);
            // If summarization fails, return a concatenated version of recent messages
            return messages
                .slice(-5)
                .filter(msg => msg.content)
                .map(msg => msg.content)
                .join(' | ');
        }
    }

    /**
     * Update chat context in DynamoDB
     */
    async updateChatContext(contextId: string, type: "channel" | "dm", messages: MessageWithUser[]): Promise<void> {
        try {
            const command = new PutItemCommand({
                TableName: CHAT_MEMORY_TABLE,
                Item: {
                    contextId: { S: contextId },
                    type: { S: type },
                    lastMessages: {
                        L: messages
                            .filter(msg => msg.content !== null)
                            .map(msg => ({
                                M: {
                                    id: { S: msg.id },
                                    content: { S: msg.content as string },
                                    userId: { S: msg.userId || '' },
                                    createdAt: { S: msg.createdAt.toISOString() },
                                    isAI: { BOOL: msg.isAI }
                                }
                            }))
                    },
                    lastUpdated: { N: Date.now().toString() },
                    messageCount: { N: messages.length.toString() },
                    // Set TTL to 24 hours from now
                    expiresAt: { N: (Math.floor(Date.now() / 1000) + 86400).toString() }
                }
            });

            await dynamoDbClient.send(command);
        } catch (error) {
            console.error("Error updating chat context:", error);
            throw new Error("Failed to update chat context");
        }
    }

    /**
     * Batch summarize messages with topic detection
     */
    private async batchSummarizeMessages(messages: MessageWithUser[]): Promise<TopicSummary[]> {
        try {
            // Sort messages by creation time
            const sortedMessages = [...messages].sort((a, b) =>
                a.createdAt.getTime() - b.createdAt.getTime()
            );

            // Group messages into batches (max 1 hour per batch)
            const batches: MessageWithUser[][] = [];
            let currentBatch: MessageWithUser[] = [];
            let lastMessage: MessageWithUser | null = null;

            for (const message of sortedMessages) {
                if (!lastMessage || await this.isNewTopic(message, lastMessage)) {
                    if (currentBatch.length > 0) {
                        batches.push(currentBatch);
                    }
                    currentBatch = [message];
                } else {
                    currentBatch.push(message);
                }
                lastMessage = message;
            }

            // Add the last batch if it has messages
            if (currentBatch.length > 0) {
                batches.push(currentBatch);
            }

            // Process each batch to generate summaries
            const summaries: TopicSummary[] = [];
            for (const batch of batches) {
                const summary = await this.summarizeMessages(batch);
                summaries.push({
                    topic: `Topic ${summaries.length + 1}`,
                    summary: summary,
                    messageCount: batch.length,
                    startTime: batch[0].createdAt,
                    endTime: batch[batch.length - 1].createdAt
                });
            }

            return summaries;
        } catch (error) {
            console.error('Error in batch summarization:', error);
            throw error;
        }
    }

    /**
     * Update context with batch summaries
     */
    async updateContextWithBatchSummaries(contextId: string, type: "channel" | "dm", summaries: TopicSummary[]): Promise<void> {
        try {
            const command = new PutItemCommand({
                TableName: CHAT_MEMORY_TABLE,
                Item: {
                    contextId: { S: contextId },
                    type: { S: type },
                    summaries: {
                        L: summaries.map(summary => ({
                            M: {
                                topic: { S: summary.topic },
                                summary: { S: summary.summary },
                                messageCount: { N: summary.messageCount.toString() },
                                startTime: { S: summary.startTime.toISOString() },
                                endTime: { S: summary.endTime.toISOString() }
                            }
                        }))
                    },
                    lastUpdated: { N: Date.now().toString() },
                    expiresAt: { N: (Math.floor(Date.now() / 1000) + 86400).toString() }
                }
            });

            await dynamoDbClient.send(command);
        } catch (error) {
            console.error("Error updating context with batch summaries:", error);
            throw new Error("Failed to update context with batch summaries");
        }
    }

    /**
     * Check if a message appears to be starting a new topic
     */
    private async isNewTopic(currentMsg: MessageWithUser, prevMsg: MessageWithUser): Promise<boolean> {
        if (!prevMsg) return true;

        // Consider it a new topic if:
        // 1. Messages are more than 1 hour apart
        const timeDiff = new Date(currentMsg.createdAt).getTime() -
            new Date(prevMsg.createdAt).getTime();
        if (timeDiff > 60 * 60 * 1000) return true;

        // 2. Different channel/conversation
        if (currentMsg.channelId !== prevMsg.channelId) return true;

        // 3. Use AI to determine if it's a new topic
        const prompt = `Previous message: "${prevMsg.content}"
Current message: "${currentMsg.content}"

Is the current message starting a new topic? Answer with only 'yes' or 'no'.`;

        try {
            const response = await this.aiService.generateResponse(prompt);
            return response.toLowerCase().includes('yes');
        } catch (error) {
            console.error('Error detecting new topic:', error);
            return false;
        }
    }
}

// For backward compatibility
export const contextService = new ContextService(new ConfigService(), new PrismaService()); 