export interface User {
    id: string;
    email: string;
    name: string | null;
    avatarUrl: string | null;
    status: string;
    googleId?: string;
    createdAt?: string;
    updatedAt?: string;
    autoReplyEnabled?: boolean;
} 