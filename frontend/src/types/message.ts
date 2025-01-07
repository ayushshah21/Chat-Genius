import { User } from './user';

export interface Message {
    id: string;
    content: string;
    channelId: string;
    userId: string;
    user: User;
    parentId?: string | null;
    replies?: Message[];
    createdAt: string;
    updatedAt: string;
} 