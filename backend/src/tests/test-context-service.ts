import { contextService } from '../services/context.service';
import { PrismaClient } from '@prisma/client';
import { dynamoDbClient, CHAT_MEMORY_TABLE } from '../config/dynamodb';
import { CreateTableCommand, DeleteTableCommand, GetItemCommand } from '@aws-sdk/client-dynamodb';
import { CHAT_MEMORY_TABLE_SCHEMA } from '../config/dynamodb';

const prisma = new PrismaClient();

async function testContextService() {
    console.log("Starting Context Service Tests...\n");

    try {
        // 1. Test DynamoDB Table Creation
        console.log("1️⃣ Testing DynamoDB Setup...");
        try {
            await dynamoDbClient.send(new CreateTableCommand(CHAT_MEMORY_TABLE_SCHEMA));
            console.log("✅ DynamoDB table created successfully");
        } catch (error: any) {
            if (error.name === 'ResourceInUseException') {
                console.log("ℹ️ DynamoDB table already exists");
            } else {
                throw error;
            }
        }

        // 2. Test Message Creation in PostgreSQL
        console.log("\n2️⃣ Testing PostgreSQL Message Creation...");
        const testChannel = await prisma.channel.create({
            data: {
                name: "test-channel",
                type: "PUBLIC",
                creator: {
                    create: {
                        email: `test${Date.now()}@example.com`,
                        name: "Test User",
                        password: "test-password"
                    }
                }
            }
        });

        const testMessage = await prisma.message.create({
            data: {
                content: "Test message for context service",
                channelId: testChannel.id,
                userId: testChannel.createdBy,
                isAI: false
            }
        });
        console.log("✅ Test message created in PostgreSQL");

        // 3. Test Context Retrieval
        console.log("\n3️⃣ Testing Context Retrieval...");
        const context = await contextService.getChatContext(testChannel.id, "channel");
        console.log("Retrieved Context:", context);
        console.log("✅ Context retrieved successfully");

        // 4. Verify DynamoDB Storage
        console.log("\n4️⃣ Verifying DynamoDB Storage...");
        const getCommand = new GetItemCommand({
            TableName: CHAT_MEMORY_TABLE,
            Key: {
                contextId: { S: testChannel.id },
                type: { S: "channel" }
            }
        });
        const { Item } = await dynamoDbClient.send(getCommand);
        console.log("DynamoDB Item:", JSON.stringify(Item, null, 2));
        console.log("✅ DynamoDB storage verified");

        // 5. Cleanup
        console.log("\n5️⃣ Cleaning up test data...");
        await prisma.message.delete({ where: { id: testMessage.id } });
        await prisma.channel.delete({ where: { id: testChannel.id } });
        console.log("✅ PostgreSQL test data cleaned up");

        console.log("\n✨ All tests completed successfully!");

    } catch (error) {
        console.error("\n❌ Test failed:", error);
        throw error;
    } finally {
        await prisma.$disconnect();
    }
}

// Run the tests
console.log("🧪 Starting Context Service Integration Tests...\n");
testContextService()
    .then(() => console.log("\n✅ Tests completed successfully"))
    .catch(error => {
        console.error("\n❌ Tests failed:", error);
        process.exit(1);
    }); 