import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import dotenv from 'dotenv';

dotenv.config();

// Check for required environment variables
if (!process.env.AWS_REGION) throw new Error('AWS_REGION is required');
if (!process.env.AWS_ACCESS_KEY_ID) throw new Error('AWS_ACCESS_KEY_ID is required');
if (!process.env.AWS_SECRET_ACCESS_KEY) throw new Error('AWS_SECRET_ACCESS_KEY is required');
if (!process.env.AWS_S3_BUCKET) throw new Error('AWS_S3_BUCKET is required');

// Initialize S3 client with validated credentials
const s3Client = new S3Client({
    region: process.env.AWS_REGION,
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
    }
});

// Store bucket name after validation
const BUCKET_NAME = process.env.AWS_S3_BUCKET;

export async function generateUploadUrl(fileName: string, fileType: string): Promise<{ url: string; key: string }> {
    try {
        // Generate a unique key for the file
        const key = `${Date.now()}-${fileName.replace(/\s+/g, '-')}`;

        // Create the command for generating a pre-signed URL
        const command = new PutObjectCommand({
            Bucket: BUCKET_NAME,
            Key: key,
            ContentType: fileType
        });

        // Generate pre-signed URL for upload
        const url = await getSignedUrl(s3Client, command, { expiresIn: 3600 });

        return { url, key };
    } catch (error) {
        console.error('[S3Service] Error generating upload URL:', error);
        throw new Error('Failed to generate upload URL');
    }
}

export async function generateDownloadUrl(key: string): Promise<string> {
    try {
        // Create the command for generating a pre-signed URL
        const command = new GetObjectCommand({
            Bucket: BUCKET_NAME,
            Key: key
        });

        // Generate pre-signed URL for download
        const url = await getSignedUrl(s3Client, command, { expiresIn: 3600 });
        return url;
    } catch (error) {
        console.error('[S3Service] Error generating download URL:', error);
        throw new Error('Failed to generate download URL');
    }
}

export async function getPublicUrl(key: string): Promise<string> {
    const command = new GetObjectCommand({
        Bucket: BUCKET_NAME,
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