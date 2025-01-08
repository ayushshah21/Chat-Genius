// import { User } from './user';

export interface Message {
    id: string;
    content: string;
    channelId: string;
    userId: string;
    parentId?: string;
    createdAt: string;
    user: {
        id: string;
        name: string | null;
        email: string;
        avatarUrl: string | null;
    };
    channel?: {
        id: string;
        name: string;
    };
    replies?: Message[];
} 