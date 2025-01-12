import * as dotenv from 'dotenv';
import * as path from 'path';
import { PrismaClient } from '@prisma/client';
import { DynamoDBClient, GetItemCommand } from '@aws-sdk/client-dynamodb';
import { contextService } from '../services/context.service';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../../.env.development') });
console.log('Loading environment from:', path.resolve(__dirname, '../../.env.development'));

const prisma = new PrismaClient();
const dynamoDbClient = new DynamoDBClient({
    region: process.env.AWS_REGION
});

async function testRealTimeUpdates() {
    let testUser1, testUser2, testChannel;

    try {
        // Create test users
        testUser1 = await prisma.user.create({
            data: {
                email: `test${Date.now()}@example.com`,
                name: 'Alice',
                password: 'password123'
            }
        });

        testUser2 = await prisma.user.create({
            data: {
                email: `test${Date.now() + 1}@example.com`,
                name: 'Bob',
                password: 'password123'
            }
        });

        // Create test channel
        testChannel = await prisma.channel.create({
            data: {
                name: 'Test Channel',
                type: 'PUBLIC',
                creator: {
                    connect: { id: testUser1.id }
                }
            }
        });

        console.log('Test data created successfully');

        // Test 1: Send initial messages about a feature implementation
        const message1 = await prisma.message.create({
            data: {
                content: "Let's start implementing the new search feature",
                userId: testUser1.id,
                channelId: testChannel.id,
                isAI: false
            }
        });

        await contextService.handleRealTimeUpdate(message1, 'channel');
        console.log('First message processed');

        // Test 2: Send a related message
        const message2 = await prisma.message.create({
            data: {
                content: "I think we should use Elasticsearch for better performance",
                userId: testUser2.id,
                channelId: testChannel.id,
                isAI: false
            }
        });

        await contextService.handleRealTimeUpdate(message2, 'channel');
        console.log('Second message processed');

        // Test 3: Send a message about a new topic
        const message3 = await prisma.message.create({
            data: {
                content: "By the way, we need to fix that critical auth bug ASAP",
                userId: testUser1.id,
                channelId: testChannel.id,
                isAI: false
            }
        });

        await contextService.handleRealTimeUpdate(message3, 'channel');
        console.log('Third message (new topic) processed');

        // Verify the context in DynamoDB
        const command = new GetItemCommand({
            TableName: process.env.CHAT_MEMORY_TABLE || 'ChatMemory',
            Key: {
                contextId: { S: testChannel.id },
                type: { S: 'channel' }
            }
        });

        const { Item } = await dynamoDbClient.send(command);
        console.log('Final context in DynamoDB:', JSON.stringify(Item, null, 2));

    } catch (error: any) {
        console.error('Error in real-time update test:', error);
    } finally {
        // Cleanup
        if (testChannel) {
            await prisma.message.deleteMany({
                where: { channelId: testChannel.id }
            });
            await prisma.channel.delete({
                where: { id: testChannel.id }
            });
        }
        if (testUser1) {
            await prisma.user.delete({
                where: { id: testUser1.id }
            });
        }
        if (testUser2) {
            await prisma.user.delete({
                where: { id: testUser2.id }
            });
        }
        await prisma.$disconnect();
    }
}

// Run the test
testRealTimeUpdates(); 