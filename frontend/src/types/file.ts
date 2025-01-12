export interface File {
    id: string;
    name: string;
    type: string;
    size: number;
    url: string;
    key: string;
    userId?: string;
    messageId?: string;
    dmId?: string;
    createdAt: Date | string;
} 