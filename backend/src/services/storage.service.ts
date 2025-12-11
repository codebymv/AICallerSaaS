// ============================================
// S3 Storage Service - File Storage for Recordings & Assets
// ============================================

import { 
  S3Client, 
  PutObjectCommand, 
  GetObjectCommand, 
  DeleteObjectCommand,
  HeadObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { config } from '../config';
import { logger } from '../utils/logger';

// Check if S3 is configured
export function isS3Configured(): boolean {
  return !!(
    config.awsAccessKeyId && 
    config.awsSecretAccessKey && 
    config.awsS3Bucket
  );
}

// Initialize S3 client (only if configured)
let s3Client: S3Client | null = null;

function getS3Client(): S3Client {
  if (!isS3Configured()) {
    throw new Error('S3 is not configured. Please set AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, and AWS_S3_BUCKET environment variables.');
  }
  
  if (!s3Client) {
    s3Client = new S3Client({
      region: config.awsRegion,
      credentials: {
        accessKeyId: config.awsAccessKeyId!,
        secretAccessKey: config.awsSecretAccessKey!,
      },
    });
    logger.info('[S3] Client initialized', { region: config.awsRegion, bucket: config.awsS3Bucket });
  }
  
  return s3Client;
}

// Storage key generators
export function generateRecordingKey(userId: string, callSid: string): string {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `recordings/${userId}/${year}/${month}/${callSid}.mp3`;
}

export function generateAssetKey(userId: string, assetId: string, filename: string): string {
  const ext = filename.split('.').pop() || 'bin';
  return `assets/${userId}/${assetId}.${ext}`;
}

// Upload file to S3
export async function uploadToS3(
  key: string, 
  body: Buffer | Uint8Array, 
  contentType: string,
  metadata?: Record<string, string>
): Promise<{ key: string; url: string }> {
  const client = getS3Client();
  const bucket = config.awsS3Bucket!;
  
  try {
    await client.send(new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
      Metadata: metadata,
    }));
    
    logger.info('[S3] File uploaded', { key, contentType, size: body.length });
    
    // Return the S3 URL (not presigned, we'll generate presigned URLs on access)
    const url = `https://${bucket}.s3.${config.awsRegion}.amazonaws.com/${key}`;
    return { key, url };
  } catch (error) {
    logger.error('[S3] Upload failed', { key, error });
    throw error;
  }
}

// Upload from URL (fetch and upload to S3)
export async function uploadFromUrl(
  sourceUrl: string,
  key: string,
  contentType?: string,
  authHeader?: string
): Promise<{ key: string; url: string; size: number }> {
  try {
    // Fetch the file from source URL
    const headers: Record<string, string> = {};
    if (authHeader) {
      headers['Authorization'] = authHeader;
    }
    
    const response = await fetch(sourceUrl, { headers });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch from source: ${response.status} ${response.statusText}`);
    }
    
    const buffer = Buffer.from(await response.arrayBuffer());
    const actualContentType = contentType || response.headers.get('content-type') || 'application/octet-stream';
    
    const result = await uploadToS3(key, buffer, actualContentType);
    
    logger.info('[S3] File uploaded from URL', { sourceUrl: sourceUrl.substring(0, 50) + '...', key, size: buffer.length });
    
    return { ...result, size: buffer.length };
  } catch (error) {
    logger.error('[S3] Upload from URL failed', { sourceUrl: sourceUrl.substring(0, 50) + '...', key, error });
    throw error;
  }
}

// Get presigned URL for secure access (expires in 1 hour by default)
export async function getPresignedUrl(key: string, expiresIn: number = 3600): Promise<string> {
  const client = getS3Client();
  const bucket = config.awsS3Bucket!;
  
  try {
    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: key,
    });
    
    const url = await getSignedUrl(client, command, { expiresIn });
    logger.debug('[S3] Presigned URL generated', { key, expiresIn });
    
    return url;
  } catch (error) {
    logger.error('[S3] Failed to generate presigned URL', { key, error });
    throw error;
  }
}

// Get file from S3
export async function getFromS3(key: string): Promise<{ body: Buffer; contentType: string }> {
  const client = getS3Client();
  const bucket = config.awsS3Bucket!;
  
  try {
    const response = await client.send(new GetObjectCommand({
      Bucket: bucket,
      Key: key,
    }));
    
    const body = await response.Body?.transformToByteArray();
    if (!body) {
      throw new Error('Empty response body');
    }
    
    logger.debug('[S3] File retrieved', { key, size: body.length });
    
    return {
      body: Buffer.from(body),
      contentType: response.ContentType || 'application/octet-stream',
    };
  } catch (error) {
    logger.error('[S3] Get file failed', { key, error });
    throw error;
  }
}

// Check if file exists
export async function fileExists(key: string): Promise<boolean> {
  const client = getS3Client();
  const bucket = config.awsS3Bucket!;
  
  try {
    await client.send(new HeadObjectCommand({
      Bucket: bucket,
      Key: key,
    }));
    return true;
  } catch (error: any) {
    if (error.name === 'NotFound' || error.$metadata?.httpStatusCode === 404) {
      return false;
    }
    throw error;
  }
}

// Delete file from S3
export async function deleteFromS3(key: string): Promise<void> {
  const client = getS3Client();
  const bucket = config.awsS3Bucket!;
  
  try {
    await client.send(new DeleteObjectCommand({
      Bucket: bucket,
      Key: key,
    }));
    
    logger.info('[S3] File deleted', { key });
  } catch (error) {
    logger.error('[S3] Delete failed', { key, error });
    throw error;
  }
}

// Get storage status for settings page
export function getStorageStatus(): {
  configured: boolean;
  bucket?: string;
  region?: string;
} {
  return {
    configured: isS3Configured(),
    bucket: config.awsS3Bucket,
    region: config.awsRegion,
  };
}
