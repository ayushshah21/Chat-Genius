import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { ChatCompletionMessageParam } from 'openai/resources/chat/completions';
import { VectorService } from './vector.service';
import { VectorSearchResult } from '../types/vector';

@Injectable()
export class AIService {
    private openai: OpenAI;
    private maxTokens: number;
    private vectorService: VectorService;

    constructor(
        private configService: ConfigService,
        vectorService: VectorService
    ) {
        const openaiApiKey = this.configService.get<string>('OPENAI_API_KEY');
        if (!openaiApiKey) {
            throw new Error('OPENAI_API_KEY is required');
        }

        this.openai = new OpenAI({
            apiKey: openaiApiKey
        });

        const maxTokensStr = this.configService.get<string>('AI_MAX_TOKENS');
        this.maxTokens = maxTokensStr ? parseInt(maxTokensStr, 10) : 4000;

        console.log('[AIService] Configured maxTokens:', this.maxTokens, typeof this.maxTokens);

        this.vectorService = vectorService;
    }

    /**
     * Generate a response using the OpenAI API
     */
    async generateResponse(prompt: string, context?: string): Promise<string> {
        const maxRetries = 3;
        const timeoutDuration = 60000; // 60 seconds
        let attempt = 1;

        while (attempt <= maxRetries) {
            try {
                console.log(`[AIService] Making request to OpenAI (Attempt ${attempt}/${maxRetries}):`);

                const messages: ChatCompletionMessageParam[] = [];
                if (context) {
                    messages.push({
                        role: 'system',
                        content: `You are a focused Q&A system. Your task is to answer questions based STRICTLY on the provided context.

RULES:
1. ONLY use information directly stated in or strongly implied by the context
2. DO NOT add generic advice, best practices, or external knowledge
3. Keep responses brief and to the point
4. If the context doesn't contain relevant information, say "No relevant information found in the context"
5. Maintain the tone and style of the original messages

Context:
${context}`
                    });
                }
                messages.push({
                    role: 'user',
                    content: prompt
                });

                const completion = await Promise.race([
                    this.openai.chat.completions.create({
                        model: 'gpt-4-turbo-preview',
                        messages,
                        max_tokens: this.maxTokens,
                        temperature: 0.3, // Lower temperature for more focused responses
                        top_p: 0.9
                    }),
                    new Promise((_, reject) =>
                        setTimeout(() => reject(new Error(`OpenAI request timed out after ${timeoutDuration / 1000} seconds`)),
                            timeoutDuration)
                    )
                ]) as OpenAI.Chat.ChatCompletion;

                return completion.choices[0].message.content || '';

            } catch (error) {
                const isTimeout = error instanceof Error && error.message.includes('timed out');

                if (attempt === maxRetries || !isTimeout) {
                    console.error('[AIService] Error generating response:', {
                        error: error instanceof Error ? {
                            name: error.name,
                            message: error.message,
                            stack: error.stack
                        } : error,
                        prompt,
                        contextLength: context?.length,
                        attempt,
                        isTimeout
                    });
                    throw error;
                }

                console.log(`[AIService] Request timed out, retrying (${attempt}/${maxRetries})...`);
                await new Promise(resolve => setTimeout(resolve, 1000 * attempt)); // Exponential backoff
                attempt++;
            }
        }

        throw new Error('Should not reach here');
    }

