import { Injectable } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { VectorService, QueryOptions, SearchType } from './vector.service';
import { AIService } from './ai.service';
import { VectorSearchResult } from '../types/vector';

interface AISearchResponse {
    answer: string;
    analysis?: string;
    evidence: {
        content: string;
        messageId: string;
        channelId?: string;
        timestamp: string;
        userName?: string;
    }[];
    additionalContext?: string;
}

@Injectable()
export class AISearchService {
    private readonly CACHE_TTL = 1000 * 60 * 60; // 1 hour
    private queryCache = new Map<string, { timestamp: number, expansion: string }>();

    constructor(
        private prismaService: PrismaService,
        private vectorService: VectorService,
        private aiService: AIService
    ) { }

    private reciprocalRankFusion(
        listOfRankedArrays: VectorSearchResult[][],
        query: string,
        kConstant: number = 20
    ): VectorSearchResult[] {
        const fusionMap = new Map<string, {
            doc: VectorSearchResult;
            sumScore: number;
            matchCount: number;
            hasNumber: boolean;
            isRecent: boolean;
        }>();

        // Query analysis
        const queryIntent = {
            isQuantityQuestion: /how\s+many|number\s+of|total/i.test(query),
            isHiringQuestion: /(hiring|roles?|positions?|jobs?|openings?)/i.test(query),
            isCurrentQuestion: /(current|currently|right now|at the moment)/i.test(query)
        };

        for (const rankedArray of listOfRankedArrays) {
            rankedArray.forEach((doc, rank) => {
                const key = doc.metadata.messageId;
                const content = doc.pageContent.toLowerCase();

                // Base RRF score with position boost
                let score = 1 / (kConstant + (rank + 1));

                // Content relevance scoring
                const contentScore = this.calculateContentScore(content, query, queryIntent);
                score *= (1 + contentScore.score);

                // Time relevance for "current" questions
                const isRecent = this.isRecentMessage(doc.metadata.createdAt);
                if (queryIntent.isCurrentQuestion && isRecent) {
                    score *= 1.5;
                }

                // Combine scores with existing entry or create new
                if (!fusionMap.has(key)) {
                    fusionMap.set(key, {
                        doc,
                        sumScore: score,
                        matchCount: contentScore.matchCount,
                        hasNumber: contentScore.hasNumber,
                        isRecent
                    });
                } else {
                    const existing = fusionMap.get(key)!;
                    existing.sumScore = Math.max(existing.sumScore, score);
                    existing.matchCount = Math.max(existing.matchCount, contentScore.matchCount);
                }
            });
        }

        return Array.from(fusionMap.values())
            .sort((a, b) => {
                // Multi-factor sorting
                if (queryIntent.isQuantityQuestion) {
                    if (a.hasNumber !== b.hasNumber) return a.hasNumber ? -1 : 1;
                }
                if (queryIntent.isCurrentQuestion) {
                    if (a.isRecent !== b.isRecent) return a.isRecent ? -1 : 1;
                }
                return b.sumScore - a.sumScore;
            })
            .map(entry => ({
                ...entry.doc,
                score: entry.sumScore
            }));
    }

    private calculateContentScore(content: string, query: string, queryIntent: any) {
        let score = 0;
        let matchCount = 0;
        let hasNumber = false;

        // Check for numbers in hiring context
        if (queryIntent.isHiringQuestion && queryIntent.isQuantityQuestion) {
            const numberMatch = content.match(/(\d+)(\+|\s*plus)?/);
            if (numberMatch) {
                hasNumber = true;
                const number = parseInt(numberMatch[1], 10);
                if (number > 50) score += 1.0;
                if (content.includes('+') || content.includes('plus')) score += 0.5;
            }
        }

        // Phrase matching
        const phrases = [
            'hiring for',
            'open positions',
            'job openings',
            'current roles',
            'looking to hire'
        ];

        for (const phrase of phrases) {
            if (content.includes(phrase)) {
                score += 0.3;
                matchCount++;
            }
        }

        return { score, matchCount, hasNumber };
    }

