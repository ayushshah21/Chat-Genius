import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from './prisma.service';
import { Pinecone } from '@pinecone-database/pinecone';
import { Document } from 'langchain/document';
import { OpenAIEmbeddings } from '@langchain/openai';
import { PineconeStore } from '@langchain/pinecone';
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';

export interface VectorMetadata {
    messageId: string;
    userId: string;
    userName: string | null;
    channelId?: string;
    type: 'channel' | 'dm' | 'summary';
    createdAt: string;
    isAI: boolean;
}

export interface VectorSearchResult {
    pageContent: string;
    metadata: VectorMetadata;
    score: number;
}

@Injectable()
export class VectorService {
    private pinecone: Pinecone;
    private embeddings: OpenAIEmbeddings;
    private vectorStore!: PineconeStore;
    private initialized = false;
    private initializationPromise: Promise<void> | null = null;

    constructor(
        private configService: ConfigService,
        private prismaService: PrismaService
    ) {
        console.log('[VectorService] Initializing constructor...');
        const pineconeApiKey = this.configService.get<string>('PINECONE_API_KEY');
        if (!pineconeApiKey) {
            throw new Error('PINECONE_API_KEY is required');
        }

        this.pinecone = new Pinecone({
            apiKey: pineconeApiKey,
        });

        const openAIApiKey = this.configService.get<string>('OPENAI_API_KEY');
        if (!openAIApiKey) {
            throw new Error('OPENAI_API_KEY is required');
        }

        this.embeddings = new OpenAIEmbeddings({
            openAIApiKey,
            modelName: 'text-embedding-3-large'
        });
        console.log('[VectorService] Constructor initialized successfully');

        // Start initialization immediately
        this.initializeVectorStore();
    }

    private async initializeVectorStore(retries = 3): Promise<void> {
        if (this.initialized) return;
        if (this.initializationPromise) return this.initializationPromise;

        this.initializationPromise = (async () => {
            console.log('[VectorService] Starting vector store initialization...');
            const indexName = this.configService.get<string>('PINECONE_INDEX');
            if (!indexName) {
                throw new Error('PINECONE_INDEX is required');
            }

            let lastError: Error | null = null;
            for (let attempt = 1; attempt <= retries; attempt++) {
                try {
                    console.log(`[VectorService] Initialization attempt ${attempt}/${retries}`);
                    const index = this.pinecone.Index(indexName);

                    // Initialize with optimized configuration
                    this.vectorStore = await PineconeStore.fromExistingIndex(
                        this.embeddings,
                        {
                            pineconeIndex: index,
                            textKey: 'pageContent',     // Match Document interface
                            namespace: '',              // Use default namespace
                        }
                    );

                    // Verify the index is accessible
                    const stats = await index.describeIndexStats();
                    console.log('[VectorService] Index configuration:', {
                        dimension: stats.dimension,
                        namespaces: stats.namespaces,
                        totalRecordCount: stats.totalRecordCount,
                        textKey: 'pageContent',
                        namespace: ''
                    });

                    this.initialized = true;
                    console.log('[VectorService] Vector store initialized successfully');
                    return;
                } catch (error) {
                    lastError = error as Error;
                    console.error(`[VectorService] Initialization attempt ${attempt} failed:`, error);
                    if (attempt < retries) {
                        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
                        await new Promise(resolve => setTimeout(resolve, delay));
                    }
                }
            }
            throw lastError || new Error('Failed to initialize vector store after retries');
        })();

        return this.initializationPromise;
    }

    async onModuleInit() {
        await this.initializeVectorStore();
    }

    private async ensureInitialized() {
        if (!this.initialized) {
            await this.initializeVectorStore();
        }
    }

