import { User } from './user';

export type ChannelType = 'PUBLIC' | 'PRIVATE' | 'DM';

export interface Channel {
    id: string;
    name: string;
    type: ChannelType;
    createdBy: string;
    isPrivate: boolean;
    members: User[];
    _count?: {
        messages: number;
    };
    createdAt: string;
}

export interface CreateChannelDto {
    name: string;
    type: ChannelType;
    memberIds?: string[];
} 