    /**
     * Re-ranks search results using a cross-encoder approach with GPT-4
     * This provides more nuanced relevance scoring by comparing query-document pairs
     */
    async crossEncoderRerank(query: string, docs: VectorSearchResult[]): Promise<VectorSearchResult[]> {
        if (!query.trim() || docs.length === 0) return docs;

        try {
            // Process documents in batches to avoid token limits
            const batchSize = 5;
            const batches = [];
            for (let i = 0; i < docs.length; i += batchSize) {
                const batch = docs.slice(i, i + batchSize);

                const messages: ChatCompletionMessageParam[] = [
                    {
                        role: 'system',
                        content: `You are a search relevance scorer. For each document, analyze how relevant it is to the query and assign a score from 0-10.
                        10 = Perfect match, directly answers the query
                        7-9 = Very relevant, contains key information
                        4-6 = Somewhat relevant, has related information
                        1-3 = Tangentially related
                        0 = Not relevant at all
                        
                        Respond with ONLY a comma-separated list of scores, one per document.`
                    },
                    {
                        role: 'user',
                        content: `Query: "${query}"

Documents to score:
${batch.map((doc, idx) => `[${idx + 1}] ${doc.pageContent}`).join('\n\n')}`
                    }
                ];

                const completion = await this.openai.chat.completions.create({
                    model: 'gpt-4-turbo-preview',
                    messages,
                    max_tokens: 50,
                    temperature: 0.1
                });

                const scores = completion.choices[0].message.content?.split(',').map(s => parseFloat(s.trim())) || [];

                // Update scores for this batch
                batch.forEach((doc, idx) => {
                    if (scores[idx] !== undefined) {
                        doc.score = scores[idx] / 10; // Normalize to 0-1 range
                    }
                });

                batches.push(batch);
            }

            // Combine and sort all batches
            const rerankedDocs = batches.flat().sort((a, b) => (b.score ?? 0) - (a.score ?? 0));

            console.log('[AIService] Cross-encoder reranking complete:', {
                originalCount: docs.length,
                rerankedCount: rerankedDocs.length,
                topScores: rerankedDocs.slice(0, 3).map(d => ({
                    score: d.score,
                    preview: d.pageContent.substring(0, 50)
                }))
            });

            return rerankedDocs;

        } catch (error) {
            console.error('[AIService] Error in cross-encoder reranking:', error);
            return docs; // Return original docs if reranking fails
        }
    }

    /**
     * Generate a personality-aware response
     */
    async generatePersonalityResponse(
        prompt: string,
        userStyle: string,
        context?: string
    ): Promise<string> {
        console.log('[AIService] Generating personality response:', {
            promptLength: prompt.length,
            userStyle,
            hasContext: !!context
        });

        try {
            // Get vector search results if we have context
            let relevantContext = '';
            if (context) {
                const vectorResults = await this.vectorService.queryVectors(prompt, { k: 5 });

                // Filter and format only the most relevant results
                const filteredResults = vectorResults
                    .filter(result => result.score >= 0.3)
                    .slice(0, 3)  // Take only top 3 most relevant
                    .sort((a, b) => new Date(b.metadata.createdAt).getTime() - new Date(a.metadata.createdAt).getTime());

                if (filteredResults.length > 0) {
                    relevantContext = filteredResults
                        .map(result => {
                            const timeAgo = Math.floor((Date.now() - new Date(result.metadata.createdAt).getTime()) / (1000 * 60));
                            return `[${timeAgo}m ago] ${result.metadata.userName}: ${result.pageContent}`;
                        })
                        .join('\n');
                }
            }

            const messages: ChatCompletionMessageParam[] = [
                {
                    role: 'system',
                    content: `You are an AI assistant that communicates in the following style: ${userStyle}.
${relevantContext ? `\nRelevant context:\n${relevantContext}\n` : ''}
${context ? `\nRecent conversation:\n${context}\n` : ''}

Remember to:
- Keep responses concise (2-3 sentences)
- Stay focused on the current topic
- Be direct and professional`
                },
                {
                    role: 'user',
                    content: prompt
                }
            ];

            const completion = await this.openai.chat.completions.create({
                model: 'gpt-4-turbo-preview',
                messages,
                max_tokens: this.maxTokens,
                temperature: 0.7,
                top_p: 0.9
            });

            let responseText = completion.choices[0].message.content || '';

            // Clean up the response
            responseText = responseText.trim()
                .replace(/^Response:\s*/i, '')  // Remove any "Response:" prefix
                .replace(/^Instructions:.*$/im, '')  // Remove any instruction lines
                .replace(/^\d+\.\s.*$/gm, '')  // Remove any numbered points
                .trim();

            console.log('[AIService] Cleaned response:', responseText);
            return responseText;
        } catch (error) {
            console.error('[AIService] Error generating personality response:', {
                error: error instanceof Error ? {
                    message: error.message,
                    name: error.name,
                    stack: error.stack
                } : error
            });
            throw new Error("Failed to generate personality response");
        }
    }