    /**
     * Add documents to the vector store
     */
    async addDocuments(documents: Document<VectorMetadata>[]): Promise<void> {
        console.log(`[VectorService] Adding ${documents.length} documents to vector store...`);
        try {
            // Calculate average document length
            const avgLength = documents.reduce((sum, doc) => sum + doc.pageContent.length, 0) / documents.length;
            console.log('[VectorService] Average document length:', avgLength);

            // Configure text splitter based on average length
            const textSplitter = new RecursiveCharacterTextSplitter({
                chunkSize: Math.max(500, avgLength),  // Minimum chunk size of 500
                chunkOverlap: Math.min(100, Math.floor(avgLength * 0.1)),  // 10% overlap, max 100 chars
                separators: ["\n\n", "\n", " ", ""]
            });

            // Split documents if they're long enough
            const processedDocs = await Promise.all(
                documents.map(async (doc) => {
                    if (doc.pageContent.length > 500) {  // Only split if longer than minimum chunk size
                        const splits = await textSplitter.splitDocuments([doc]);
                        console.log(`[VectorService] Split document into ${splits.length} chunks`);
                        return splits;
                    }
                    return [doc];
                })
            );

            // Flatten the array of document arrays
            const flatDocs = processedDocs.flat();
            console.log(`[VectorService] Processing ${flatDocs.length} total chunks`);

            // Add documents to vector store
            await this.vectorStore.addDocuments(flatDocs);

            // Verify each original document was added with multiple search patterns
            for (const doc of documents) {
                // Try different search patterns
                const searchPatterns = [
                    doc.pageContent,                                    // Full content
                    doc.pageContent.substring(0, Math.min(100, doc.pageContent.length)),  // First 100 chars
                    doc.pageContent.split(' ').slice(0, 5).join(' '),  // First 5 words
                    doc.pageContent.split(' ').slice(-5).join(' ')     // Last 5 words
                ];

                let bestMatch = { score: 0, pattern: '', found: false };
                for (const pattern of searchPatterns) {
                    const results = await this.vectorStore.similaritySearchWithScore(pattern, 1);
                    if (results.length > 0 && results[0][1] > bestMatch.score) {
                        bestMatch = {
                            score: results[0][1],
                            pattern: pattern.substring(0, 50) + '...',
                            found: true
                        };
                    }
                }

                console.log('[VectorService] Document verification:', {
                    content: doc.pageContent.substring(0, 50) + '...',
                    bestMatch,
                    metadata: doc.metadata,
                    originalLength: doc.pageContent.length,
                    wasChunked: doc.pageContent.length > 2000
                });

                if (!bestMatch.found) {
                    console.warn('[VectorService] Document not found with any pattern:', {
                        content: doc.pageContent.substring(0, 50) + '...',
                        messageId: doc.metadata.messageId,
                        length: doc.pageContent.length
                    });
                }
            }
        } catch (error) {
            console.error('[VectorService] Error adding documents:', error);
            throw error;
        }
    }

