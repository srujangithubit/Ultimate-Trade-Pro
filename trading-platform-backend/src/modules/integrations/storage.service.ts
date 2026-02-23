import { Injectable, Logger } from '@nestjs/common';
import { IntegrationError } from '../../common/filters/http-error.filter';

// Dynamic imports for AWS SDK
let S3Client: any,
  PutObjectCommand: any,
  GetObjectCommand: any,
  DeleteObjectCommand: any;
try {
  const s3 = require('@aws-sdk/client-s3');
  S3Client = s3.S3Client;
  PutObjectCommand = s3.PutObjectCommand;
  GetObjectCommand = s3.GetObjectCommand;
  DeleteObjectCommand = s3.DeleteObjectCommand;
} catch {
  // AWS SDK not installed
}

let getSignedUrl: any;
try {
  const presigner = require('@aws-sdk/s3-request-presigner');
  getSignedUrl = presigner.getSignedUrl;
} catch {
  // Presigner not installed
}

export interface UploadOptions {
  key: string;
  body: Buffer | string;
  contentType: string;
  isPublic?: boolean;
  metadata?: Record<string, string>;
}

/**
 * S3-compatible file storage service.
 * Works with AWS S3 and Cloudflare R2.
 */
@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private client: any;
  private readonly bucket: string;

  constructor() {
    this.bucket = process.env.S3_BUCKET || 'trading-platform';

    if (S3Client && process.env.S3_ACCESS_KEY_ID) {
      const config: any = {
        region: process.env.S3_REGION || 'us-east-1',
        credentials: {
          accessKeyId: process.env.S3_ACCESS_KEY_ID,
          secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || '',
        },
      };

      // Cloudflare R2 endpoint
      if (process.env.S3_ENDPOINT) {
        config.endpoint = process.env.S3_ENDPOINT;
        config.forcePathStyle = true;
      }

      this.client = new S3Client(config);
      this.logger.log('S3 storage initialized');
    } else {
      this.logger.warn('S3 not configured. Storage features disabled.');
    }
  }

  private ensureClient(): void {
    if (!this.client) {
      throw new IntegrationError('S3', 'Storage is not configured.', 503);
    }
  }

  /**
   * Upload a file.
   */
  async upload(options: UploadOptions): Promise<{ key: string; url: string }> {
    this.ensureClient();

    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: options.key,
      Body: options.body,
      ContentType: options.contentType,
      ACL: options.isPublic ? 'public-read' : 'private',
      Metadata: options.metadata,
    });

    await this.client.send(command);
    this.logger.log(`Uploaded: ${options.key}`);

    return {
      key: options.key,
      url: options.isPublic
        ? `https://${this.bucket}.s3.amazonaws.com/${options.key}`
        : await this.getPresignedUrl(options.key),
    };
  }

  /**
   * Download a file.
   */
  async download(key: string): Promise<Buffer> {
    this.ensureClient();

    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });

    const response = await this.client.send(command);
    const chunks: Buffer[] = [];

    for await (const chunk of response.Body) {
      chunks.push(Buffer.from(chunk));
    }

    return Buffer.concat(chunks);
  }

  /**
   * Delete a file.
   */
  async delete(key: string): Promise<void> {
    this.ensureClient();

    const command = new DeleteObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });

    await this.client.send(command);
    this.logger.log(`Deleted: ${key}`);
  }

  /**
   * Generate a presigned URL for temporary access.
   */
  async getPresignedUrl(
    key: string,
    expiresIn: number = 3600,
  ): Promise<string> {
    this.ensureClient();

    if (!getSignedUrl) {
      throw new IntegrationError('S3', 'Presigner not installed.', 503);
    }

    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });

    return getSignedUrl(this.client, command, { expiresIn });
  }
}
