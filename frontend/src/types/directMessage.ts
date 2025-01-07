export interface DirectMessage {
    id: string;
    content: string;
    senderId: string;
    receiverId: string;
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
} 