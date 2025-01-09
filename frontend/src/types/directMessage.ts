import { FileAttachment } from './message';
import { EmojiReaction } from './message';

export interface DirectMessage {
    id: string;
    content: string;
    senderId: string;
    receiverId: string;
    parentId?: string;
    createdAt: string;
    sender: {
        id: string;
        name: string | null;
        email: string;
        avatarUrl: string | null;
    };
    receiver: {
        id: string;
        name: string | null;
        email: string;
        avatarUrl: string | null;
    };
    replies?: DirectMessage[];
    files?: FileAttachment[];
    reactions?: EmojiReaction[];
} 