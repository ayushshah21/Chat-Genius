import { PrismaClient } from '@prisma/client';
import { DynamoDBClient, GetItemCommand, PutItemCommand } from '@aws-sdk/client-dynamodb';
import { dynamoDbClient, CHAT_MEMORY_TABLE } from '../config/dynamodb';
import { AIService } from './ai.service';
import { ConfigService } from '@nestjs/config';
import { VectorService, VectorMetadata, VectorSearchResult } from './vector.service';
import { PrismaService } from './prisma.service';
import { Injectable } from '@nestjs/common';
import { Document } from 'langchain/document';
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';

const prisma = new PrismaClient();

interface Message {
    id: string;
    content: string | null;
    userId: string | null;
    user?: {
        name: string | null;
    } | null;
    channelId?: string;
    createdAt: Date;
    isAI: boolean;
}

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

    /**
     * Enhanced version of handleRealTimeUpdate that also stores in vector database
     */
    async handleRealTimeUpdate(message: Message, type: "channel" | "dm"): Promise<void> {
        try {
            // First, handle the traditional update
            const contextId = type === "channel" ? message.channelId || message.id : message.id;

            // Get existing context from DynamoDB
            const command = new GetItemCommand({
                TableName: CHAT_MEMORY_TABLE,
                Key: {
                    contextId: { S: contextId },
                    type: { S: type }
                }
            });

            const { Item } = await dynamoDbClient.send(command);

            // Get existing messages or initialize empty array
            const existingMessages: Message[] = Item?.lastMessages?.L?.map(msg => ({
                id: msg.M?.id?.S || '',
                content: msg.M?.content?.S || '',
                userId: msg.M?.userId?.S || '',
                createdAt: new Date(msg.M?.createdAt?.S || Date.now()),
                isAI: msg.M?.isAI?.BOOL || false
            })) || [];

            // Check if this message might start a new topic
            const lastMessage = existingMessages[existingMessages.length - 1];
            const isNewTopic = !lastMessage || await this.isNewTopic(message, lastMessage);

            if (isNewTopic) {
                // If it's a new topic, trigger a batch summarization
                const messages = type === "channel"
                    ? await this.getChannelHistory(contextId)
                    : await this.getDMHistory(contextId);

                const summaries = await this.batchSummarizeMessages(messages);
                await this.updateContextWithBatchSummaries(contextId, type, summaries);
            } else {
                // Otherwise, just append the message to existing context
                existingMessages.push(message);
                const recentMessages = existingMessages.slice(-50);
                await this.updateChatContext(contextId, type, recentMessages);
            }

            // Now handle the vector store update if we have content
            if (message.content) {
                const metadata: VectorMetadata = {
                    messageId: message.id,
                    userId: message.userId || '',
                    userName: message.user?.name || null,
                    channelId: message.channelId,
                    type: type,
                    createdAt: message.createdAt.toISOString(),
                    isAI: message.isAI
                };

                // Split message into chunks if needed
                const docs = await this.textSplitter.createDocuments(
                    [message.content],
                    [metadata]
                ) as Document<VectorMetadata>[];

                // Store chunks in vector database
                await this.vectorService.addDocuments(docs);

                // Get similar messages for context
                const similarMessages = await this.vectorService.queryVectors(message.content, 5);

                // Generate summary if needed
                if (similarMessages.length > 0) {
                    const summary = await this.summarizeMessages([message, ...similarMessages.map((msg: VectorSearchResult) => ({
                        id: msg.metadata.messageId,
                        content: msg.pageContent,
                        userId: msg.metadata.userId,
                        user: { name: msg.metadata.userName },
                        channelId: msg.metadata.channelId,
                        createdAt: new Date(msg.metadata.createdAt),
                        isAI: msg.metadata.isAI
                    }))]);

                    const summaryMetadata: VectorMetadata = {
                        messageId: `summary-${message.id}`,
                        userId: message.userId || '',
                        userName: message.user?.name || null,
                        channelId: message.channelId,
                        type: 'summary',
                        createdAt: new Date().toISOString(),
                        isAI: true
                    };

                    // Store summary as a new document
                    await this.vectorService.addDocuments([
                        new Document({
                            pageContent: summary,
                            metadata: summaryMetadata
                        })
                    ]);
                }
            }
        } catch (error) {
            console.error("Error handling real-time update:", error);
            throw new Error("Failed to handle real-time update");
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
                    const similarMessages = await this.vectorService.queryVectors(query, 5);
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
    private async getChannelHistory(channelId: string): Promise<Message[]> {
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

        return messages as Message[];
    }

    /**
     * Get DM history from PostgreSQL
     */
    private async getDMHistory(dmId: string): Promise<Message[]> {
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

    private async summarizeMessages(messages: Message[]): Promise<string> {
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
    async updateChatContext(contextId: string, type: "channel" | "dm", messages: Message[]): Promise<void> {
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
    private async batchSummarizeMessages(messages: Message[]): Promise<TopicSummary[]> {
        try {
            // Sort messages by creation time
            const sortedMessages = [...messages].sort((a, b) =>
                a.createdAt.getTime() - b.createdAt.getTime()
            );

            // Group messages into batches (max 1 hour per batch)
            const batches: Message[][] = [];
            let currentBatch: Message[] = [];
            let lastMessage: Message | null = null;

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
    private async isNewTopic(currentMsg: Message, prevMsg: Message): Promise<boolean> {
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