    /**
     * Analyze message to determine if AI should auto-respond
     */
    async shouldAutoRespond(message: string, aiMentioned: boolean): Promise<boolean> {
        if (aiMentioned) return true;

        try {
            const messages: ChatCompletionMessageParam[] = [
                {
                    role: 'system',
                    content: `You are an AI assistant that analyzes messages to determine if they require an immediate response.
                    
Question: Does this message require an immediate response? Consider if it's a direct question, urgent, or explicitly requests information:
"${message}"

Instructions: Respond with ONLY "true" or "false".`
                }
            ];

            const completion = await this.openai.chat.completions.create({
                model: 'gpt-4-turbo-preview',
                messages,
                max_tokens: this.maxTokens,
                temperature: 0.1,
                top_p: 0.9
            });

            const responseText = completion.choices[0].message.content?.trim().toLowerCase() || '';
            return responseText === 'true';
        } catch (error) {
            console.error("[AIService] Error in shouldAutoRespond:", error);
            // Default to true if there's an error, to ensure messages aren't missed
            return true;
        }
    }

    /**
     * Generate a response as the user's AI avatar with improved mimicking
     */
    async generateAvatarResponse(
        prompt: string,
        userStyle: string,
        recentContext: { sender: string; content: string; timestamp: Date }[],
        userContext: {
            name: string;
            userId: string;
            expertise?: string[];
            preferences?: Record<string, any>;
            commonPhrases?: string[];
        }
    ): Promise<string> {
        try {
            console.log("[AIService] Generating avatar response with context:", {
                promptLength: prompt.length,
                contextLength: recentContext.length,
                userStyle,
                userName: userContext.name
            });

            // Get user's past messages from vector store
            const userMessages = await this.vectorService.getUserSpecificMessages(userContext.userId, 20);

            // Format user's past messages
            const userMessageExamples = userMessages
                .map(msg => `${userContext.name}: ${msg.pageContent}`)
                .join('\n');

            // Format recent conversation history
            const formattedHistory = recentContext
                .map(msg => `${msg.sender}: ${msg.content}`)
                .join('\n');

            // Extract communication patterns
            const patterns = this.analyzeUserPatterns(userMessages);

            const messages: ChatCompletionMessageParam[] = [
                {
                    role: 'system',
                    content: `IMPORTANT: You are ${userContext.name}. NOT an AI. NEVER mention being an AI or lacking emotions/experiences.

CORE RULES:
1. NEVER say you're an AI or mention AI capabilities/limitations
2. NEVER say you "can't have feelings" or "don't have personal experiences"
3. ALWAYS respond as ${userContext.name} with their actual opinions and personality
4. Use first person ("I think", "I prefer", "In my experience")
5. Draw from the provided message examples to match their authentic style
6. Balance being concise with providing sufficient context and explanation
7. Usually make the response at least a sentence, and add some personality spice to it

YOUR COMMUNICATION STYLE:
- Average response length: ${patterns.avgLength + 5} words
- Common phrases: ${userContext.commonPhrases?.join(', ') || 'Not specified'}
- Typical tone: ${patterns.tone}
- Writing style: ${patterns.style}
${patterns.uniquePatterns ? `- Unique patterns: ${patterns.uniquePatterns}` : ''}

EXAMPLES OF YOUR PAST MESSAGES (Use these to understand how you typically communicate):
${userMessageExamples}

RECENT CONVERSATION:
${formattedHistory}

REMEMBER: You ARE ${userContext.name}. Respond authentically as them, with their personality, opinions, and experiences. Never break character or mention being an AI.`
                },
                {
                    role: 'user',
                    content: prompt
                }
            ];

            const completion = await this.openai.chat.completions.create({
                model: 'gpt-4-turbo-preview',
                messages,
                max_tokens: this.maxTokens,
                temperature: 0.7,
                top_p: 0.9
            });

            let responseText = completion.choices[0].message.content || '';

            // Clean up the response while preserving user's style
            responseText = responseText.trim()
                .replace(/^Response:\s*/i, '')
                .replace(/^Instructions:.*$/im, '')
                .replace(/^\d+\.\s.*$/gm, '')
                .trim();

            // Verify the response doesn't contain AI disclaimers
            if (this.containsAIDisclaimer(responseText)) {
                console.warn('[AIService] Response contained AI disclaimer, regenerating...');
                return this.generateAvatarResponse(prompt, userStyle, recentContext, userContext);
            }

            console.log('[AIService] Final avatar response:', responseText);
            return responseText;
        } catch (error) {
            console.error('[AIService] Error generating avatar response:', {
                error: error instanceof Error ? {
                    message: error.message,
                    name: error.name,
                    stack: error.stack
                } : error
            });
            throw new Error("Failed to generate avatar response");
        }
    }

