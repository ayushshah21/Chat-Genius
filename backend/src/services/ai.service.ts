import { BedrockRuntimeClient, InvokeModelCommand } from "@aws-sdk/client-bedrock-runtime";

class AIService {
    private bedrockClient: BedrockRuntimeClient;
    private modelId: string;
    private maxTokens: number;

    constructor() {
        // Initialize the Bedrock client
        this.bedrockClient = new BedrockRuntimeClient({
            region: process.env.AWS_BEDROCK_REGION || 'us-east-1',
            credentials: {
                accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
                secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!
            }
        });

        // Log configuration for debugging
        console.log("AI Service Configuration:");
        console.log("Region:", process.env.AWS_BEDROCK_REGION || 'us-east-1');
        console.log("Model ID:", process.env.AI_MODEL_ID);
        console.log("Access Key ID:", process.env.AWS_ACCESS_KEY_ID?.slice(0, 5) + "...");
        console.log("Has Secret Key:", !!process.env.AWS_SECRET_ACCESS_KEY);

        // Store model ID for use in requests
        this.modelId = process.env.AI_MODEL_ID || 'mistral.mistral-large-2402-v1:0';
        console.log("Using Model ID:", this.modelId);
        console.log("Using Region:", process.env.AWS_BEDROCK_REGION || 'us-east-1');

        this.maxTokens = parseInt(process.env.AI_MAX_TOKENS || "4000");
    }

    /**
     * Generate an AI response using AWS Bedrock
     * @param prompt The prompt to send to the AI
     * @param context Optional conversation history
     * @returns The AI-generated response
     */
    async generateResponse(prompt: string, context?: string): Promise<string> {
        try {
            // Log the request details
            console.log("\nMaking request to Bedrock:");
            console.log("Model ID:", this.modelId);
            console.log("Region:", this.bedrockClient.config.region);

            // Format input based on Mistral's requirements
            const input = {
                messages: [
                    ...(context ? [{ role: "user", content: context }] : []),
                    { role: "user", content: prompt }
                ],
                max_tokens: this.maxTokens,
                temperature: 0.7,
                top_p: 0.9,
            };

            // Log the formatted input
            console.log("Request Input:", JSON.stringify(input, null, 2));

            const command = new InvokeModelCommand({
                modelId: this.modelId,
                body: JSON.stringify(input),
                contentType: "application/json",
                accept: "application/json",
            });

            const response = await this.bedrockClient.send(command);
            const responseBody = JSON.parse(new TextDecoder().decode(response.body));

            // Log the raw response for debugging
            console.log("Raw Response:", JSON.stringify(responseBody, null, 2));

            // Handle different response formats
            if (responseBody.choices?.[0]?.message?.content) {
                // Mistral format (similar to OpenAI)
                return responseBody.choices[0].message.content;
            } else if (responseBody.generation) {
                // Claude format
                return responseBody.generation;
            } else if (responseBody.outputs?.[0]?.text) {
                // Alternative format
                return responseBody.outputs[0].text;
            } else if (responseBody.completion) {
                // Another alternative format
                return responseBody.completion;
            } else {
                throw new Error(`Unexpected response format: ${JSON.stringify(responseBody)}`);
            }
        } catch (error: any) {
            // Enhanced error logging
            console.error("Error generating AI response:", error);
            if (error.message) console.error("Error message:", error.message);
            if (error.$metadata) console.error("Error metadata:", error.$metadata);
            throw new Error("Failed to generate AI response");
        }
    }

    /**
     * Generate a personality-aware response
     * @param prompt The user's message
     * @param userStyle The user's communication style/personality
     * @param context Recent conversation history
     */
    async generatePersonalityResponse(
        prompt: string,
        userStyle: string,
        context?: string
    ): Promise<string> {
        const systemMessage = `You are an AI assistant that communicates in the following style: ${userStyle}. 
        Maintain this communication style while providing accurate and helpful responses.`;

        try {
            const input = {
                messages: [
                    { role: "system", content: systemMessage },
                    ...(context ? [{ role: "user", content: context }] : []),
                    { role: "user", content: prompt }
                ],
                max_tokens: this.maxTokens,
                temperature: 0.7,
                top_p: 0.9,
            };

            const command = new InvokeModelCommand({
                modelId: this.modelId,
                body: JSON.stringify(input),
                contentType: "application/json",
                accept: "application/json",
            });

            const response = await this.bedrockClient.send(command);
            const responseBody = JSON.parse(new TextDecoder().decode(response.body));

            // Log the raw response for debugging
            console.log("Raw Response (Personality):", JSON.stringify(responseBody, null, 2));

            // Handle different response formats
            if (responseBody.choices?.[0]?.message?.content) {
                // Mistral format (similar to OpenAI)
                return responseBody.choices[0].message.content;
            } else if (responseBody.generation) {
                // Claude format
                return responseBody.generation;
            } else if (responseBody.outputs?.[0]?.text) {
                // Alternative format
                return responseBody.outputs[0].text;
            } else if (responseBody.completion) {
                // Another alternative format
                return responseBody.completion;
            } else {
                throw new Error(`Unexpected response format: ${JSON.stringify(responseBody)}`);
            }
        } catch (error: any) {
            console.error("Error generating personality response:", error);
            throw new Error("Failed to generate personality response");
        }
    }

