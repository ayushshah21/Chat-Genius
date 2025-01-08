import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function searchMessages(query: string, userId: string) {
    console.log('Searching messages for user:', userId);
    console.log('Search query:', query);

    // First, get all channels the user is a member of
    const userChannels = await prisma.channel.findMany({
        where: {
            OR: [
                {
                    members: {
                        some: {
                            id: userId
                        }
                    }
                },
                {
                    OR: [
                        { type: "PUBLIC" },
                        { isPrivate: false }
                    ]
                }
            ]
        },
        select: {
            id: true
        }
    });

    console.log('Found user channels:', userChannels);
    const channelIds = userChannels.map(channel => channel.id);
    console.log('Channel IDs to search in:', channelIds);

    // Search in messages from those channels
    const messages = await prisma.message.findMany({
        where: {
            content: {
                contains: query,
                mode: 'insensitive'
            },
            channelId: {
                in: channelIds
            },
            parentId: null // Only search top-level messages
        },
        include: {
            user: {
                select: {
                    id: true,
                    name: true,
                    email: true,
                    avatarUrl: true,
                }
            },
            channel: {
                select: {
                    id: true,
                    name: true,
                }
            }
        },
        orderBy: {
            createdAt: 'desc'
        },
        take: 40 // Limit results
    });

    console.log('Found messages:', messages.length);
    if (messages.length > 0) {
        console.log('Sample message:', messages[0]);
    }

    return messages;
}

export async function searchDirectMessages(query: string, userId: string) {
    const messages = await prisma.directMessage.findMany({
        where: {
            content: {
                contains: query,
                mode: 'insensitive'
            },
            OR: [
                { senderId: userId },
                { receiverId: userId }
            ],
            parentId: null // Only search top-level messages
        },
        include: {
            sender: {
                select: {
                    id: true,
                    name: true,
                    email: true,
                    avatarUrl: true,
                }
            },
            receiver: {
                select: {
                    id: true,
                    name: true,
                    email: true,
                    avatarUrl: true,
                }
            }
        },
        orderBy: {
            createdAt: 'desc'
        },
        take: 20 // Limit results
    });

    // Transform the messages to ensure consistent sender/receiver handling
    return messages.map(msg => {
        // If the logged-in user is the sender, set receiverId for navigation
        // If the logged-in user is the receiver, set senderId for navigation
        const otherUserId = msg.senderId === userId ? msg.receiverId : msg.senderId;
        const otherUser = msg.senderId === userId ? msg.receiver : msg.sender;

        return {
            ...msg,
            senderId: otherUserId, // For navigation purposes
            sender: otherUser // For display purposes
        };
    });
} 