    /**
     * Query the vector store for similar documents
     */
    async queryVectors(query: string, k: number = 5): Promise<VectorSearchResult[]> {
        console.log('[VectorService] Starting vector query:', { query, k });
        try {
            // Extract query keywords once for reuse
            const queryWords = query.toLowerCase().split(' ').filter(w => w.length > 3);

            // Get more initial results for better filtering
            const results = await this.vectorStore.similaritySearchWithScore(query, k * 3);

            // Convert to vector results with enhanced scoring
            let vectorResults = results.map(([doc, score]) => {
                const metadata = doc.metadata as VectorMetadata;
                const timeAgo = Date.now() - new Date(metadata.createdAt).getTime();

                // Recency boost: Stronger for very recent messages (last hour), decays over time
                const recencyBoost = Math.min(0.3, 1 / (1 + timeAgo / (1000 * 60 * 60)));

                // Content length penalty: Slight penalty for very short messages
                const lengthMultiplier = Math.min(1, doc.pageContent.length / 100);

                // Question/Answer boost: Boost messages that are responses
                const isAnswer = !doc.pageContent.trim().endsWith('?');
                const answerBoost = isAnswer ? 0.1 : 0;

                // Topic relevance: Check if content contains keywords from query
                const contentWords = doc.pageContent.toLowerCase().split(' ');
                const keywordMatches = queryWords.filter(w => contentWords.includes(w)).length;
                const keywordBoost = keywordMatches > 0 ? 0.1 * keywordMatches : 0;

                const adjustedScore = (score * lengthMultiplier) + recencyBoost + answerBoost + keywordBoost;

                return {
                    pageContent: doc.pageContent,
                    metadata,
                    score: adjustedScore,
                    originalScore: score,
                    recencyBoost,
                    lengthMultiplier,
                    answerBoost,
                    keywordBoost
                };
            });

            // Improved deduplication: Consider content similarity and metadata
            vectorResults = vectorResults.filter((result, index) => {
                const isDuplicate = vectorResults.some((other, otherIndex) => {
                    if (index === otherIndex) return false;

                    // Check for similar content
                    const contentSimilarity = other.pageContent.toLowerCase().includes(result.pageContent.toLowerCase()) ||
                        result.pageContent.toLowerCase().includes(other.pageContent.toLowerCase());

                    // Check if they're from the same conversation/context
                    const sameContext = other.metadata.channelId === result.metadata.channelId &&
                        Math.abs(new Date(other.metadata.createdAt).getTime() -
                            new Date(result.metadata.createdAt).getTime()) < 5 * 60 * 1000; // 5 minutes

                    return contentSimilarity && sameContext;
                });

                return !isDuplicate;
            });

            // Log results for debugging
            console.log('[VectorService] Processed results:', vectorResults.map(r => ({
                score: r.score.toFixed(3),
                originalScore: r.originalScore.toFixed(3),
                recencyBoost: r.recencyBoost.toFixed(3),
                lengthMultiplier: r.lengthMultiplier.toFixed(3),
                answerBoost: r.answerBoost.toFixed(3),
                keywordBoost: r.keywordBoost.toFixed(3),
                content: r.pageContent.substring(0, 100) + '...',
                timeAgo: Math.floor((Date.now() - new Date(r.metadata.createdAt).getTime()) / (1000 * 60)) + 'm ago',
                type: r.metadata.type,
                channelId: r.metadata.channelId
            })));

            // If no good results, try keyword search
            if (vectorResults.every(r => r.score < 0.3)) {
                console.log('[VectorService] Low scores, attempting keyword search...');
                const keywordResults = await this.vectorStore.similaritySearchWithScore(
                    queryWords.join(' '),
                    Math.floor(k * 1.5)
                );

                // Process keyword results with same scoring logic
                const keywordVectorResults = keywordResults.map(([doc, score]) => {
                    const metadata = doc.metadata as VectorMetadata;
                    const timeAgo = Date.now() - new Date(metadata.createdAt).getTime();
                    const recencyBoost = Math.min(0.3, 1 / (1 + timeAgo / (1000 * 60 * 60)));
                    const lengthMultiplier = Math.min(1, doc.pageContent.length / 100);
                    const isAnswer = !doc.pageContent.trim().endsWith('?');
                    const answerBoost = isAnswer ? 0.1 : 0;
                    const keywordBoost = 0.2; // Higher boost for keyword matches

                    return {
                        pageContent: doc.pageContent,
                        metadata,
                        score: (score * 0.8 * lengthMultiplier) + recencyBoost + answerBoost + keywordBoost,
                        originalScore: score,
                        recencyBoost,
                        lengthMultiplier,
                        answerBoost,
                        keywordBoost
                    };
                });

                vectorResults = [...vectorResults, ...keywordVectorResults];
            }

            return vectorResults
                .sort((a, b) => b.score - a.score)
                .slice(0, k)
                .map(({ pageContent, metadata, score }) => ({
                    pageContent,
                    metadata,
                    score
                }));
        } catch (error) {
            console.error('[VectorService] Error querying vectors:', error);
            throw error;
        }
    }

    /**
     * Delete vectors by filter
     */
    async deleteVectors(filter: Partial<VectorMetadata>): Promise<void> {
        await this.ensureInitialized();

        // Use the vectorStore's delete method
        await this.vectorStore.delete({
            filter: filter
        });
    }

    /**
     * Delete vectors by their IDs
     */
    async deleteVectorsByIds(ids: string[]): Promise<void> {
        await this.ensureInitialized();

        // Delete in batches of 1000 as recommended by Pinecone
        const batchSize = 1000;
        for (let i = 0; i < ids.length; i += batchSize) {
            const batch = ids.slice(i, i + batchSize);
            await this.vectorStore.delete({
                ids: batch
            });
            console.log(`[VectorService] Deleted batch of ${batch.length} vectors`);

            // Add a small delay between batches if there are more
            if (i + batchSize < ids.length) {
                await new Promise(resolve => setTimeout(resolve, 100));
            }
        }
    }

    /**
     * Delete all vectors in the index
     */
    async deleteAllVectors(): Promise<void> {
        await this.ensureInitialized();
        await this.vectorStore.delete({
            deleteAll: true
        });
        console.log('[VectorService] Deleted all vectors from index');
    }

