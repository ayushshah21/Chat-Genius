import { aiService } from "../services/ai.service";

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