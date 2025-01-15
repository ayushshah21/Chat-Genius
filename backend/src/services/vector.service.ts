import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from './prisma.service';
import { Pinecone } from '@pinecone-database/pinecone';
import { Document } from 'langchain/document';
import { OpenAIEmbeddings } from '@langchain/openai';
import { PineconeStore } from '@langchain/pinecone';
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
import { ChatOpenAI } from '@langchain/openai';
import { PromptTemplate } from '@langchain/core/prompts';
import { StringOutputParser } from '@langchain/core/output_parsers';
import { RunnableSequence } from '@langchain/core/runnables';

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

interface QueryResult {
    content: string;
    metadata: VectorMetadata;
    score: number;
}

interface FilterMetadata {
    type?: 'dm' | 'channel';
    userId?: string;
    channelId?: string;
}

@Injectable()
export class VectorService {
    private vectorStore!: PineconeStore;
    private embeddings: OpenAIEmbeddings;
    private pinecone: Pinecone;
    private llm: ChatOpenAI;
    private qaChain!: RunnableSequence;
    private initialized = false;
    private initializationPromise: Promise<void> | null = null;
    private textSplitter: RecursiveCharacterTextSplitter;

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

        // Initialize text splitter with token-based settings
        this.textSplitter = new RecursiveCharacterTextSplitter({
            chunkSize: 300,
            chunkOverlap: 50,
        });

        console.log('[VectorService] Constructor initialized successfully');

        // Start initialization immediately
        this.initializeVectorStore();

        // Initialize OpenAI for QA
        this.llm = new ChatOpenAI({
            modelName: 'gpt-4-turbo-preview',
            temperature: 0.7,
            maxTokens: 250
        });
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

