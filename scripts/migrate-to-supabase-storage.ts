import fs from 'node:fs/promises';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import {
  ensureStorageBuckets,
  supabaseStorage,
  PUBLIC_MEDIA_BUCKET,
  PRIVATE_FILES_BUCKET,
  MAX_PRIVATE_FILE_BYTES,
  uploadPrivatePdf,
  uploadPublicFile,
} from '../src/server/storage';

const uploadRoot = process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads');
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

async function filesUnder(directory: string): Promise<string[]> {
  let entries;
  try {
    entries = await fs.readdir(directory, { withFileTypes: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw error;
  }

  const files: string[] = [];
  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await filesUnder(fullPath));
    else if (entry.isFile()) files.push(fullPath);
  }
  return files;
}

async function main() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required.');
  await ensureStorageBuckets();

  const publicDir = path.join(uploadRoot, 'public');
  const privateDir = path.join(uploadRoot, 'private');
  const publicUrls = new Map<string, string>();
  const storage = supabaseStorage().storage;
  const listAll = async (bucket: string) => {
    const { data, error } = await storage.from(bucket).list('', { limit: 10000 });
    if (error) throw new Error(`Unable to list bucket "${bucket}": ${error.message}`);
    return new Set((data ?? []).map(f => f.name));
  };
  const existingPublic = await listAll(PUBLIC_MEDIA_BUCKET);
  const existingPrivate = await listAll(PRIVATE_FILES_BUCKET);

  const publicFiles = await filesUnder(publicDir);
  for (const filename of publicFiles) {
    if (path.extname(filename).toLowerCase() !== '.webp') continue;
    const key = path.relative(publicDir, filename).split(path.sep).join('/');
    if (existingPublic.has(key)) {
      publicUrls.set(key, storage.from(PUBLIC_MEDIA_BUCKET).getPublicUrl(key).data.publicUrl);
      continue;
    }
    const url = await uploadPublicFile(key, await fs.readFile(filename));
    publicUrls.set(key, url);
  }

  const privateFiles = await filesUnder(privateDir);
  for (const filename of privateFiles) {
    if (path.extname(filename).toLowerCase() !== '.pdf') continue;
    const { size } = await fs.stat(filename);
    if (size > MAX_PRIVATE_FILE_BYTES) {
      console.warn(`Skipped (too large): ${filename} is ${Math.ceil(size / 1024 / 1024)} MB; limit is ${Math.round(MAX_PRIVATE_FILE_BYTES / 1024 / 1024)} MB. Increase your Supabase project and bucket upload limit then re-run.`);
      continue;
    }
    const key = path.relative(privateDir, filename).split(path.sep).join('/');
    if (existingPrivate.has(key)) continue;
    await uploadPrivatePdf(key, await fs.readFile(filename));
  }

  type Change = { description: string; apply: () => Promise<unknown> };
  const changes: Change[] = [];
  const missing: string[] = [];
  const migrateUrl = (value: string | null, description: string, apply: (url: string) => Promise<unknown>) => {
    if (!value?.startsWith('/uploads/')) return;
    const key = value.slice('/uploads/'.length);
    const url = publicUrls.get(key);
    if (!url) missing.push(`${description}: ${value}`);
    else changes.push({ description, apply: () => apply(url) });
  };

  for (const row of await prisma.user.findMany({ where: { avatarUrl: { startsWith: '/uploads/' } }, select: { id: true, avatarUrl: true } })) {
    migrateUrl(row.avatarUrl, `User ${row.id} avatar`, url => prisma.user.update({ where: { id: row.id }, data: { avatarUrl: url } }));
  }
  for (const row of await prisma.course.findMany({ where: { coverUrl: { startsWith: '/uploads/' } }, select: { id: true, coverUrl: true } })) {
    migrateUrl(row.coverUrl, `Course ${row.id} cover`, url => prisma.course.update({ where: { id: row.id }, data: { coverUrl: url } }));
  }
  for (const row of await prisma.category.findMany({ where: { thumbUrl: { startsWith: '/uploads/' } }, select: { id: true, thumbUrl: true } })) {
    migrateUrl(row.thumbUrl, `Category ${row.id} thumbnail`, url => prisma.category.update({ where: { id: row.id }, data: { thumbUrl: url } }));
  }
  for (const row of await prisma.fact.findMany({ where: { imageUrl: { startsWith: '/uploads/' } }, select: { id: true, imageUrl: true } })) {
    migrateUrl(row.imageUrl, `Fact ${row.id} image`, url => prisma.fact.update({ where: { id: row.id }, data: { imageUrl: url } }));
  }
  for (const row of await prisma.lesson.findMany({ where: { url: { startsWith: '/uploads/' } }, select: { id: true, url: true } })) {
    migrateUrl(row.url, `Lesson ${row.id} file`, url => prisma.lesson.update({ where: { id: row.id }, data: { url } }));
  }
  for (const row of await prisma.lessonResource.findMany({ where: { url: { startsWith: '/uploads/' } }, select: { id: true, url: true } })) {
    migrateUrl(row.url, `Lesson resource ${row.id}`, url => prisma.lessonResource.update({ where: { id: row.id }, data: { url } }));
  }

  if (missing.length) {
    throw new Error(`Some database upload references have no matching local file; no database URLs were changed:\n${missing.join('\n')}`);
  }

  for (const change of changes) await change.apply();
  const publicUrl = supabaseStorage().storage.from(PUBLIC_MEDIA_BUCKET).getPublicUrl('').data.publicUrl;
  console.log(`Migrated ${publicFiles.length} public files and ${privateFiles.length} private files.`);
  console.log(`Updated ${changes.length} database references. Public media base URL: ${publicUrl}`);
  console.log('Local files were left untouched. Re-run safely to retry any incomplete work.');
}

main()
  .catch(error => {
    console.error('Supabase Storage migration failed:', error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
