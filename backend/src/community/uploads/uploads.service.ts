import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

const ALLOWED_MIMETYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_SIZE = 5 * 1024 * 1024; // 5MB

/* eslint-disable @typescript-eslint/no-require-imports */

@Injectable()
export class UploadsService {
  private readonly logger = new Logger(UploadsService.name);

  async uploadImage(file: Express.Multer.File): Promise<string> {
    if (!ALLOWED_MIMETYPES.includes(file.mimetype)) {
      throw new BadRequestException('Only jpg/png/webp images are allowed');
    }
    if (file.size > MAX_SIZE) {
      throw new BadRequestException('Image must be under 5MB');
    }

    let compressed: Buffer;
    try {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const sharp = require('sharp');
      /* eslint-disable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
      compressed = (await sharp(file.buffer)
        .resize({ width: 1920, withoutEnlargement: true })
        .jpeg({ quality: 80 })
        .toBuffer()) as Buffer;
      /* eslint-enable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
    } catch {
      this.logger.warn(
        'Sharp not installed or compression failed, using raw buffer',
      );
      compressed = file.buffer;
    }

    if (process.env.NODE_ENV === 'production' && process.env.AWS_BUCKET_NAME) {
      return this.uploadToS3(compressed, file.originalname);
    }
    return this.saveLocally(compressed, file.originalname);
  }

  private saveLocally(buffer: Buffer, _originalName: string): Promise<string> {
    const filename = `${Date.now()}-${randomUUID()}.jpg`;
    const dir = path.resolve(process.env.UPLOAD_DIR || './uploads/community');
    fs.mkdirSync(dir, { recursive: true });
    const fullPath = path.join(dir, filename);
    fs.writeFileSync(fullPath, buffer);
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:3000';
    return Promise.resolve(`${backendUrl}/uploads/community/${filename}`);
  }

  private async uploadToS3(
    buffer: Buffer,
    _originalName: string,
  ): Promise<string> {
    // @aws-sdk/client-s3 is an optional production dependency
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
    const region = process.env.AWS_REGION || 'us-east-1';
    const bucket = process.env.AWS_BUCKET_NAME!;
    const key = `community/${Date.now()}-${randomUUID()}.jpg`;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
    const client = new S3Client({ region });
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    await client.send(
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: buffer,
        ContentType: 'image/jpeg',
      }),
    );
    return `https://${bucket}.s3.${region}.amazonaws.com/${key}`;
  }
}
