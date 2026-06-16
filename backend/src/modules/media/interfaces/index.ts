// src/modules/media/interfaces/index.ts

export interface UploadedMedia {
  id: string;
  category: string;
  content_type: string;
  size_bytes: number;
  file_name: string;
  owner_type: string | null;
  owner_id: string | null;
  uploaded_at: Date;
}

export interface AccessUrl {
  url: string;
  expires_in: number;
  delivery: 'cloudfront' | 's3';
}

export interface PresignedUpload {
  media_id: string;
  upload_url: string;
  key: string;
  expires_in: number;
}
