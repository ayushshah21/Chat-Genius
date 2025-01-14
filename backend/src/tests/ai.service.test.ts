import { PrismaClient } from '@prisma/client';
import { AIService } from '../services/ai.service';
import { ConfigService } from '@nestjs/config';
import { VectorService } from '../services/vector.service';
import { PrismaService } from '../services/prisma.service';

const prisma = new PrismaClient();
const vectorService = new VectorService(new ConfigService(), new PrismaService());
let aiService: AIService;

async function initializeServices() {
    await vectorService.onModuleInit();
    aiService = new AIService(new ConfigService(), vectorService);
}

async function testAIService() {
    try {
        console.log("Initializing services...");
        await initializeServices();

        console.log("Testing AI Service...");

        // Test basic response generation
        const response = await aiService.generateResponse(
            "What is the capital of France?"
        );
        console.log("Basic Response Test:", response);

        // Test personality-aware response
        const personalityResponse = await aiService.generatePersonalityResponse(
            "What's the weather like?",
            "Casual and friendly, uses emojis, keeps responses brief"
        );
        console.log("Personality Response Test:", personalityResponse);

        // Test auto-respond analysis
        const shouldRespond = await aiService.shouldAutoRespond(
            "Can someone help me with this urgent issue?",
            false
        );
        console.log("Should Auto-respond Test:", shouldRespond);

        console.log("All tests completed successfully!");
    } catch (error) {
        console.error("Test failed:", error);
    }
}

// Run the test
testAIService(); 