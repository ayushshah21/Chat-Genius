// import { User } from './user';

export interface FileAttachment {
    id: string;
    name: string;
    type: string;
    size: number;
    url: string;
    key: string;
    messageId: string;
    createdAt: string;
    updatedAt: string;
}

export interface Message {
    id: string;
    content: string | null;
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
    files?: FileAttachment[];
} 