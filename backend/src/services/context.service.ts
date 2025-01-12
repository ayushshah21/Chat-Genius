import { PrismaClient } from '@prisma/client';
import { DynamoDBClient, GetItemCommand, PutItemCommand } from '@aws-sdk/client-dynamodb';
import { dynamoDbClient, CHAT_MEMORY_TABLE } from '../config/dynamodb';
import { aiService } from './ai.service';

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

class ContextService {
    /**
     * Get chat context from DynamoDB, falling back to PostgreSQL if needed
     */
    async getChatContext(contextId: string, type: "channel" | "dm"): Promise<string[]> {
        try {
            // Try to get recent context from DynamoDB
            const command = new GetItemCommand({
                TableName: CHAT_MEMORY_TABLE,
                Key: {
                    contextId: { S: contextId },
                    type: { S: type }
                }
            });

            const { Item } = await dynamoDbClient.send(command);

            // If we have enough recent messages in DynamoDB, use them
            const messages = Item?.lastMessages?.L;
            if (messages && messages.length >= 5) {
                return messages
                    .map(msg => msg.S)
                    .filter((content): content is string => content !== undefined);
            }

            // Not enough context in DynamoDB, fetch from PostgreSQL
            const dbMessages = type === "channel"
                ? await this.getChannelHistory(contextId)
                : await this.getDMHistory(contextId);

            // Store the context in DynamoDB for future use
            await this.updateChatContext(contextId, type, dbMessages);

            // Filter out any null content
            return dbMessages
                .map(msg => msg.content)
                .filter((content): content is string => content !== null);
        } catch (error) {
            console.error("Error getting chat context:", error);
            throw new Error("Failed to retrieve chat context");
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
                                S: msg.content as string
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
        const messages = await prisma.directMessage.findMany({
            where: {
                id: dmId,
                content: { not: null }
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

    private async summarizeMessages(messages: Message[], type: 'channel' | 'dm'): Promise<string> {
        const messageTexts = messages
            .filter(msg => msg.content)
            .map(msg => `${msg.user?.name || 'Unknown'}: ${msg.content}`)
            .join('\n');

        const prompt = `Please summarize the following conversation, focusing on key points and maintaining context:
        
        ${messageTexts}
        
        Provide a concise summary that captures the main topics and important details.`;

        try {
            const summary = await aiService.generateResponse(prompt);
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

    public async updateContextWithSummary(contextId: string, type: 'channel' | 'dm'): Promise<void> {
        try {
            // Fetch recent messages
            const messages = type === 'channel'
                ? await this.getChannelHistory(contextId)
                : await this.getDMHistory(contextId);

            // Generate summary
            const summary = await this.summarizeMessages(messages, type);

            // Update DynamoDB with summary
            const command = new PutItemCommand({
                TableName: CHAT_MEMORY_TABLE,
                Item: {
                    contextId: { S: contextId },
                    type: { S: type },
                    summary: { S: summary },
                    lastUpdated: { N: Date.now().toString() },
                    messageCount: { N: messages.length.toString() },
                    expiresAt: { N: Math.floor(Date.now() / 1000 + 24 * 60 * 60).toString() } // 24 hours TTL
                }
            });

            await dynamoDbClient.send(command);
            console.log(`Context summary updated for ${type} ${contextId}`);
        } catch (error) {
            console.error('Error updating context with summary:', error);
            throw error;
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
            let currentBatchStartTime = sortedMessages[0]?.createdAt;

            for (const message of sortedMessages) {
                if (!currentBatchStartTime) {
                    currentBatchStartTime = message.createdAt;
                }

                const timeDiff = message.createdAt.getTime() - currentBatchStartTime.getTime();
                const isNewTopic = await this.isNewTopic(message, currentBatch);

                // Start new batch if:
                // 1. Current batch has been going for more than 1 hour, or
                // 2. Message appears to be starting a new topic
                if (timeDiff > 3600000 || isNewTopic) {
                    if (currentBatch.length > 0) {
                        batches.push(currentBatch);
                    }
                    currentBatch = [message];
                    currentBatchStartTime = message.createdAt;
                } else {
                    currentBatch.push(message);
                }
            }

            // Add the last batch if it has messages
            if (currentBatch.length > 0) {
                batches.push(currentBatch);
            }

            // Process each batch to generate summaries
            const summaries: TopicSummary[] = [];
            for (const batch of batches) {
                const messageTexts = batch
                    .filter(msg => msg.content)
                    .map(msg => `${msg.user?.name || 'Unknown'}: ${msg.content}`)
                    .join('\n');

                const prompt = `Analyze this conversation segment and provide:
                1. The main topic being discussed (1-3 words)
                2. A concise summary of the key points (2-3 sentences)
                
                Conversation:
                ${messageTexts}
                
                Format your response as:
                TOPIC: [topic]
                SUMMARY: [summary]`;

                const response = await aiService.generateResponse(prompt);
                const [topicLine, summaryLine] = response.split('\n');

                const topic = topicLine.replace('TOPIC:', '').trim();
                const summary = summaryLine.replace('SUMMARY:', '').trim();

                summaries.push({
                    topic,
                    summary,
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
     * Check if a message appears to be starting a new topic
     */
    private async isNewTopic(message: Message, currentBatch: Message[]): Promise<boolean> {
        if (currentBatch.length === 0) return true;

        const lastMessages = currentBatch.slice(-3)
            .filter(msg => msg.content)
            .map(msg => msg.content)
            .join('\n');

        const prompt = `Given the previous messages:
        ${lastMessages}
        
        And the new message:
        ${message.content}
        
        Is this message starting a new topic? Answer with just 'yes' or 'no'.`;

        try {
            const response = await aiService.generateResponse(prompt);
            return response.toLowerCase().includes('yes');
        } catch (error) {
            console.error('Error detecting new topic:', error);
            return false;
        }
    }

    /**
     * Handle real-time message updates
     */
    async handleRealTimeUpdate(message: Message, type: "channel" | "dm"): Promise<void> {
        try {
            const contextId = type === "channel" ? message.channelId || message.id : message.id;

            // Get existing context
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
            const isNewTopic = await this.isNewTopic(message, existingMessages);

            if (isNewTopic) {
                // If it's a new topic, trigger a batch summarization
                const messages = type === "channel"
                    ? await this.getChannelHistory(contextId)
                    : await this.getDMHistory(contextId);

                const summaries = await this.batchSummarizeMessages(messages);

                // Store the latest summary
                await this.updateContextWithBatchSummaries(contextId, type, summaries);
            } else {
                // Otherwise, just append the message to existing context
                existingMessages.push(message);

                // Keep only last 50 messages
                const recentMessages = existingMessages.slice(-50);

                await this.updateChatContext(contextId, type, recentMessages);
            }
        } catch (error) {
            console.error("Error handling real-time update:", error);
            throw new Error("Failed to handle real-time update");
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
}

export const contextService = new ContextService(); 