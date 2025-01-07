export interface Message {
    id: string;
    content: string;
    channelId: string;
    userId: string;
    parentId?: string;
    user: {
        id: string;
        name: string | null;
        email: string;
        avatarUrl: string | null;
    };
    createdAt: string;
    replies?: Message[];
} 