    /**
     * Delete test data from the index
     */
    async deleteTestData(): Promise<void> {
        await this.ensureInitialized();
        console.log('[VectorService] Starting test data deletion...');

        try {
            // First, get a sample of the actual metadata structure
            const testResults = await this.queryVectors('test message', 100);
            if (testResults.length > 0) {
                console.log('[VectorService] Sample vector metadata structure:',
                    JSON.stringify(testResults[0].metadata, null, 2));
            }

            // Since metadata filtering isn't supported in serverless indexes,
            // we'll use deleteAll and then re-sync the non-test data
            console.log('[VectorService] Performing full deletion and re-sync...');
            await this.forceFullSync();

            console.log('[VectorService] Test data deletion completed via full sync');
        } catch (error) {
            console.error('[VectorService] Error deleting test data:', error);
            if (error instanceof Error) {
                console.error('[VectorService] Error details:', {
                    name: error.name,
                    message: error.message,
                    stack: error.stack
                });
            }
            throw error;
        }
    }

    /**
     * Force a full sync of all messages
     */
    async forceFullSync(): Promise<void> {
        console.log('[VectorService] Starting full sync of all messages');

        try {
            // First delete all existing vectors
            await this.deleteAllVectors();

            // Then sync all messages from the last 30 days
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

            await this.syncMessagesFromPostgres({
                startDate: thirtyDaysAgo,
                batchSize: 50 // Smaller batch size for better progress tracking
            });

            console.log('[VectorService] Full sync completed successfully');
        } catch (error) {
            console.error('[VectorService] Error during full sync:', error);
            throw error;
        }
    }

    /**
     * Get relevant context for a given prompt and user
     */
    async getRelevantContext(prompt: string, userId: string): Promise<VectorSearchResult[]> {
        // Search for similar content
        const results = await this.queryVectors(prompt);

        // Filter and sort results
        return results
            .filter(result => result.score && result.score > 0.4) // Lower threshold to include more relevant results
            .sort((a, b) => {
                // Prioritize:
                // 1. User's own messages
                // 2. Recent messages
                // 3. Higher similarity scores
                const aScore = (a.metadata.userId === userId ? 0.2 : 0) +
                    (a.score || 0) +
                    (new Date(a.metadata.createdAt).getTime() / Date.now());
                const bScore = (b.metadata.userId === userId ? 0.2 : 0) +
                    (b.score || 0) +
                    (new Date(b.metadata.createdAt).getTime() / Date.now());
                return bScore - aScore;
            })
            .slice(0, 5); // Return top 5 most relevant results
    }

    /**
     * Sync messages from Postgres to vector store
     * @param options Optional parameters to filter which messages to sync
     */
    async syncMessagesFromPostgres(options?: {
        channelId?: string;
        userId?: string;
        startDate?: Date;
        batchSize?: number;
    }): Promise<void> {
        console.log('[VectorService] Starting message sync from Postgres:', options);

        try {
            // Default batch size of 100 messages
            const batchSize = options?.batchSize || 100;
            let processedCount = 0;

            // Build the where clause based on options
            const where: any = {};  // Removed deletedAt filter
            if (options?.channelId) where.channelId = options.channelId;
            if (options?.userId) where.userId = options.userId;
            if (options?.startDate) where.createdAt = { gte: options.startDate };

            // Get total count for progress tracking
            const totalCount = await this.prismaService.message.count({ where });
            console.log(`[VectorService] Found ${totalCount} messages to sync`);

            // Process messages in batches
            while (true) {
                const messages = await this.prismaService.message.findMany({
                    where,
                    take: batchSize,
                    skip: processedCount,
                    include: {
                        user: true,
                        channel: true
                    },
                    orderBy: {
                        createdAt: 'asc'
                    }
                });

                if (messages.length === 0) break;

                // Convert messages to vector store format
                const documents = messages
                    .filter((msg): msg is typeof msg & { content: string } => msg.content !== null)
                    .map(msg => ({
                        pageContent: msg.content,
                        metadata: {
                            messageId: msg.id,
                            userId: msg.userId,
                            userName: msg.user?.name || null,
                            channelId: msg.channelId || undefined,
                            type: msg.channelId ? 'channel' : 'dm',
                            createdAt: msg.createdAt.toISOString(),
                            isAI: msg.isAI || false
                        } as VectorMetadata
                    }));

                // Add to vector store with retries
                let retries = 3;
                while (retries > 0) {
                    try {
                        await this.addDocuments(documents);
                        break;
                    } catch (error) {
                        console.error(`[VectorService] Error adding documents, retries left: ${retries}`, error);
                        retries--;
                        if (retries === 0) throw error;
                        await new Promise(resolve => setTimeout(resolve, 1000));
                    }
                }

                processedCount += messages.length;
                console.log(`[VectorService] Synced ${processedCount}/${totalCount} messages`);
            }

            console.log('[VectorService] Message sync completed successfully');
        } catch (error) {
            console.error('[VectorService] Error syncing messages:', error);
            throw new Error('Failed to sync messages from Postgres');
        }
    }

