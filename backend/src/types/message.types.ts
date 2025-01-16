export interface MessageWithUser {
    id: string;
    content: string | null;
    userId: string | null;
    user?: {
        name: string | null;
    } | null;
    channelId?: string;
    createdAt: Date;
    isAI: boolean;
}

export interface DirectMessageWithSender {
    id: string;
    content: string | null;
    senderId: string;
    receiverId: string;
    sender: {
        id: string;
        name: string | null;
    };
    receiver: {
        id: string;
        name: string | null;
    };
    channelId?: string;
    createdAt: Date;
    isAI: boolean;
} 