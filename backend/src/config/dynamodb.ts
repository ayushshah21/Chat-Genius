import { DynamoDBClient, CreateTableCommandInput } from "@aws-sdk/client-dynamodb";
import { config } from "dotenv";
import * as path from 'path';

// Load environment variables from .env.development
config({ path: path.resolve(__dirname, '../../.env.development') });

// DynamoDB table names
export const CHAT_MEMORY_TABLE = "ChatMemory";
export const AI_PERSONALITY_TABLE = "AIPersonality";

// DynamoDB client configuration
export const dynamoDbClient = new DynamoDBClient({
    region: process.env.AWS_REGION || "us-east-2",
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    },
});

// Table definitions for reference
export const CHAT_MEMORY_TABLE_SCHEMA: CreateTableCommandInput = {
    TableName: CHAT_MEMORY_TABLE,
    KeySchema: [
        { AttributeName: "contextId", KeyType: "HASH" },
        { AttributeName: "type", KeyType: "RANGE" }
    ],
    AttributeDefinitions: [
        { AttributeName: "contextId", AttributeType: "S" },
        { AttributeName: "type", AttributeType: "S" },
        { AttributeName: "userId", AttributeType: "S" }
    ],
    GlobalSecondaryIndexes: [
        {
            IndexName: "UserContextIndex",
            KeySchema: [
                { AttributeName: "userId", KeyType: "HASH" }
            ],
            Projection: {
                ProjectionType: "ALL"
            },
            ProvisionedThroughput: {
                ReadCapacityUnits: 5,
                WriteCapacityUnits: 5
            }
        }
    ],
    ProvisionedThroughput: {
        ReadCapacityUnits: 5,
        WriteCapacityUnits: 5
    }
}; 