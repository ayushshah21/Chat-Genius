import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'crypto';

// Log the region being used
console.log('[S3Service] Initializing S3 client with region:', process.env.AWS_REGION);

const s3Client = new S3Client({
    region: process.env.AWS_REGION
});

const bucket = process.env.AWS_S3_BUCKET;

export async function generateUploadUrl(fileName: string, fileType: string): Promise<{ url: string; key: string }> {
    console.log('[S3Service] Generating upload URL for:', { fileName, fileType });
    console.log('[S3Service] Using bucket:', bucket);
    console.log('[S3Service] Using region:', process.env.AWS_REGION);

    const key = `${randomUUID()}-${fileName}`;
    console.log('[S3Service] Generated S3 key:', key);

    const command = new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        ContentType: fileType
    });

    try {
        console.log('[S3Service] Generating signed URL with params:', {
            bucket,
            key,
            contentType: fileType,
            region: process.env.AWS_REGION,
            expiresIn: 3600
        });

        const url = await getSignedUrl(s3Client, command, {
            expiresIn: 3600,
            signableHeaders: new Set(['host', 'content-type'])
        });

        // Parse the URL to check its components
        const parsedUrl = new URL(url);
        console.log('[S3Service] Generated URL details:', {
            protocol: parsedUrl.protocol,
            hostname: parsedUrl.hostname,
            pathname: parsedUrl.pathname,
            search: parsedUrl.search,
            signedHeaders: parsedUrl.searchParams.get('X-Amz-SignedHeaders')
        });

        return { url, key };
    } catch (error) {
        console.error('[S3Service] Error generating upload URL:', error);
        if (error instanceof Error) {
            console.error('[S3Service] Error details:', {
                name: error.name,
                message: error.message,
                stack: error.stack
            });
        }
        throw error;
    }
}

export async function generateDownloadUrl(key: string): Promise<string> {
    console.log('[S3Service] Generating download URL for key:', key);
    console.log('[S3Service] Using bucket:', bucket);

    const command = new GetObjectCommand({
        Bucket: bucket,
        Key: key
    });

    try {
        const url = await getSignedUrl(s3Client, command, { expiresIn: 3600 });
        console.log('[S3Service] Generated signed URL:', url);
        return url;
    } catch (error) {
        console.error('[S3Service] Error generating download URL:', error);
        if (error instanceof Error) {
            console.error('[S3Service] Error details:', {
                name: error.name,
                message: error.message,
                stack: error.stack
            });
        }
        throw error;
    }
}

export async function getPublicUrl(key: string): Promise<string> {
    console.log('[S3Service] Generating signed URL for key:', key);

    const command = new GetObjectCommand({
        Bucket: bucket,
        Key: key
    });

    try {
        const url = await getSignedUrl(s3Client, command, { expiresIn: 3600 });
        console.log('[S3Service] Generated signed URL:', url);
        return url;
    } catch (error) {
        console.error('[S3Service] Error generating signed URL:', error);
        throw error;
    }
} 