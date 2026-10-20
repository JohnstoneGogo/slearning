import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export const PUBLIC_MEDIA_BUCKET = 'public-media';
export const PRIVATE_FILES_BUCKET = 'private-files';
export const MAX_PRIVATE_FILE_BYTES = 50 * 1024 * 1024;

let client: SupabaseClient | undefined;
let bucketsReady: Promise<void> | undefined;

export function supabaseStorage() {
  if (client) return client;
  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new Error('Supabase Storage is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
  }
  client = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return client;
}

async function ensureBucket(name: string, isPublic: boolean) {
  const storage = supabaseStorage().storage;
  const existing = await storage.getBucket(name);
  if (!existing.error) {
    if (existing.data.public !== isPublic) {
      throw new Error(`Supabase bucket "${name}" must be ${isPublic ? 'public' : 'private'}.`);
    }
    return;
  }
  if (existing.error.statusCode !== '404') {
    throw new Error(`Unable to check Supabase bucket "${name}": ${existing.error.message}`);
  }

  const created = await storage.createBucket(name, {
    public: isPublic,
    fileSizeLimit: isPublic ? 12 * 1024 * 1024 : MAX_PRIVATE_FILE_BYTES,
    allowedMimeTypes: isPublic ? ['image/webp'] : ['application/pdf'],
  });
  if (!created.error) return;

  const afterCreate = await storage.getBucket(name);
  if (!afterCreate.error && afterCreate.data.public === isPublic) return;
  throw new Error(`Unable to create Supabase bucket "${name}": ${created.error.message}`);
}

export function ensureStorageBuckets() {
  if (!bucketsReady) {
    bucketsReady = (async () => {
      await ensureBucket(PUBLIC_MEDIA_BUCKET, true);
      await ensureBucket(PRIVATE_FILES_BUCKET, false);
    })();
  }
  return bucketsReady;
}

function checkedObjectPath(objectPath: string) {
  if (!objectPath || objectPath.startsWith('/') || objectPath.split('/').some(part => !part || part === '.' || part === '..')) {
    throw new Error('Invalid Supabase Storage object path.');
  }
  return objectPath;
}

export async function uploadPublicFile(objectPath: string, file: Buffer) {
  await ensureStorageBuckets();
  const key = checkedObjectPath(objectPath);
  const { error } = await supabaseStorage().storage.from(PUBLIC_MEDIA_BUCKET).upload(key, file, {
    contentType: 'image/webp',
    cacheControl: '31536000',
    upsert: true,
  });
  if (error) throw new Error(`Unable to upload public file "${key}": ${error.message}`);
  return supabaseStorage().storage.from(PUBLIC_MEDIA_BUCKET).getPublicUrl(key).data.publicUrl;
}

export async function uploadPrivatePdf(objectPath: string, file: Buffer) {
  await ensureStorageBuckets();
  const key = checkedObjectPath(objectPath);
  const { error } = await supabaseStorage().storage.from(PRIVATE_FILES_BUCKET).upload(key, file, {
    contentType: 'application/pdf',
    cacheControl: 'no-store',
    upsert: true,
  });
  if (error) throw new Error(`Unable to upload private file "${key}": ${error.message}`);
}

export async function createPrivateFileUrl(objectPath: string, expiresIn = 600) {
  const key = checkedObjectPath(objectPath);
  const { data, error } = await supabaseStorage().storage.from(PRIVATE_FILES_BUCKET).createSignedUrl(key, expiresIn);
  if (error) throw new Error(`Unable to create private file URL "${key}": ${error.message}`);
  return data.signedUrl;
}