        // Initialize QA Chain
        await this.initializeQAChain();
    }

    private async ensureInitialized() {
        if (!this.initialized) {
            await this.initializeVectorStore();
        }
    }

    private formatDocuments(docs: Document[]): string {
        return docs.map((doc, i) => {
            const metadata = doc.metadata as VectorMetadata;
            const timeAgo = Math.floor((Date.now() - new Date(metadata.createdAt).getTime()) / (1000 * 60));
            return `[${timeAgo}m ago] ${metadata.userName || 'Unknown'}: ${doc.pageContent}`;
        }).join('\n\n');
    }

    /**
     * Add documents to the vector store
     */
    async addDocuments(documents: Document<VectorMetadata>[]): Promise<void> {
        console.log('[VectorService] Adding documents:', documents.length);

        try {
            // Process documents in batches
            const processedDocs = await Promise.all(
                documents.map(async doc => {
                    // Split into chunks if needed
                    if (doc.pageContent.length > 1000) {
                        return await this.textSplitter.splitDocuments([doc]);
                    }
                    return [doc];
                })
            );

            // Flatten the array of document arrays
            const flatDocs = processedDocs.flat();
            console.log(`[VectorService] Processing ${flatDocs.length} total chunks`);

            // Add documents to vector store
            await this.vectorStore.addDocuments(flatDocs);

            // Verify each document was added
            for (const doc of documents) {
                await this.verifyDocument(doc);
            }
        } catch (error) {
            console.error('[VectorService] Error adding documents:', error);
            throw error;
        }
    }

    /**
     * Query the vector store for similar documents
     */
    async queryVectors(query: string, options?: {
        k?: number;
        isDM?: boolean;
        userId?: string;
    }): Promise<VectorSearchResult[]> {
        const numResults = options?.k || 10;
        console.log('[VectorService] Starting vector query:', { query, numResults, options });

        try {
            // Enhanced retriever options with better MMR settings
            const retrieverOptions: any = {
                searchType: "mmr",
                searchKwargs: {
                    fetchK: numResults * 4,  // Increased fetch size for better candidate pool
                    lambda: 0.5,  // Adjusted for better balance between relevance and diversity
                    k: numResults
                }
            };

            // Improved filter logic for better context sharing
            if (options?.isDM && options?.userId) {
                // For DMs, include:
                // 1. User's direct messages
                // 2. Public channel messages
                // 3. Relevant summaries
                retrieverOptions.filter = {
                    OR: [
                        { type: 'dm', userId: options.userId },
                        { type: 'channel' },
                        { type: 'summary' }
                    ]
                };
            }

            // MMR-based retriever
            const retriever = this.vectorStore.asRetriever(retrieverOptions);

            console.log('[VectorService] Configured MMR retriever:', {
                numResults,
                fetchK: numResults * 4,
                lambda: 0.5,
                filter: retrieverOptions.filter || 'none'
            });

            const results = await retriever.invoke(query);

            console.log('[VectorService] Raw retrieval results:', {
                count: results.length,
                sample: results.slice(0, 2).map(doc => ({
                    content: doc.pageContent.substring(0, 100),
                    metadata: doc.metadata
                }))
            });

            // Enhanced result processing with recency weighting
            const processedResults = results.map(doc => {
                const metadata = doc.metadata as VectorMetadata;
                const age = (Date.now() - new Date(metadata.createdAt).getTime()) / (1000 * 60); // age in minutes
                const recencyBoost = Math.exp(-age / 1000); // Exponential decay based on age
                const score = (doc.metadata.score || 0.5) * (1 + recencyBoost);

                return {
                    pageContent: doc.pageContent,
                    metadata: metadata,
                    score: score
                };
            });

            // Sort by enhanced score and return top results
            return processedResults
                .sort((a, b) => b.score - a.score)
                .slice(0, numResults);

        } catch (error) {
            console.error('[VectorService] Error in queryVectors:', {
                error: error instanceof Error ? {
                    message: error.message,
                    name: error.name,
                    stack: error.stack
                } : error,
                query,
                options
            });
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
        // Implementation for cleaning up test data
        console.log('[VectorService] Cleaning up test data...');
        // Add your cleanup logic here
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
        // Search for similar content with MMR
        const results = await this.queryVectors(prompt, {
            k: 5,
            userId  // Include user context
        });

        // Filter and sort results with lowered threshold
        return results
            .filter(result => result.score && result.score > 0.3) // Lowered threshold
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
            .slice(0, 5);
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
            // Get vector search results with MMR
            const vectorResults = await this.queryVectors(query, {
                k: options.limit || 10,
                isDM: !options.channelId,
                userId: options.userId
            });

            // Get recent messages from database
            const recentMessages = await this.prismaService.message.findMany({
                where: options.channelId
                    ? { channelId: options.channelId }
                    : {
                        userId: options.userId,
                        channelId: undefined
                    },
                take: 30,
                orderBy: { createdAt: 'desc' },
                include: {
                    user: true,
                    channel: true
                }
            });

            // Log results for debugging
            console.log('[VectorService] Results:', {
                vectorResults: vectorResults.length,
                recentMessages: recentMessages.length,
                vectorScores: vectorResults.slice(0, 3).map(r => ({
                    score: r.score,
                    preview: r.pageContent.substring(0, 100)
                }))
            });

            return {
                vectorResults,  // Already sorted by relevance thanks to MMR
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

    private async initializeQAChain() {
        const template = `You are a helpful AI assistant answering questions based on chat history.

Context from conversations (most recent first):
{context}

Question: {question}

Instructions:
1. Use specific details from the context if available
2. If the context doesn't contain relevant information, say so
3. Keep responses concise (2-3 sentences)
4. You can reference information from any channel, but don't share private DM contents
5. If you see specific details (names, numbers, dates), include them in your answer

Answer:`;

        const qaPrompt = PromptTemplate.fromTemplate(template);

        // Create retriever with MMR
        const retriever = this.vectorStore.asRetriever({
            searchType: "mmr",
            searchKwargs: {
                fetchK: 20,
                lambda: 0.7
            }
        });

        // Create a sequence that combines the prompt and language model
        const chain = RunnableSequence.from([
            {
                context: async (input: { question: string }) => {
                    const docs = await retriever.invoke(input.question);
                    return this.formatDocuments(docs);
                },
                question: (input: { question: string }) => input.question
            },
            qaPrompt,
            this.llm,
            new StringOutputParser()
        ]);

        this.qaChain = chain;
    }

    async queryWithQA(
        query: string,
        metadata?: { userId?: string; channelId?: string; type?: 'dm' | 'channel' }
    ): Promise<{ answer: string; sources: QueryResult[] }> {
        try {
            console.log('[VectorService] Starting QA query:', { query, metadata });

            // Enhanced retriever options with better MMR settings
            const retrieverOptions: any = {
                searchType: "mmr",
                searchKwargs: {
                    fetchK: 40,  // Increased for QA to get more context
                    lambda: 0.5,
                    k: 20
                }
            };

            // Improved filter logic for better context sharing
            if (metadata?.type === 'dm' && metadata?.userId) {
                retrieverOptions.filter = {
                    OR: [
                        { type: 'dm', userId: metadata.userId },
                        { type: 'channel' },
                        { type: 'summary' }
                    ]
                };
            }

            // Create a retriever with MMR for this specific query
            const retriever = this.vectorStore.asRetriever(retrieverOptions);

            // Create a one-time chain with the custom retriever
            const queryChain = RunnableSequence.from([
                {
                    context: async (input: { question: string }) => {
                        const docs = await retriever.invoke(input.question);
                        // Apply recency weighting to format
                        const weightedDocs = docs.map(doc => {
                            const age = (Date.now() - new Date(doc.metadata.createdAt).getTime()) / (1000 * 60);
                            const recencyBoost = Math.exp(-age / 1000);
                            doc.metadata.score = (doc.metadata.score || 0.5) * (1 + recencyBoost);
                            return doc;
                        }).sort((a, b) => (b.metadata.score || 0) - (a.metadata.score || 0));
                        return this.formatDocuments(weightedDocs);
                    },
                    question: (input: { question: string }) => input.question
                },
                this.qaChain
            ]);

            const response = await queryChain.invoke({
                question: query
            });

            // Extract source documents with enhanced scoring
            const sources = (await retriever.invoke(query)).map(doc => {
                const age = (Date.now() - new Date(doc.metadata.createdAt).getTime()) / (1000 * 60);
                const recencyBoost = Math.exp(-age / 1000);
                return {
                    content: doc.pageContent,
                    metadata: doc.metadata as VectorMetadata,
                    score: (doc.metadata.score || 0.5) * (1 + recencyBoost)
                };
            }).sort((a, b) => b.score - a.score);

            console.log('[VectorService] QA Response:', {
                answer: response,
                sourceCount: sources.length
            });

            return {
                answer: response,
                sources: sources
            };
        } catch (error) {
            console.error('[VectorService] Error in QA query:', {
                error: error instanceof Error ? {
                    message: error.message,
                    name: error.name,
                    stack: error.stack
                } : error,
                query,
                metadata
            });
            throw new Error('Failed to process QA query');
        }
    }

    async verifyTestDocument(doc: Document<VectorMetadata>, options?: { k?: number }): Promise<boolean> {
        const results = await this.queryVectors(doc.pageContent, { k: options?.k || 1 });
        return results.length > 0 && results[0].score > 0.3;
    }

    async verifyDocument(doc: Document<VectorMetadata>, options?: { maxPreviewLength?: number }): Promise<boolean> {
        const maxPreviewLength = options?.maxPreviewLength || 50; // Default preview length
        // Try different search patterns
        const searchPatterns = [
            doc.pageContent,                                    // Full content
            doc.pageContent.substring(0, Math.min(doc.pageContent.length, maxPreviewLength)),  // First N chars
            doc.pageContent.split(' ').slice(0, 5).join(' '),  // First 5 words
            doc.pageContent.split(' ').slice(-5).join(' ')     // Last 5 words
        ];

        let bestMatch = { score: 0, pattern: '', found: false };
        for (const pattern of searchPatterns) {
            const results = await this.queryVectors(pattern, { k: 1 });
            if (results.length > 0 && results[0].score > bestMatch.score) {
                bestMatch = {
                    score: results[0].score,
                    pattern: pattern.substring(0, Math.min(pattern.length, maxPreviewLength / 2)) + '...',
                    found: true
                };
            }
        }

        if (!bestMatch.found) {
            console.warn('[VectorService] Document verification failed:', {
                content: doc.pageContent.substring(0, Math.min(doc.pageContent.length, maxPreviewLength)) + '...',
                metadata: doc.metadata
            });
            return false;
        }

        return true;
    }
}