    /**
     * Analyze message to determine if AI should auto-respond
     * @param message The message to analyze
     * @param aiMentioned Whether the AI was explicitly mentioned
     */
    async shouldAutoRespond(message: string, aiMentioned: boolean): Promise<boolean> {
        if (aiMentioned) return true;

        const systemMessage = `You are an AI assistant that analyzes messages to determine if they require an immediate response.
        Respond with ONLY "true" or "false".`;

        try {
            const input = {
                messages: [
                    { role: "system", content: systemMessage },
                    { role: "user", content: `Does this message require an immediate response? Consider if it's a direct question, urgent, or explicitly requests information: "${message}"` }
                ],
                max_tokens: 10,
                temperature: 0.1,
                top_p: 0.9,
            };

            const command = new InvokeModelCommand({
                modelId: this.modelId,
                body: JSON.stringify(input),
                contentType: "application/json",
                accept: "application/json",
            });

            const response = await this.bedrockClient.send(command);
            const responseBody = JSON.parse(new TextDecoder().decode(response.body));

            // Log the raw response for debugging
            console.log("Raw Response (AutoRespond):", JSON.stringify(responseBody, null, 2));

            // Handle different response formats
            let responseText = "";
            if (responseBody.choices?.[0]?.message?.content) {
                // Mistral format (similar to OpenAI)
                responseText = responseBody.choices[0].message.content;
            } else if (responseBody.generation) {
                // Claude format
                responseText = responseBody.generation;
            } else if (responseBody.outputs?.[0]?.text) {
                // Alternative format
                responseText = responseBody.outputs[0].text;
            } else if (responseBody.completion) {
                // Another alternative format
                responseText = responseBody.completion;
            } else {
                throw new Error(`Unexpected response format: ${JSON.stringify(responseBody)}`);
            }

            return responseText.toLowerCase().includes("true");
        } catch (error: any) {
            console.error("Error analyzing message:", error);
            return false;
        }
    }

    /**
     * Generate a response as the user's AI avatar
     * @param prompt The incoming message to respond to
     * @param userStyle The user's communication style/personality
     * @param recentContext Recent messages from the conversation
     * @param userContext Additional context about the user (preferences, expertise, etc.)
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
            console.log("Generating avatar response...");

            // Format conversation history
            const formattedHistory = recentContext
                .map(msg => `${msg.sender}: ${msg.content}`)
                .join('\n');

            // Create system message emphasizing conciseness
            const systemMessage = `You are acting as ${userContext.name}, a ${userStyle}
Keep responses concise (2-3 sentences max unless specifically asked for details).
Use their common phrases: ${userContext.commonPhrases?.join(', ') || 'Not specified'}
Communication style: ${userContext.preferences?.communicationStyle || 'Not specified'}
Expertise: ${userContext.expertise?.join(', ') || 'Not specified'}

Important: Be brief and impactful. Use short sentences. Only elaborate if explicitly asked.`;

            const input = {
                messages: [
                    { role: "system", content: systemMessage },
                    { role: "user", content: `Recent conversation:\n${formattedHistory}` },
                    { role: "user", content: `New message to respond to: ${prompt}\n\nRespond concisely while maintaining my style.` }
                ],
                max_tokens: this.maxTokens,
                temperature: 0.7,
                top_p: 0.9,
            };

            const command = new InvokeModelCommand({
                modelId: this.modelId,
                body: JSON.stringify(input),
                contentType: "application/json",
                accept: "application/json",
            });

            const response = await this.bedrockClient.send(command);
            const responseBody = JSON.parse(new TextDecoder().decode(response.body));

            // Log the raw response for debugging
            console.log("Raw Response (Avatar):", JSON.stringify(responseBody, null, 2));

            // Handle different response formats
            if (responseBody.choices?.[0]?.message?.content) {
                return responseBody.choices[0].message.content;
            } else if (responseBody.generation) {
                return responseBody.generation;
            } else if (responseBody.outputs?.[0]?.text) {
                return responseBody.outputs[0].text;
            } else if (responseBody.completion) {
                return responseBody.completion;
            } else {
                throw new Error(`Unexpected response format: ${JSON.stringify(responseBody)}`);
            }
        } catch (error: any) {
            console.error("Error generating avatar response:", error);
            if (error.message) console.error("Error message:", error.message);
            if (error.$metadata) console.error("Error metadata:", error.$metadata);
            throw new Error("Failed to generate avatar response");
        }
    }
}

export const aiService = new AIService(); 