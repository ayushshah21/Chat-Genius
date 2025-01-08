import { Request, Response } from 'express';
import { generateUploadUrl, generateDownloadUrl } from '../services/s3.service';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function getUploadUrl(req: Request, res: Response) {
    try {
        const { fileName, fileType, messageId } = req.body;

        if (!fileName || !fileType || !messageId) {
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
                messageId: messageId
            }
        });

        res.json({ url, key, fileId: file.id });
    } catch (error) {
        console.error('Error generating upload URL:', error);
        res.status(500).json({ error: 'Failed to generate upload URL' });
    }
}

export async function getDownloadUrl(req: Request, res: Response) {
    try {
        const { fileId } = req.params;

        const file = await prisma.file.findUnique({
            where: { id: fileId }
        });

        if (!file) {
            return res.status(404).json({ error: 'File not found' });
        }

        const url = await generateDownloadUrl(file.key);
        res.json({ url });
    } catch (error) {
        console.error('Error generating download URL:', error);
        res.status(500).json({ error: 'Failed to generate download URL' });
    }
}

export async function updateFileMetadata(req: Request, res: Response) {
    try {
        const { fileId } = req.params;
        const { size } = req.body;

        const file = await prisma.file.update({
            where: { id: fileId },
            data: { size }
        });

        res.json(file);
    } catch (error) {
        console.error('Error updating file metadata:', error);
        res.status(500).json({ error: 'Failed to update file metadata' });
    }
} 