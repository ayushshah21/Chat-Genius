import { PrismaClient } from '@prisma/client';
import { AIService } from '../services/ai.service';
import { ConfigService } from '@nestjs/config';
import { VectorService } from '../services/vector.service';
import { PrismaService } from '../services/prisma.service';

const prisma = new PrismaClient();
const aiService = new AIService(new ConfigService(), new VectorService(new ConfigService(), new PrismaService()));


async function testAIResponse() {
    try {
        console.log("Testing AI Response Generation...");

        const response = await aiService.generateResponse(
            "What are your capabilities as Mistral Large? Please keep your response brief and highlight your key features."
        );
        console.log("\nAI Response:", response);

        const personalityResponse = await aiService.generatePersonalityResponse(
            "Explain quantum computing in one sentence.",
            "Casual and friendly, uses simple analogies, keeps things brief, occasionally uses emojis"
        );
        console.log("\nPersonality-Aware Response:", personalityResponse);

        console.log("\nTests completed successfully!");
    } catch (error) {
        console.error("Test failed:", error);
    }
}

testAIResponse(); 