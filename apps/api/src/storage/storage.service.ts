import { S3Client } from '@aws-sdk/client-s3';
import { createPresignedPost } from '@aws-sdk/s3-presigned-post';
import { BadRequestException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { randomUUID } from 'crypto';

/** Only raster images. SVG is excluded on purpose (it can carry scripts). The extension comes from this map, never from the filename. */
export const IMAGE_TYPES: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' };
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const PURPOSES = ['logo', 'product', 'gallery', 'service'] as const;
export type Purpose = (typeof PURPOSES)[number];

type Presigner = typeof createPresignedPost;

@Injectable()
export class StorageService {
  constructor(private presigner: Presigner = createPresignedPost) {}

  private get cfg() {
    const { S3_BUCKET: bucket, S3_ACCESS_KEY_ID: accessKeyId, S3_SECRET_ACCESS_KEY: secretAccessKey, S3_PUBLIC_BASE_URL: publicBase } = process.env;
    if (!bucket || !accessKeyId || !secretAccessKey || !publicBase) return null;
    return { bucket, accessKeyId, secretAccessKey, publicBase: publicBase.replace(/\/$/, ''), region: process.env.S3_REGION ?? 'us-east-1', endpoint: process.env.S3_ENDPOINT };
  }

  /**
   * Presigned POST: the browser uploads straight to S3. The signed policy pins the exact key,
   * the content type and a size range, so the client can't upload anything else or write elsewhere.
   * Keys are namespaced by businessId (tenant isolation at the storage layer).
   */
  async presign(businessId: string, purpose: Purpose, contentType: string) {
    const c = this.cfg;
    if (!c) throw new ServiceUnavailableException('El almacenamiento de archivos no está conectado todavía');
    const ext = IMAGE_TYPES[contentType];
    if (!ext) throw new BadRequestException('Solo se permiten imágenes JPG, PNG, WebP o GIF');
    if (!PURPOSES.includes(purpose)) throw new BadRequestException('Uso de archivo inválido');

    const key = `${businessId}/${purpose}/${randomUUID()}.${ext}`;
    const client = new S3Client({ region: c.region, endpoint: c.endpoint, forcePathStyle: !!c.endpoint, credentials: { accessKeyId: c.accessKeyId, secretAccessKey: c.secretAccessKey } });
    const { url, fields } = await this.presigner(client, {
      Bucket: c.bucket, Key: key, Expires: 300,
      Conditions: [['content-length-range', 1, MAX_IMAGE_BYTES], ['eq', '$Content-Type', contentType], ['eq', '$key', key]],
      Fields: { 'Content-Type': contentType },
    });
    return { url, fields, publicUrl: `${c.publicBase}/${key}`, maxBytes: MAX_IMAGE_BYTES };
  }
}
