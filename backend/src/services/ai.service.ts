import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { ChatCompletionMessageParam } from 'openai/resources/chat/completions';
import { VectorService } from './vector.service';

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

        this.maxTokens = this.configService.get<number>('AI_MAX_TOKENS') || 4000;
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
                        content: `Context:\n${context}`
                    });
                }
                messages.push({
                    role: 'user',
                    content: prompt
                });

                const completion = await Promise.race([
                    this.openai.chat.completions.create({
                        model: 'gpt-4o-mini',
                        messages,
                        max_tokens: this.maxTokens,
                        temperature: 0.7,
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
                const vectorResults = await this.vectorService.queryVectors(prompt, 5);

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
                model: 'gpt-4o-mini',
                messages,
                max_tokens: 250,  // Reduced from 1000 to prevent verbose responses
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
                model: 'gpt-4o-mini',
                messages,
                max_tokens: 10,
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
     * Generate a response as the user's AI avatar
     */
    async generateAvatarResponse(
        prompt: string,
        userStyle: string,
        recentContext: { sender: string; content: string; timestamp: Date }[],
        userContext: {
            name: string;
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

            // Format conversation history
            const formattedHistory = recentContext
                .map(msg => `${msg.sender}: ${msg.content}`)
                .join('\n');

            const messages: ChatCompletionMessageParam[] = [
                {
                    role: 'system',
                    content: `You are acting as ${userContext.name}, a ${userStyle}.
Keep responses concise (2-3 sentences max unless specifically asked for details).
Common phrases used: ${userContext.commonPhrases?.join(', ') || 'Not specified'}
Communication style: ${userContext.preferences?.communicationStyle || 'Not specified'}
Expertise: ${userContext.expertise?.join(', ') || 'Not specified'}

Important: Be brief and impactful. Use short sentences. Only elaborate if explicitly asked.

Recent conversation:
${formattedHistory}

Remember to:
- Keep responses concise and natural
- Speak in first person as ${userContext.name}
- Stay focused on the current topic
- Be direct and professional`
                },
                {
                    role: 'user',
                    content: prompt
                }
            ];

            const completion = await this.openai.chat.completions.create({
                model: 'gpt-4o-mini',
                messages,
                max_tokens: this.maxTokens,
                temperature: 0.7,
                top_p: 0.9
            });

            let responseText = completion.choices[0].message.content || '';

            // Clean up the response
            responseText = responseText.trim()
                .replace(/^Response:\s*/i, '')
                .replace(/^Instructions:.*$/im, '')
                .replace(/^\d+\.\s.*$/gm, '')
                .trim();

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

            // Get relevant context using vector search - get more results initially for better filtering
            const vectorResults = await this.vectorService.queryVectors(prompt, 5);

            // Filter results based on metadata and score
            const filteredResults = vectorResults
                .filter(result => {
                    // Public channel messages
                    if (result.metadata.type === 'channel') return true;

                    // Current channel messages if in a channel
                    if (currentChannelId && result.metadata.channelId === currentChannelId) return true;

                    // DM messages if this is a DM
                    if (receiverId && result.metadata.type === 'dm') {
                        return result.metadata.userId === receiverId || result.metadata.userId === userId;
                    }

                    return false;
                })
                .filter(result => result.score >= 0.3)  // Apply score threshold
                .slice(0, 3);  // Take only top 3 most relevant

            // Format the context
            let formattedContext = '';

            // Add semantically similar messages first for better context
            if (filteredResults && filteredResults.length > 0) {
                formattedContext = filteredResults
                    .sort((a, b) => new Date(b.metadata.createdAt).getTime() - new Date(a.metadata.createdAt).getTime())
                    .map(result => {
                        const timeAgo = Math.floor((Date.now() - new Date(result.metadata.createdAt).getTime()) / (1000 * 60));
                        const source = result.metadata.type === 'dm' ? 'DM' : `#${result.metadata.channelId}`;
                        const relevanceMarker = result.score > 0.6 ? '🎯 ' : '';
                        return `${relevanceMarker}[${timeAgo}m ago] [${source}] ${result.metadata.userName}: ${result.pageContent}`;
                    })
                    .join('\n');
            }

            const messages: ChatCompletionMessageParam[] = [
                {
                    role: 'system',
                    content: `You are an AI assistant that communicates in the following style: ${userStyle}.
${formattedContext ? `\nRelevant context:\n${formattedContext}\n` : ''}

Remember to:
- Keep responses concise (2-3 sentences)
- Stay focused on the current topic
- Be direct and professional
- Reference specific details from context when relevant
- Pay attention to messages marked with 🎯 as they are highly relevant`
                },
                {
                    role: 'user',
                    content: prompt
                }
            ];

            const completion = await this.openai.chat.completions.create({
                model: 'gpt-4o-mini',
                messages,
                max_tokens: 250,  // Reduced from 1000 to prevent verbose responses
                temperature: 0.7,
                top_p: 0.9
            });

            let responseText = completion.choices[0].message.content || '';

            // Clean up the response
            responseText = responseText.trim()
                .replace(/^Response:\s*/i, '')
                .replace(/^Instructions:.*$/im, '')
                .replace(/^\d+\.\s.*$/gm, '')
                .trim();

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