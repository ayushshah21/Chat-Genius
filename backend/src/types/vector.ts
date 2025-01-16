export interface VectorSearchResult {
    pageContent: string;
    metadata: {
        messageId: string;
        userId: string;
        userName: string | null;
        channelId?: string;
        channelName?: string;
        type: 'channel' | 'dm' | 'summary';
        createdAt: string;
        senderId?: string;
        receiverId?: string;
        otherUserId?: string;
        pineconeScore?: number;
    };
    score: number;
}

export interface VectorMetadata {
    messageId: string;
    type: 'channel' | 'dm' | 'summary';
    userId: string;
    userName: string | null;
    channelId?: string;
    createdAt: string;
    isAI: boolean;
    pineconeScore?: number;
    senderId?: string;
    receiverId?: string;
    otherUserId?: string;
}