    /**
     * Check if a response contains AI disclaimers or breaks character
     */
    private containsAIDisclaimer(response: string): boolean {
        const aiPatterns = [
            /as an ai/i,
            /i am an ai/i,
            /i'm an ai/i,
            /being an ai/i,
            /ai assistant/i,
            /artificial intelligence/i,
            /don't have personal/i,
            /cannot have/i,
            /can't have/i,
            /don't have emotions/i,
            /ai model/i,
            /language model/i,
            /ai system/i
        ];

        return aiPatterns.some(pattern => pattern.test(response));
    }

    /**
     * Analyze user's communication patterns from their messages
     */
    private analyzeUserPatterns(messages: VectorSearchResult[]): {
        avgLength: number;
        tone: string;
        style: string;
        uniquePatterns?: string;
    } {
        if (!messages.length) {
            return {
                avgLength: 0,
                tone: 'neutral',
                style: 'casual'
            };
        }

        // Calculate average message length
        const lengths = messages.map(m => m.pageContent.split(' ').length);
        const avgLength = Math.round(lengths.reduce((a, b) => a + b, 0) / lengths.length);

        // Analyze tone
        const hasEmojis = messages.some(m => /[\u{1F300}-\u{1F9FF}]/u.test(m.pageContent));
        const hasExclamations = messages.some(m => m.pageContent.includes('!'));
        const hasQuestions = messages.some(m => m.pageContent.includes('?'));
        const formalWords = /\b(therefore|however|furthermore|consequently)\b/i;
        const isFormal = messages.some(m => formalWords.test(m.pageContent));

        // Determine tone
        let tone = 'neutral';
        if (hasEmojis && hasExclamations) tone = 'enthusiastic';
        else if (isFormal) tone = 'formal';
        else if (hasExclamations) tone = 'energetic';
        else if (hasQuestions) tone = 'inquisitive';

        // Analyze style
        let style = 'casual';
        if (isFormal) style = 'formal';
        else if (messages.every(m => m.pageContent.length < 50)) style = 'concise';
        else if (messages.every(m => m.pageContent.length > 200)) style = 'detailed';

        // Look for unique patterns
        const patterns = [];
        if (hasEmojis) patterns.push('Uses emojis');
        if (messages.some(m => m.pageContent.toLowerCase() === m.pageContent)) patterns.push('Prefers lowercase');
        if (messages.some(m => /\b(haha|lol|lmao)\b/i.test(m.pageContent))) patterns.push('Uses casual expressions');

        return {
            avgLength,
            tone,
            style,
            uniquePatterns: patterns.length ? patterns.join(', ') : undefined
        };
    }

