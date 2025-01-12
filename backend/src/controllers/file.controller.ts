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

        // Generate pre-signed URL for upload
        const { url: uploadUrl, key } = await generateUploadUrl(fileName, fileType);

        // Create file record in database - store only the key, not the upload URL
        const file = await prisma.file.create({
            data: {
                name: fileName,
                type: fileType,
                size: 0, // Will be updated after upload
                key: key, // Store only the key
                user: {
                    connect: { id: (req as any).userId }
                },
                ...(channelId ? {
                    message: {
                        create: {
                            content: content || '',
                            channel: { connect: { id: channelId } },
                            user: { connect: { id: (req as any).userId } },
                            parent: parentId ? {
                                connect: { id: parentId }
                            } : undefined
                        }
                    }
                } : {
                    dm: {
                        create: {
                            content: content || '',
                            sender: {
                                connect: { id: (req as any).userId }
                            },
                            receiver: {
                                connect: { id: dmUserId }
                            },
                            parent: parentId ? {
                                connect: { id: parentId }
                            } : undefined
                        }
                    }
                })
            }
        });

        // Return both the file data and the upload URL
        return res.json({
            file,
            uploadUrl,
            messageId: file.messageId || file.dmId
        });
    } catch (error) {
        console.error('[FileController] Error handling upload URL request:', error);
        if (error instanceof Error) {
            return res.status(500).json({
                error: 'Failed to generate upload URL',
                details: error.message
            });
        }
        return res.status(500).json({ error: 'Failed to generate upload URL' });
    }
}

export async function getDownloadUrl(req: Request, res: Response) {
    try {
        const { fileId } = req.params;

        const file = await prisma.file.findUnique({
            where: { id: fileId }
        });

        if (!file) {
            console.log('[FileController] File not found:', fileId);
            return res.status(404).json({ error: 'File not found' });
        }

        if (!file.key) {
            console.log('[FileController] File key not found:', fileId);
            return res.status(400).json({ error: 'File key not found' });
        }

        // Generate a fresh pre-signed download URL
        const downloadUrl = await generateDownloadUrl(file.key);
        res.json({
            file,
            downloadUrl
        });
    } catch (error) {
        console.error('[FileController] Error in getDownloadUrl:', error);
        if (error instanceof Error) {
            return res.status(500).json({
                error: 'Failed to generate download URL',
                details: error.message
            });
        }
        res.status(500).json({ error: 'Failed to generate download URL' });
    }
}

export async function updateFileMetadata(req: Request, res: Response) {
    try {
        const { fileId } = req.params;
        const { size } = req.body;

        if (!size || size <= 0) {
            return res.status(400).json({ error: 'Invalid file size' });
        }

        const file = await prisma.file.update({
            where: { id: fileId },
            data: { size }
        });

        // Generate a fresh download URL after updating metadata
        const downloadUrl = await generateDownloadUrl(file.key!);
        res.json({
            file,
            downloadUrl
        });
    } catch (error) {
        console.error('[FileController] Error in updateFileMetadata:', error);
        if (error instanceof Error) {
            return res.status(500).json({
                error: 'Failed to update file metadata',
                details: error.message
            });
        }
        res.status(500).json({ error: 'Failed to update file metadata' });
    }
} 