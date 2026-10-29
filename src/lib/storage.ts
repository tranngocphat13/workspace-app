import { supabase, isSupabaseConfigured } from './supabase';
import type { MessageAttachment } from '../types';

export const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
export const ALLOWED_TYPES = [
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
  'application/pdf',
  'text/plain',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

export function validateFile(file: File): { valid: boolean; error?: string } {
  if (file.size > MAX_FILE_SIZE) {
    return {
      valid: false,
      error: `File size exceeds the 10MB limit (size: ${(file.size / (1024 * 1024)).toFixed(1)}MB)`,
    };
  }

  const isAllowedType = ALLOWED_TYPES.some((type) => {
    if (type.endsWith('/*')) {
      return file.type.startsWith(type.replace('/*', ''));
    }
    return file.type === type;
  });

  if (!isAllowedType && !file.type.startsWith('image/')) {
    return {
      valid: false,
      error: `File type "${file.type || 'unknown'}" is not supported. Supported: images, PDF, TXT, DOC.`,
    };
  }

  return { valid: true };
}

export async function uploadAttachment(
  file: File,
  userId: string
): Promise<MessageAttachment> {
  const validation = validateFile(file);
  if (!validation.valid) {
    throw new Error(validation.error || 'Invalid file');
  }

  if (supabase && isSupabaseConfigured) {
    const cleanFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const filePath = `${userId}/${Date.now()}-${cleanFileName}`;

    const { error: uploadError } = await supabase.storage
      .from('chat-attachments')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false,
      });

    if (uploadError) {
      throw new Error(`Upload failed: ${uploadError.message}`);
    }

    // Return storage path instead of public URL.
    // Signed URLs are generated on render in MessageItem.tsx via getSignedUrl().
    return {
      url: filePath,
      name: file.name,
      type: file.type,
      size: file.size,
    };
  }

  // Safe offline fallback: convert to base64 Data URL
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      resolve({
        url: reader.result as string,
        name: file.name,
        type: file.type || 'application/octet-stream',
        size: file.size,
      });
    };
    reader.onerror = () => reject(new Error('Failed to read file locally'));
    reader.readAsDataURL(file);
  });
}

/**
 * Returns true when `url` is a bare Supabase Storage object path (e.g. "uuid/ts-file.png")
 * rather than an absolute URL (http/https) or inline data (data: / blob:).
 * Used by MessageItem to decide whether to fetch a signed URL.
 */
export function isStoragePath(url: string): boolean {
  if (!url) return false;
  if (url.startsWith('http') || url.startsWith('data:') || url.startsWith('blob:')) return false;
  return true;
}

/**
 * Generates a short-lived signed URL for a private-bucket storage path.
 * Returns null if Supabase is not configured or the request fails.
 *
 * @param storagePath - Bare object path, e.g. "userId/1234567890-file.png"
 * @param expiresInSeconds - TTL in seconds (default 3600 = 1 hour)
 */
export async function getSignedUrl(
  storagePath: string,
  expiresInSeconds = 3600
): Promise<string | null> {
  if (!supabase || !isSupabaseConfigured) return null;
  try {
    const { data, error } = await supabase.storage
      .from('chat-attachments')
      .createSignedUrl(storagePath, expiresInSeconds);
    if (error || !data?.signedUrl) return null;
    return data.signedUrl;
  } catch {
    return null;
  }
}
