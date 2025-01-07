// import { User } from './user';

export type ChannelType = 'PUBLIC' | 'PRIVATE' | 'DM';

export interface Channel {
    id: string;
    name: string;
    type: ChannelType;
    _count?: {
        messages: number;
    };
}

export interface CreateChannelDto {
    name: string;
    type: ChannelType;
    memberIds?: string[];
} 