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

    const url = await getSignedUrl(s3Client, command, { expiresIn: 3600 });
    return { url, key };
}

export async function generateDownloadUrl(key: string): Promise<string> {
    const command = new GetObjectCommand({
        Bucket: bucket,
        Key: key
    });

    return getSignedUrl(s3Client, command, { expiresIn: 3600 });
}

export function getPublicUrl(key: string): string {
    return `https://${bucket}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;
} 