import { BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import { IMAGE_TYPES, MAX_IMAGE_BYTES, StorageService } from './storage.service';

describe('StorageService', () => {
  const env = { ...process.env };
  afterEach(() => { process.env = { ...env }; });
  const configure = () => Object.assign(process.env, { S3_BUCKET: 'nuvio', S3_ACCESS_KEY_ID: 'k', S3_SECRET_ACCESS_KEY: 's', S3_PUBLIC_BASE_URL: 'https://cdn.nuvio.app/' });
  const presigner: any = jest.fn().mockResolvedValue({ url: 'https://s3.example/nuvio', fields: { key: 'x' } });

  it('says clearly when storage is not connected', async () => {
    delete process.env.S3_BUCKET;
    await expect(new StorageService(presigner).presign('bA', 'logo', 'image/png')).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('scopes the key to the business and pins type, key and size in the signed policy', async () => {
    configure();
    const r = await new StorageService(presigner).presign('biz-A', 'logo', 'image/png');
    const args = presigner.mock.calls[0][1];
    expect(args.Key).toMatch(/^biz-A\/logo\/[0-9a-f-]{36}\.png$/);
    expect(args.Conditions).toEqual(expect.arrayContaining([['content-length-range', 1, MAX_IMAGE_BYTES], ['eq', '$Content-Type', 'image/png'], ['eq', '$key', args.Key]]));
    expect(args.Expires).toBeLessThanOrEqual(300);
    expect(r.publicUrl).toBe(`https://cdn.nuvio.app/${args.Key}`);
  });

  it('rejects SVG, HTML and unknown types; extension never comes from user input', async () => {
    configure();
    for (const t of ['image/svg+xml', 'text/html', 'application/pdf', 'image/png; charset=x']) {
      await expect(new StorageService(presigner).presign('bA', 'logo', t)).rejects.toBeInstanceOf(BadRequestException);
    }
    expect(Object.keys(IMAGE_TYPES)).not.toContain('image/svg+xml');
  });

  it('rejects an unknown purpose', async () => {
    configure();
    await expect(new StorageService(presigner).presign('bA', '../../etc' as any, 'image/png')).rejects.toBeInstanceOf(BadRequestException);
  });
});
