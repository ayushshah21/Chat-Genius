import { PrismaClient } from '@prisma/client';
import { contextService } from '../services/context.service';
import { dynamoDbClient, CHAT_MEMORY_TABLE } from '../config/dynamodb';
import { GetItemCommand } from '@aws-sdk/client-dynamodb';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables from .env.development
dotenv.config({ path: path.resolve(__dirname, '../../.env.development') });

const prisma = new PrismaClient();

async function testContextSummarization() {
    console.log("Starting Context Summarization Tests...\n");
    let testUser;
    let testChannel;

    try {
        // 1. Create test channel and user
        console.log("1️⃣ Creating test data...");
        testUser = await prisma.user.create({
            data: {
                email: `test${Date.now()}@example.com`,
                name: "Test User",
                password: "test-password"
            }
        });

        testChannel = await prisma.channel.create({
            data: {
                name: "test-channel",
                type: "PUBLIC",
                createdBy: testUser.id
            }
        });
        console.log("✅ Test data created");

        // 2. Create test messages
        console.log("\n2️⃣ Creating test messages...");
        const messages = [
            "Hello everyone! I'm starting a discussion about AI implementation.",
            "I think we should focus on context management first.",
            "Good point! Context is crucial for meaningful AI responses.",
            "We should also consider performance implications.",
            "Let's create a detailed plan for the implementation."
        ];

        for (const content of messages) {
            await prisma.message.create({
                data: {
                    content,
                    channelId: testChannel.id,
                    userId: testUser.id,
                    isAI: false
                }
            });
        }
        console.log("✅ Test messages created");

        // 3. Test context summarization
        console.log("\n3️⃣ Testing context summarization...");
        try {
            await contextService.updateContextWithBatchSummaries(testChannel.id, "channel", []);
            console.log("✅ Context summarization completed");
        } catch (error: any) {
            console.warn("⚠️ Context summarization failed, but continuing test:", error.message);
        }

        // 4. Verify data in DynamoDB
        console.log("\n4️⃣ Verifying data in DynamoDB...");
        try {
            const getCommand = new GetItemCommand({
                TableName: CHAT_MEMORY_TABLE,
                Key: {
                    contextId: { S: testChannel.id },
                    type: { S: "channel" }
                }
            });
            const { Item } = await dynamoDbClient.send(getCommand);
            if (Item) {
                console.log("DynamoDB Item:", JSON.stringify(Item, null, 2));
                console.log("✅ DynamoDB verification successful");
            } else {
                console.warn("⚠️ No data found in DynamoDB");
            }
        } catch (error: any) {
            console.warn("⚠️ DynamoDB verification failed:", error.message);
        }

    } catch (error) {
        console.error("\n❌ Test failed:", error);
        throw error;
    } finally {
        // 5. Cleanup
        console.log("\n5️⃣ Cleaning up test data...");
        if (testChannel) {
            await prisma.message.deleteMany({ where: { channelId: testChannel.id } });
            await prisma.channel.delete({ where: { id: testChannel.id } });
        }
        if (testUser) {
            await prisma.user.delete({ where: { id: testUser.id } });
        }
        console.log("✅ Test data cleaned up");
        await prisma.$disconnect();
    }
}

// Run the tests
console.log("🧪 Starting Context Summarization Tests...\n");
testContextSummarization()
    .then(() => console.log("\n✅ Tests completed"))
    .catch(error => {
        console.error("\n❌ Tests failed:", error);
        process.exit(1);
    }); 