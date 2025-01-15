export interface VectorSearchResult {
    pageContent: string;
    metadata: {
        messageId: string;
        userId: string;
        userName: string | null;
        channelId?: string;
        channelName?: string;
        createdAt: string;
    };
    score: number;
} 