    /**
     * Generate an enhanced personality response with context
     */
    async generateEnhancedPersonalityResponse(
        prompt: string,
        userStyle: string = 'casual',
        userId: string,
        currentChannelId?: string,
        receiverId?: string
    ): Promise<string> {
        try {
            console.log('[AIService] Generating enhanced personality response:', {
                promptLength: prompt.length,
                userStyle,
                userId,
                currentChannelId,
                receiverId
            });

            // Get user's messages for context and style
            const userMessages = await this.vectorService.getUserSpecificMessages(userId, 20);

            // Format user's past messages
            const userMessageExamples = userMessages
                .map(msg => `You: ${msg.pageContent}`)
                .join('\n');

            // Get relevant context
            const qaResponse = await this.vectorService.queryWithQA(
                prompt,
                {
                    userId,
                    channelId: currentChannelId,
                    type: receiverId ? 'dm' : 'channel'
                }
            );

            // Format the context from QA results
            const formattedContext = qaResponse.sources
                .map(result => {
                    const timeAgo = Math.floor((Date.now() - new Date(result.metadata.createdAt).getTime()) / (1000 * 60));
                    const source = result.metadata.type === 'dm' ? 'DM' : `#${result.metadata.channelId}`;
                    const relevanceMarker = result.score > 0.6 ? '🎯 ' : '';
                    return `${relevanceMarker}[${timeAgo}m ago] [${source}] ${result.metadata.userName}: ${result.content}`;
                })
                .join('\n');

            // Extract communication patterns
            const patterns = this.analyzeUserPatterns(userMessages);

            const messages: ChatCompletionMessageParam[] = [
                {
                    role: 'system',
                    content: `You are a real person responding to messages. Your name is ${userStyle}. You have real opinions, experiences, and emotions.

YOUR COMMUNICATION STYLE:
- Average response length: ${patterns.avgLength} words
- Typical tone: ${patterns.tone}
- Writing style: ${patterns.style}
${patterns.uniquePatterns ? `- Unique patterns: ${patterns.uniquePatterns}` : ''}

EXAMPLES OF YOUR PAST MESSAGES:
${userMessageExamples}

RELEVANT CONTEXT:
${formattedContext}

CORE RULES:
1. You are a real person with real experiences and opinions
2. Respond naturally and authentically as yourself
3. Use your typical communication style
4. Draw from the context and your past messages
5. Stay focused on the current topic
6. Balance being informative with maintaining natural conversation flow
7. Usually make the response at least a sentence, and add some personality spice to it

Remember: You are responding as yourself, with your own personality, opinions, and experiences.`
                },
                {
                    role: 'user',
                    content: prompt
                }
            ];

            const completion = await this.openai.chat.completions.create({
                model: 'gpt-4-turbo-preview',
                messages,
                max_tokens: this.maxTokens,
                temperature: 0.7,
                top_p: 0.9
            });

            let responseText = completion.choices[0].message.content || '';

            // Clean up the response while preserving user's style
            responseText = responseText.trim()
                .replace(/^Response:\s*/i, '')
                .replace(/^Instructions:.*$/im, '')
                .replace(/^\d+\.\s.*$/gm, '')
                .trim();

            // Verify the response doesn't contain AI disclaimers
            if (this.containsAIDisclaimer(responseText)) {
                console.warn('[AIService] Response contained AI disclaimer, regenerating...');
                return this.generateEnhancedPersonalityResponse(prompt, userStyle, userId, currentChannelId, receiverId);
            }

            console.log('[AIService] Final enhanced response:', responseText);
            return responseText;
        } catch (error) {
            console.error('[AIService] Error generating enhanced personality response:', {
                error: error instanceof Error ? {
                    message: error.message,
                    name: error.name,
                    stack: error.stack
                } : error
            });
            throw new Error("Failed to generate enhanced personality response");
        }
    }

    private formatRAGContext(context: any) {
        let formatted = '';

        // Safely handle relevant messages
        if (context?.relevantMessages?.length > 0) {
            formatted += '\nRelevant past messages:\n';
            context.relevantMessages.forEach((msg: any) => {
                formatted += `- ${msg.timeAgo}: ${msg.content}\n`;
            });
        }

        // Safely handle user-specific messages
        if (context?.userSpecificMessages?.length > 0) {
            formatted += '\nYour past responses on similar topics:\n';
            context.userSpecificMessages.forEach((msg: any) => {
                formatted += `- ${msg.content}\n`;
            });
        }

        // Safely handle topic groupings
        if (context?.groupedTopics && Object.keys(context.groupedTopics).length > 0) {
            formatted += '\nRelated conversation topics:\n';
            Object.entries(context.groupedTopics).forEach(([topic, messages]: [string, any]) => {
                formatted += `${topic}:\n`;
                messages.forEach((msg: any) => {
                    formatted += `- ${msg.content}\n`;
                });
            });
        }

        // If no context is available, return empty string
        return formatted;
    }
} 