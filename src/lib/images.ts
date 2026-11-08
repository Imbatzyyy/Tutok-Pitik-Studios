import { supabase } from './supabase';

export interface CompressedImage {
  blob: Blob;
  dataUrl: string;
  width: number;
  height: number;
}

const loadImage = (src: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('This image could not be read. Please use a JPG or PNG file.'));
    image.src = src;
  });

const readAsDataUrl = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });

/** Resize an image file so its long edge is at most maxSize and re-encode it as JPEG. */
export async function compressImage(file: File | Blob, maxSize = 1600, quality = 0.82): Promise<CompressedImage> {
  const sourceUrl = URL.createObjectURL(file);
  try {
    const image = await loadImage(sourceUrl);
    const scale = Math.min(1, maxSize / Math.max(image.naturalWidth, image.naturalHeight));
    const width = Math.max(1, Math.round(image.naturalWidth * scale));
    const height = Math.max(1, Math.round(image.naturalHeight * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Image processing is not supported in this browser.');
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, width, height);
    context.drawImage(image, 0, 0, width, height);
    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((result) => (result ? resolve(result) : reject(new Error('Could not compress image.'))), 'image/jpeg', quality)
    );
    return { blob, dataUrl: await readAsDataUrl(blob), width, height };
  } finally {
    URL.revokeObjectURL(sourceUrl);
  }
}

export const randomId = () =>
  (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`);

/**
 * Upload to Supabase Storage. Returns the stored path, or null when the bucket
 * is missing or the upload is not allowed (callers then fall back to inline data).
 */
export async function uploadToBucket(bucket: string, path: string, blob: Blob): Promise<string | null> {
  try {
    const { error } = await supabase.storage.from(bucket).upload(path, blob, {
      cacheControl: '31536000',
      contentType: blob.type || 'image/jpeg',
      upsert: true,
    });
    if (error) {
      console.warn(`Upload to "${bucket}" failed, using inline image instead:`, error.message);
      return null;
    }
    return path;
  } catch (error) {
    console.warn(`Upload to "${bucket}" failed, using inline image instead:`, error);
    return null;
  }
}

export const publicUrl = (bucket: string, path: string) => supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;

export async function signedUrl(bucket: string, path: string, expiresIn = 3600) {
  try {
    const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, expiresIn);
    if (error) return null;
    return data?.signedUrl || null;
  } catch {
    return null;
  }
}

export const RECEIPTS_BUCKET = 'payment-receipts';
export const PORTFOLIO_BUCKET = 'portfolio';
export const AVATAR_BUCKET = 'profile-pictures';

/** Resolve a viewable URL for a payment receipt stored inline or in private storage. */
export async function resolveReceiptUrl(booking: { paymentReceiptUrl?: string; paymentReceiptPath?: string }) {
  if (booking.paymentReceiptUrl) return booking.paymentReceiptUrl;
  if (booking.paymentReceiptPath) return signedUrl(RECEIPTS_BUCKET, booking.paymentReceiptPath);
  return null;
}
