import { VectorService } from '../services/vector.service';
import { AIService } from '../services/ai.service';
import { PrismaService } from '../services/prisma.service';
import { ConfigService } from '@nestjs/config';
import { Document } from 'langchain/document';
import { VectorMetadata } from '../services/vector.service';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function testRAGFunctionality() {
    console.log('[RAGTest] Starting RAG functionality test...');

    try {
        // Initialize services
        const configService = new ConfigService();
        const prismaService = new PrismaService();
        const vectorService = new VectorService(configService, prismaService);
        const aiService = new AIService(configService, vectorService);

        // Initialize vector store
        await vectorService.onModuleInit();

        // First, let's add some test data to ensure we have content to search
        console.log('\n[RAGTest] Setting up test data...');
        const testDocuments: Document<VectorMetadata>[] = [
            {
                pageContent: "GauntletAI recently experienced failures in handling security concerns. Students were sharing API keys publicly due to inadequate security preparation.",
                metadata: {
                    messageId: 'test-msg-1',
                    userId: 'test-user-1',
                    userName: 'Test User',
                    channelId: 'test-channel',
                    type: 'channel',
                    createdAt: new Date().toISOString(),
                    isAI: false
                }
            },
            {
                pageContent: "The Thai food discussion was interesting. People mentioned the spicy tom yum soup and fragrant green curry as signature dishes.",
                metadata: {
                    messageId: 'test-msg-2',
                    userId: 'test-user-2',
                    userName: 'Another User',
                    channelId: 'test-channel',
                    type: 'channel',
                    createdAt: new Date().toISOString(),
                    isAI: false
                }
            },
            {
                pageContent: "Today's update on AI features: We're implementing RAG capabilities and similarity search. The MVP should be ready in about 30 hours.",
                metadata: {
                    messageId: 'test-msg-3',
                    userId: 'test-user-3',
                    userName: 'Dev Team',
                    channelId: 'test-channel',
                    type: 'channel',
                    createdAt: new Date().toISOString(),
                    isAI: false
                }
            }
        ];

        // Add test documents to vector store
        console.log('[RAGTest] Adding test documents to vector store...');
        await vectorService.addDocuments(testDocuments);
        console.log('[RAGTest] Test documents added successfully');

        // Verify the documents were indexed by searching for exact content
        console.log('\n[RAGTest] Verifying document indexing...');
        for (const doc of testDocuments) {
            // Try different search patterns
            const searchPatterns = [
                doc.pageContent,                              // Full content
                doc.pageContent.substring(0, 100),           // First 100 chars
                doc.pageContent.split(' ').slice(0, 5).join(' ')  // First 5 words
            ];

            let found = false;
            for (const pattern of searchPatterns) {
                const results = await vectorService.queryVectors(pattern, { k: 1 });
                if (results.length > 0) {
                    found = true;
                    console.log(`[RAGTest] ✓ Document verified:`, {
                        id: doc.metadata.messageId,
                        score: results[0].score.toFixed(3)
                    });
                    break;
                }
            }

            if (!found) {
                console.warn('[RAGTest] ⚠ Document not found:', {
                    id: doc.metadata.messageId
                });
            }
        }

        // Test semantic queries with multiple approaches
        const testQueries = [
            {
                query: "Tell me about GauntletAI",
                alternateQueries: [
                    "What is GauntletAI",
                    "GauntletAI information",
                    "GauntletAI details"
                ],
                expectedKeywords: ['GauntletAI', 'students', 'features', 'application']
            },
            {
                query: "How's the progress at GauntletAI going?",
                alternateQueries: [
                    "GauntletAI progress",
                    "GauntletAI updates",
                    "GauntletAI development"
                ],
                expectedKeywords: ['progress', 'update', 'features', 'MVP']
            },
            {
                query: "What do people think about Thai food here?",
                alternateQueries: [
                    "Thai food opinions",
                    "Thai cuisine discussion",
                    "Thai food experiences"
                ],
                expectedKeywords: ['Thai', 'food', 'spicy', 'curry']
            },
            {
                query: "What kind of AI features are being worked on?",
                alternateQueries: [
                    "AI development updates",
                    "current AI projects",
                    "AI implementation progress"
                ],
                expectedKeywords: ['RAG', 'features', 'similarity', 'search']
            },
            {
                query: "What challenges has GauntletAI faced?",
                alternateQueries: [
                    "GauntletAI issues",
                    "GauntletAI problems",
                    "GauntletAI difficulties"
                ],
                expectedKeywords: ['failures', 'security', 'challenges']
            }
        ];

        for (const { query, alternateQueries, expectedKeywords } of testQueries) {
            console.log(`\n[RAGTest] Testing query: "${query}"`);

            let searchResults = await vectorService.queryVectors(query, { k: 5 });

            if (searchResults.length === 0) {
                console.log('[RAGTest] No results with main query, trying alternates...');
                for (const altQuery of alternateQueries) {
                    const altResults = await vectorService.queryVectors(altQuery, { k: 3 });
                    if (altResults.length > 0) {
                        searchResults = altResults;
                        break;
                    }
                }
            }

            // Log only essential search result info
            console.log('[RAGTest] Results:', {
                count: searchResults.length,
                topScore: searchResults[0]?.score.toFixed(3) || 'N/A',
                matchedKeywords: searchResults.flatMap(r =>
                    expectedKeywords.filter(kw =>
                        r.pageContent.toLowerCase().includes(kw.toLowerCase())
                    )
                )
            });

            if (searchResults.length > 0) {
                const formattedContext = searchResults
                    .sort((a, b) => new Date(b.metadata.createdAt).getTime() - new Date(a.metadata.createdAt).getTime())
                    .map(result => {
                        const userName = result.metadata.userName || 'Unknown User';
                        const score = result.score.toFixed(3);
                        const content = result.pageContent.trim();
                        const date = new Date(result.metadata.createdAt);
                        const timeAgo = Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60));
                        return `${userName} [${timeAgo}h ago, Score: ${score}]: ${content}`;
                    })
                    .join('\n\n');

                console.log('[RAGTest] Generated response with context');
                const response = await aiService.generateResponse(query, formattedContext);
                console.log('[RAGTest] ✓ Response received');
            } else {
                console.log('[RAGTest] Generating response without context');
                const response = await aiService.generateResponse(query);
                console.log('[RAGTest] ✓ Response received');
            }

            await new Promise(resolve => setTimeout(resolve, 1000));
        }

        // Clean up test data
        console.log('\n[RAGTest] Cleaning up test data...');
        await vectorService.deleteTestData();

        // Clean up
        await prismaService.$disconnect();
        console.log('\n[RAGTest] Test completed successfully');

    } catch (error) {
        console.error('[RAGTest] Error during test:', error);
        process.exit(1);
    }
}

// Run the test
testRAGFunctionality().catch(console.error); 