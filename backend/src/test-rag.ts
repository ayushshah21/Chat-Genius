import { OpenAIEmbeddings } from '@langchain/openai';
import { PineconeStore } from '@langchain/pinecone';
import { Pinecone } from '@pinecone-database/pinecone';
import { Document } from 'langchain/document';
import { config } from 'dotenv';

// Load environment variables
config();

async function testRAGSetup() {
    try {
        console.log('🚀 Starting RAG test...');

        // Check environment variables
        console.log('\n🔍 Checking environment variables...');
        if (!process.env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY is missing');
        if (!process.env.PINECONE_API_KEY) throw new Error('PINECONE_API_KEY is missing');
        if (!process.env.PINECONE_ENVIRONMENT) throw new Error('PINECONE_ENVIRONMENT is missing');
        console.log('✅ Environment variables found');

        // Initialize OpenAI embeddings
        console.log('\n📚 Initializing OpenAI embeddings...');
        const embeddings = new OpenAIEmbeddings({
            openAIApiKey: process.env.OPENAI_API_KEY,
            modelName: "text-embedding-3-large",
        });

        // Initialize Pinecone
        console.log('\n🌲 Initializing Pinecone...');
        const pinecone = new Pinecone({
            apiKey: process.env.PINECONE_API_KEY || '',
        });

        const indexName = process.env.PINECONE_INDEX || 'chat-genius';
        console.log(`Using Pinecone index: ${indexName}`);
        const pineconeIndex = pinecone.index(indexName);

        // Initialize vector store
        console.log('\n🏪 Initializing vector store...');
        const vectorStore = await PineconeStore.fromExistingIndex(
            embeddings,
            { pineconeIndex }
        );

        // Test documents
        const testDocs = [
            new Document({
                pageContent: "TypeScript is a great language for building scalable applications",
                metadata: { id: "1", type: "test" }
            }),
            new Document({
                pageContent: "Node.js and NestJS make backend development enjoyable",
                metadata: { id: "2", type: "test" }
            }),
            new Document({
                pageContent: "React and Next.js are powerful frontend frameworks",
                metadata: { id: "3", type: "test" }
            })
        ];

        // Add test documents
        console.log('\n📝 Adding test documents...');
        try {
            await vectorStore.addDocuments(testDocs);
            console.log('✅ Test documents added successfully');
        } catch (error) {
            console.error('Error adding documents:', error);
            throw error;
        }

        // Verify documents were added by doing a broad search
        console.log('\n🔍 Verifying documents were added...');
        const verificationResults = await vectorStore.similaritySearch("development", 5);
        console.log(`Found ${verificationResults.length} documents in verification search`);

        // Test similarity search
        console.log('\n🔍 Testing specific similarity search...');
        const testQuery = "What's good for backend development?";
        console.log(`Query: "${testQuery}"`);

        const results = await vectorStore.similaritySearch(testQuery, 2);
        console.log(`\nFound ${results.length} results`);

        if (results.length === 0) {
            console.log('⚠️ No results found. This might indicate an issue with the embeddings or search.');
        } else {
            results.forEach((doc, i) => {
                console.log(`\n${i + 1}. Content: ${doc.pageContent}`);
                console.log(`   Metadata:`, doc.metadata);
            });
        }

        // Clean up test documents
        console.log('\n🧹 Cleaning up test documents...');
        // Note: Pinecone doesn't have a direct delete by metadata method
        // In a real app, you'd want to implement proper cleanup

        console.log('\n✨ RAG test completed successfully!');
    } catch (error) {
        console.error('\n❌ Error during RAG test:', error);
        // Log full error details
        if (error instanceof Error) {
            console.error('Error details:', {
                message: error.message,
                stack: error.stack,
                name: error.name
            });
        }
    }
}

// Run the test
testRAGSetup(); 