    private isRecentMessage(createdAt: string): boolean {
        const messageDate = new Date(createdAt);
        const now = new Date();
        const daysDiff = (now.getTime() - messageDate.getTime()) / (1000 * 60 * 60 * 24);
        return daysDiff <= 7; // Consider messages within last 7 days as recent
    }

    private async getQueryExpansion(query: string): Promise<string | null> {
        // 1. Check cache first
        const cached = this.queryCache.get(query);
        if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
            return cached.expansion;
        }

        // 2. Simple synonym/expansion for short queries
        if (query.length <= 10) {
            const simpleExpansions: Record<string, string[]> = {
                'milk': ['dairy', 'grocery', 'store'],
                // Add more common cases
            };
            const words = query.toLowerCase().split(' ');
            const expansions = words.map(w => simpleExpansions[w] || [w]).flat();
            if (expansions.length > words.length) {
                return expansions.join(' ');
            }
        }

        // 3. AI-based expansion for complex queries
        try {
            const expansion = await this.aiService.generateResponse(
                `Rephrase this search query to find similar meanings (be concise): "${query}"`,
                ''
            );
            this.queryCache.set(query, { timestamp: Date.now(), expansion });
            return expansion;
        } catch (error) {
            console.error('Failed to expand query:', error);
            return null;
        }
    }

    private async getRetrievalSets(query: string, userId: string): Promise<VectorSearchResult[][]> {
        // 1. Enhanced query analysis
        const normalizedQuery = query.toLowerCase().trim()
            .replace(/[.,!?]/g, '')  // Remove punctuation
            .replace(/\s+/g, ' ');   // Normalize spaces

        // 2. Query intent detection
        const queryIntent = {
            isQuantityQuestion: /how\s+many|number\s+of|total/i.test(query),
            isHiringQuestion: /(hiring|roles?|positions?|jobs?|openings?)/i.test(query),
            isCurrentQuestion: /(current|currently|right now|at the moment)/i.test(query)
        };

        // 3. Generate query variations
        const queryVariations = [
            normalizedQuery,
            // Add common variations for hiring questions
            ...(queryIntent.isHiringQuestion ? [
                normalizedQuery.replace(/roles?/g, 'positions'),
                normalizedQuery.replace(/roles?/g, 'jobs'),
                normalizedQuery.replace(/hiring/g, 'recruiting'),
            ] : []),
            // Add time-based variations
            ...(queryIntent.isCurrentQuestion ? [
                normalizedQuery.replace(/currently/g, 'right now'),
                normalizedQuery.replace(/current/g, 'latest'),
            ] : [])
        ];

        // 4. Run parallel searches with different strategies
        const searchPromises = queryVariations.flatMap(variation => [
            this.vectorService.queryVectors(variation, {
                k: 20,
                userId,
                searchType: 'vector'
            } as QueryOptions),
            this.vectorService.queryVectors(variation, {
                k: 20,
                userId,
                searchType: 'keyword'
            } as QueryOptions)
        ]);

        // Add semantic search with AI expansion
        const expansion = await this.getQueryExpansion(query);
        if (expansion) {
            searchPromises.push(
                this.vectorService.queryVectors(expansion, {
                    k: 15,
                    userId,
                    searchType: 'vector'
                } as QueryOptions)
            );
        }

        const results = await Promise.all(searchPromises);

        // Deduplicate and merge results
        const seenIds = new Set<string>();
        const dedupedResults = results.map(set =>
            set.filter(doc => {
                const id = doc.metadata.messageId;
                if (seenIds.has(id)) return false;
                seenIds.add(id);
                return true;
            })
        );

        return dedupedResults;
    }

    async performSearch(query: string, userId: string): Promise<AISearchResponse> {
        // 1. Debug initial retrieval
        const resultSets = await this.getRetrievalSets(query, userId);
        console.log('[AISearchService] Initial retrieval:', {
            vectorSetSize: resultSets[0].length,
            keywordSetSize: resultSets[1].length,
            semanticSetSize: resultSets[2]?.length,
            sampleMessages: resultSets.map(set => set.slice(0, 2).map(msg => ({
                content: msg.pageContent,
                messageId: msg.metadata.messageId,
                score: msg.score
            })))
        });

        // 2. Debug RRF results
        const fusedResults = this.reciprocalRankFusion(resultSets, query);
        console.log('[AISearchService] After RRF fusion:', {
            beforeFilter: resultSets.reduce((acc, set) => acc + set.length, 0),
            afterFusion: fusedResults.length,
            sampleScores: fusedResults.slice(0, 3).map(msg => ({
                score: msg.score,
                content: msg.pageContent.substring(0, 50)
            }))
        });

        // 3. Debug permission check
        const messageIds = fusedResults.map(msg => msg.metadata.messageId);
        console.log('[AISearchService] Checking permissions for:', {
            messageIds,
            userId
        });

        const accessibleMessageIds = await this.prismaService.message.findMany({
            where: {
                id: { in: messageIds },
                OR: [
                    { channel: { type: 'PUBLIC' } },
                    { channel: { members: { some: { id: userId } } } },
                    { userId },
                    {
                        channel: {
                            type: 'DIRECT',
                            members: { some: { id: userId } }
                        }
                    }
                ]
            },
            select: {
                id: true,
                channel: {
                    select: {
                        id: true,
                        type: true
                    }
                }
            }
        });

        console.log('[AISearchService] Permission check results:', {
            checkedIds: messageIds.length,
            accessibleIds: accessibleMessageIds.length,
            channels: accessibleMessageIds.map(m => ({
                messageId: m.id,
                channelType: m.channel?.type
            }))
        });

        // 4. Filter out unpermitted
        const permittedIds = new Set(accessibleMessageIds.map(m => m.id));
        let filteredMessages = fusedResults
            .filter(msg => permittedIds.has(msg.metadata.messageId));

        // 5. Apply cross-encoder reranking for more accurate relevance
        try {
            console.log('[AISearchService] Applying cross-encoder reranking...');
            filteredMessages = await this.aiService.crossEncoderRerank(query, filteredMessages);
        } catch (error) {
            console.error('[AISearchService] Cross-encoder reranking failed:', error);
            // Continue with original ranking if reranking fails
        }

        // 6. Take top results
        filteredMessages = filteredMessages.slice(0, 5);

        console.log('[AISearchService] Final filtered messages:', {
            before: fusedResults.length,
            afterPermissions: filteredMessages.length,
            messages: filteredMessages.map(msg => ({
                content: msg.pageContent.substring(0, 50) + '...',
                messageId: msg.metadata.messageId,
                channelId: msg.metadata.channelId,
                score: msg.score
            }))
        });

        if (filteredMessages.length === 0) {
            return {
                answer: "I couldn't find any messages about that topic that you have access to.",
                evidence: [],
                additionalContext: "No accessible messages found"
            };
        }

        // 7. Format context with clear delineation
        const context = filteredMessages
            .map((msg, i) => `[${i + 1}] ${msg.metadata.userName}: ${msg.pageContent}`)
            .join('\n\n');

        // 8. Generate AI response
        const answer = await this.aiService.generateResponse(query, context);

        return {
            answer,
            evidence: filteredMessages.map(msg => ({
                content: msg.pageContent,
                messageId: msg.metadata.messageId,
                channelId: msg.metadata.channelId,
                timestamp: msg.metadata.createdAt,
                userName: msg.metadata.userName || undefined
            })),
            additionalContext: `Found ${filteredMessages.length} relevant messages`
        };
    }
} 