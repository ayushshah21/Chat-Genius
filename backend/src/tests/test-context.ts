import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../services/prisma.service';
import { ContextService } from '../services/context.service';

// Helper function to wait
const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Mock storage for testing
const mockMessages = new Map<string, any[]>();

// Create mock AI service
const mockAiService = {
    generateResponse: async (prompt: string) => {
        console.log('Mock AI generating response for:', prompt.slice(0, 50) + '...');
        return `Mock summary of the conversation`;
    },
    generatePersonalityResponse: async (prompt: string) => {
        return `Mock personality response`;
    }
};

// Create test instance with mocked dependencies
const configService = new ConfigService();
const prismaService = new PrismaService();
const contextService = new ContextService(configService, prismaService);

// Override methods and dependencies
(contextService as any).aiService = mockAiService;
(contextService as any).getChannelHistory = async (channelId: string) => {
    return mockMessages.get(channelId) || [];
};

async function testContextService() {
    try {
        console.log('Testing Context Service...');

        // Test getting chat context
        const channelId = 'test-channel';
        console.log('\nTesting channel context retrieval...');
        const channelContext = await contextService.getChatContext(channelId, 'channel');
        console.log('Channel Context:', channelContext);

        // Test real-time update with multiple messages
        console.log('\nTesting real-time update with conversation...');
        const testMessages = [
            {
                id: 'test-msg-1',
                content: "Hey team, how's the new feature coming along?",
                userId: 'user1',
                user: { name: 'Alice' },
                channelId: channelId,
                createdAt: new Date(),
                isAI: false
            },
            {
                id: 'test-msg-2',
                content: "Making good progress! The database integration is complete.",
                userId: 'user2',
                user: { name: 'Bob' },
                channelId: channelId,
                createdAt: new Date(Date.now() + 1000),
                isAI: false
            },
            {
                id: 'test-msg-3',
                content: "Great! When can we start testing?",
                userId: 'user1',
                user: { name: 'Alice' },
                channelId: channelId,
                createdAt: new Date(Date.now() + 2000),
                isAI: false
            }
        ];

        // Store messages in mock storage
        mockMessages.set(channelId, testMessages);

        for (const msg of testMessages) {
            await contextService.handleRealTimeUpdate(msg, 'channel');
            console.log(`Added message from ${msg.user.name}: ${msg.content}`);
            await wait(100); // Small delay between messages
        }
        console.log('Real-time updates completed');

        console.log('\nAll tests completed successfully!');
    } catch (error) {
        console.error('Test failed:', error);
        throw error;
    }
}

// Run the test
testContextService(); 