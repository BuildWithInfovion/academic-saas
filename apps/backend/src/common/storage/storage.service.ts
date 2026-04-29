import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary, UploadApiResponse } from 'cloudinary';

export interface UploadResult {
  url: string;
  publicId: string;
  format: string;
  sizeBytes: number;
}

export interface SignatureResult {
  signature: string;
  timestamp: number;
  apiKey: string;
  cloudName: string;
  folder: string;
  uploadPreset?: string;
}

@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger(StorageService.name);

  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
    cloudinary.config({
      cloud_name: this.config.get('CLOUDINARY_CLOUD_NAME'),
      api_key: this.config.get('CLOUDINARY_API_KEY'),
      api_secret: this.config.get('CLOUDINARY_API_SECRET'),
      secure: true,
    });
  }

  // Generate a signed upload signature so the frontend can upload
  // directly to Cloudinary without routing the file through the backend.
  generateUploadSignature(institutionId: string, studentId: string): SignatureResult {
    const timestamp = Math.round(Date.now() / 1000);
    const folder = `${institutionId}/${studentId}`;

    const paramsToSign: Record<string, string | number> = {
      folder,
      timestamp,
    };

    const signature = cloudinary.utils.api_sign_request(
      paramsToSign,
      this.config.get<string>('CLOUDINARY_API_SECRET')!,
    );

    return {
      signature,
      timestamp,
      apiKey: this.config.get<string>('CLOUDINARY_API_KEY')!,
      cloudName: this.config.get<string>('CLOUDINARY_CLOUD_NAME')!,
      folder,
    };
  }

  generateLogoSignature(institutionId: string): SignatureResult {
    return this.generateBrandingSignature(institutionId, 'logo');
  }

  generateBrandingSignature(institutionId: string, asset: string): SignatureResult {
    const timestamp = Math.round(Date.now() / 1000);
    const folder = `${institutionId}/branding`;
    const paramsToSign: Record<string, string | number> = { folder, timestamp };
    const signature = cloudinary.utils.api_sign_request(
      paramsToSign,
      this.config.get<string>('CLOUDINARY_API_SECRET')!,
    );
    return {
      signature,
      timestamp,
      apiKey: this.config.get<string>('CLOUDINARY_API_KEY')!,
      cloudName: this.config.get<string>('CLOUDINARY_CLOUD_NAME')!,
      folder,
    };
  }

  // Server-side upload — used when backend needs to upload a buffer directly
  // (e.g. generated PDFs, TC documents).
  async uploadBuffer(
    buffer: Buffer,
    institutionId: string,
    studentId: string,
    filename: string,
  ): Promise<UploadResult> {
    return new Promise((resolve, reject) => {
      const folder = `${institutionId}/${studentId}`;
      const publicId = `${folder}/${filename.replace(/\.[^.]+$/, '')}`;

      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder,
          public_id: publicId,
          resource_type: 'auto',
          use_filename: true,
          unique_filename: false,
          overwrite: true,
        },
        (error, result: UploadApiResponse | undefined) => {
          if (error || !result) return reject(error);
          resolve({
            url: result.secure_url,
            publicId: result.public_id,
            format: result.format,
            sizeBytes: result.bytes,
          });
        },
      );

      uploadStream.end(buffer);
    });
  }

  async deleteFile(publicId: string): Promise<void> {
    try {
      await cloudinary.uploader.destroy(publicId, { resource_type: 'raw' });
      // Also try image resource type (for photos)
      await cloudinary.uploader.destroy(publicId, { resource_type: 'image' });
    } catch (err) {
      // Non-fatal — log and continue. File may already be deleted.
      this.logger.warn(`Cloudinary delete failed for ${publicId}: ${err}`);
    }
  }

  isConfigured(): boolean {
    return (
      !!this.config.get('CLOUDINARY_CLOUD_NAME') &&
      !!this.config.get('CLOUDINARY_API_KEY') &&
      !!this.config.get('CLOUDINARY_API_SECRET')
    );
  }
}
