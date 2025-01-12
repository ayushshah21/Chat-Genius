import { BedrockClient, ListFoundationModelsCommand } from "@aws-sdk/client-bedrock";
import { config } from "dotenv";

config();

async function listAvailableModels() {
    const client = new BedrockClient({
        region: process.env.AWS_BEDROCK_REGION || "us-east-1",
        credentials: {
            accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
        },
    });

    try {
        const command = new ListFoundationModelsCommand({});
        const response = await client.send(command);

        console.log("Available Models:");
        response.modelSummaries?.forEach(model => {
            console.log(`- ${model.modelId}: ${model.modelName}`);
            console.log(`  Status: ${model.modelLifecycle?.status}`);
            console.log("---");
        });
    } catch (error) {
        console.error("Error listing models:", error);
    }
}

listAvailableModels(); 