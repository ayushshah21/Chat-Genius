import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'crypto';

const s3Client = new S3Client({
    region: process.env.AWS_REGION
});

const bucket = process.env.AWS_S3_BUCKET;

export async function generateUploadUrl(fileName: string, fileType: string): Promise<{ url: string; key: string }> {
    const key = `${randomUUID()}-${fileName}`;
    const command = new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        ContentType: fileType
    });

    try {
        const url = await getSignedUrl(s3Client, command, {
            expiresIn: 3600,
            signableHeaders: new Set(['host', 'content-type'])
        });

        return { url, key };
    } catch (error) {
        console.error('[S3Service] Error generating upload URL:', error);
        if (error instanceof Error) {
            console.error('[S3Service] Error details:', {
                name: error.name,
                message: error.message
            });
        }
        throw error;
    }
}

export async function generateDownloadUrl(key: string): Promise<string> {
    const command = new GetObjectCommand({
        Bucket: bucket,
        Key: key
    });

    try {
        const url = await getSignedUrl(s3Client, command, { expiresIn: 3600 });
        return url;
    } catch (error) {
        console.error('[S3Service] Error generating download URL:', error);
        if (error instanceof Error) {
            console.error('[S3Service] Error details:', {
                name: error.name,
                message: error.message
            });
        }
        throw error;
    }
}

export async function getPublicUrl(key: string): Promise<string> {
    const command = new GetObjectCommand({
        Bucket: bucket,
        Key: key
    });

    try {
        const url = await getSignedUrl(s3Client, command, { expiresIn: 3600 });
        return url;
    } catch (error) {
        console.error('[S3Service] Error generating signed URL:', error);
        throw error;
    }
} 