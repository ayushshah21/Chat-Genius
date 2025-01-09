import { Request, Response } from 'express';
import { generateUploadUrl, generateDownloadUrl } from '../services/s3.service';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function getUploadUrl(req: Request, res: Response) {
    try {
        const { fileName, fileType, channelId, dmUserId, content, parentId } = req.body;

        if (!fileName || !fileType || (!channelId && !dmUserId)) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        const { url, key } = await generateUploadUrl(fileName, fileType);

        // Create file record in database
        const file = await prisma.file.create({
            data: {
                name: fileName,
                type: fileType,
                size: 0, // Will be updated after upload
                url: url,
                key: key,
                // Create a message for this file
                ...(channelId ? {
                    message: {
                        create: {
                            content: content,
                            channelId,
                            userId: (req as any).userId,
                            parentId // Add parentId for thread messages
                        }
                    }
                } : {
                    directMessage: {
                        create: {
                            content: content,
                            senderId: (req as any).userId,
                            receiverId: dmUserId,
                            parentId // Already included for DM threads
                        }
                    }
                })
            },
            include: {
                message: true,
                directMessage: true
            }
        });

        // Return the file data along with the message ID
        return res.json({
            ...file,
            messageId: file.message?.id || file.directMessage?.id
        });
    } catch (error) {
        console.error('[FileController] Error handling upload URL request:', error);
        return res.status(500).json({ error: 'Failed to generate upload URL' });
    }
}

export async function getDownloadUrl(req: Request, res: Response) {
    try {
        const { fileId } = req.params;
        console.log('[FileController] Received download URL request for file:', fileId);

        const file = await prisma.file.findUnique({
            where: { id: fileId }
        });

        if (!file) {
            console.log('[FileController] File not found:', fileId);
            return res.status(404).json({ error: 'File not found' });
        }

        console.log('[FileController] Generating download URL for file:', file);
        const url = await generateDownloadUrl(file.key);
        console.log('[FileController] Generated download URL:', url);

        res.json({ url });
    } catch (error) {
        console.error('[FileController] Error in getDownloadUrl:', error);
        if (error instanceof Error) {
            console.error('[FileController] Error details:', {
                name: error.name,
                message: error.message,
                stack: error.stack
            });
        }
        res.status(500).json({ error: 'Failed to generate download URL' });
    }
}

export async function updateFileMetadata(req: Request, res: Response) {
    try {
        const { fileId } = req.params;
        const { size } = req.body;
        console.log('[FileController] Updating file metadata:', { fileId, size });

        const file = await prisma.file.update({
            where: { id: fileId },
            data: { size }
        });
        console.log('[FileController] Updated file:', file);

        res.json(file);
    } catch (error) {
        console.error('[FileController] Error in updateFileMetadata:', error);
        if (error instanceof Error) {
            console.error('[FileController] Error details:', {
                name: error.name,
                message: error.message,
                stack: error.stack
            });
        }
        res.status(500).json({ error: 'Failed to update file metadata' });
    }
} 