    /**
     * Get relevant context for a message, combining both vector and traditional search
     */
    async getMessageContext(query: string, options: {
        channelId?: string;
        userId?: string;
        limit?: number;
    }): Promise<{
        vectorResults: VectorSearchResult[];
        recentMessages: any[];
    }> {
        console.log('[VectorService] Getting message context:', {
            query,
            options,
            isChannelContext: !!options.channelId,
            isDMContext: !options.channelId
        });

        try {
            // Get vector search results with a higher limit
            const vectorResults = await this.queryVectors(query, options.limit || 10);
            console.log('[VectorService] Vector results:', {
                count: vectorResults.length,
                results: vectorResults.map(r => ({
                    content: r.pageContent.substring(0, 100) + '...',
                    score: r.score,
                    userId: r.metadata.userId,
                    createdAt: r.metadata.createdAt,
                    type: r.metadata.type
                }))
            });

            // Build where clause based on context type
            let where: any;

            if (options.channelId) {
                // For channel messages, use simple channel filter
                where = { channelId: options.channelId };
                console.log('[VectorService] Using channel context with filter:', where);
            } else {
                // For DMs, include both DM messages and messages from public channels
                where = {
                    OR: [
                        // DM messages between the user and AI-enabled users
                        { channelId: null, userId: options.userId },
                        // Messages from public channels
                        { channel: { type: 'PUBLIC' } }
                    ]
                };
                console.log('[VectorService] Using DM context with filter:', where);
            }

            console.log('[VectorService] Database query:', {
                where: JSON.stringify(where, null, 2),
                take: 30,
                orderBy: { createdAt: 'desc' }
            });

            const recentMessages = await this.prismaService.message.findMany({
                where,
                take: 30,
                orderBy: {
                    createdAt: 'desc'
                },
                include: {
                    user: true,
                    channel: true
                }
            });

            console.log('[VectorService] Recent messages retrieved:', {
                count: recentMessages.length,
                channelMessages: recentMessages.filter(m => m.channelId).length,
                dmMessages: recentMessages.filter(m => !m.channelId).length,
                timeRange: recentMessages.length > 0 ? {
                    oldest: recentMessages[recentMessages.length - 1].createdAt,
                    newest: recentMessages[0].createdAt
                } : null
            });

            // Sort vector results by relevance score
            const sortedVectorResults = vectorResults
                .map(result => {
                    const timeAgo = Date.now() - new Date(result.metadata.createdAt).getTime();
                    const timeBoost = Math.min(0.2, 1 / (1 + timeAgo / (1000 * 60 * 60))); // Decay over hours
                    const userBoost = result.metadata.userId === options.userId ? 0.1 : 0;
                    const contextBoost = options.channelId ?
                        (result.metadata.channelId === options.channelId ? 0.05 : 0) :
                        (result.metadata.type === 'dm' ? 0.05 : 0);

                    const finalScore = (result.score || 0) + timeBoost + userBoost + contextBoost;

                    console.log('[VectorService] Scoring result:', {
                        content: result.pageContent.substring(0, 100),
                        baseScore: result.score,
                        timeBoost,
                        userBoost,
                        contextBoost,
                        finalScore,
                        type: result.metadata.type,
                        channelId: result.metadata.channelId,
                        matchesCurrentChannel: result.metadata.channelId === options.channelId
                    });

                    return { ...result, score: finalScore };
                })
                .sort((a, b) => (b.score || 0) - (a.score || 0))
                .slice(0, 15);

            console.log('[VectorService] Final results:', {
                vectorResults: sortedVectorResults.length,
                recentMessages: recentMessages.length,
                vectorScoreRange: sortedVectorResults.length > 0 ? {
                    min: Math.min(...sortedVectorResults.map(r => r.score || 0)),
                    max: Math.max(...sortedVectorResults.map(r => r.score || 0))
                } : null
            });

            return {
                vectorResults: sortedVectorResults,
                recentMessages: recentMessages.reverse()
            };
        } catch (error) {
            console.error('[VectorService] Error getting message context:', {
                error: error instanceof Error ? {
                    message: error.message,
                    stack: error.stack,
                    name: error.name
                } : error,
                query,
                options
            });
            return {
                vectorResults: [],
                recentMessages: []
            };
        }
    }
}
