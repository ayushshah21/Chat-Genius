export interface User {
    id: string;
    name: string;
    email: string;
    avatarUrl: string | null;
}

export interface FileAttachment {
    id: string;
    name: string;
    type: string;
    size: number;
    url: string;
}

export interface Reaction {
    emoji: string;
    users: User[];
}

export interface Message {
    id: string;
    content: string | null;
    user: User;
    channelId: string;
    parentId?: string;
    createdAt: string;
    updatedAt: string;
    files?: FileAttachment[];
    reactions?: Reaction[];
    replies?: Message[];
}

export interface DirectMessage {
    id: string;
    content: string | null;
    sender: User;
    receiver: User;
    parentId?: string;
    createdAt: string;
    updatedAt: string;
    files?: FileAttachment[];
    reactions?: Reaction[];
    replies?: DirectMessage[];
} 