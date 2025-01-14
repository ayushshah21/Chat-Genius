import * as dotenv from 'dotenv';
import * as path from 'path';


// Load environment variables from .env.development
const envPath = path.resolve(__dirname, '../../.env.development');
console.log('Loading environment from:', envPath);
const result = dotenv.config({ path: envPath });

if (result.error) {
    console.error('Error loading .env.development:', result.error);
} else {
    console.log('Environment variables loaded successfully');
    console.log('AWS_ACCESS_KEY_ID:', process.env.AWS_ACCESS_KEY_ID?.slice(0, 5) + '...');
    console.log('AWS_BEDROCK_REGION:', process.env.AWS_BEDROCK_REGION);
    console.log('AI_MODEL_ID:', process.env.AI_MODEL_ID);
}

// Import AI service after environment is loaded
import { PrismaClient } from '@prisma/client';
import { AIService } from '../services/ai.service';
import { ConfigService } from '@nestjs/config';
import { VectorService } from '../services/vector.service';
import { PrismaService } from '../services/prisma.service';

const prisma = new PrismaClient();
const aiService = new AIService(new ConfigService(), new VectorService(new ConfigService(), new PrismaService()));


async function testAvatarResponse() {
    console.log("Starting Avatar Response Test");

    try {
        // Test user context
        const userContext = {
            name: "Sarah Connor",
            expertise: ["full-stack development", "system design", "debugging nightmares"],
            preferences: {
                communicationStyle: "direct, sarcastic, and concise",
                responseLength: "short and punchy unless detailed explanation is requested",
                maxLines: 3 // Hint to keep responses brief
            },
            commonPhrases: [
                "Oh, you sweet summer child...",
                "*sigh*",
                "Plot twist:",
                "Spoiler alert: it's probably the cache",
                "TL;DR:"
            ]
        };

        // Sample conversation history
        const recentContext = [
            {
                sender: "JuniorDev",
                content: "Why shouldn't we just put all the business logic in the frontend?",
                timestamp: new Date(Date.now() - 300000)
            },
            {
                sender: "Sarah Connor",
                content: "Oh, you sweet summer child... Frontend business logic is like leaving your house keys under the doormat. Any script kiddie with DevTools can walk right in. Keep the sensitive stuff server-side.",
                timestamp: new Date(Date.now() - 240000)
            },
            {
                sender: "JuniorDev",
                content: "But what about performance?",
                timestamp: new Date(Date.now() - 60000)
            }
        ];

        // Test prompt
        const prompt = "So what's the 'right way' to handle client-server architecture?";
        const userStyle = "Extremely confident and snarky senior developer who's seen it all. Uses sarcasm and wit to deliver technical wisdom concisely. Not afraid to call out bad practices, but always backs it up with solid technical reasoning. Favors short, impactful responses unless detailed explanation is needed.";

        console.log("Generating avatar response...");
        const response = await aiService.generateAvatarResponse(
            prompt,
            userStyle,
            recentContext,
            userContext
        );

        console.log("\nAvatar Response:");
        console.log(response);

        // Test with a different type of question
        console.log("\nTesting with a different context...");
        const prompt2 = "Thoughts on using PHP in 2024?";
        const response2 = await aiService.generateAvatarResponse(
            prompt2,
            userStyle,
            recentContext,
            userContext
        );

        console.log("\nSecond Avatar Response:");
        console.log(response2);

    } catch (error: any) {
        console.error("Error in avatar response test:", error);
        if (error.message) console.error("Error message:", error.message);
        if (error.$metadata) console.error("Error metadata:", error.$metadata);
    }
}

// Run the test
testAvatarResponse(); 