import { execFile } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { Prisma } from '@prisma/client';
import { prisma } from './db';
import { createPrivateFileUrl, MAX_PRIVATE_FILE_BYTES } from './storage';

const execFileAsync = promisify(execFile);
const ANALYZER = path.resolve(process.cwd(), 'scripts', 'pdf_analyzer.py');
const PYTHON = process.env.PDF_ANALYZER_PYTHON || (process.platform === 'win32' ? 'python' : 'python3');

interface PdfSection {
  id: number;
  title: string;
  level: number;
  start_page: number;
  end_page: number;
  words: number;
  minutes: number;
  category: { key: string; label: string; hint: string };
  excerpt: string;
  children: PdfSection[];
}

interface PdfAnalysis {
  title: string;
  total_pages: number;
  total_minutes: number;
  total_category: { key: string; label: string; hint: string };
  outline_source: string;
  sections: PdfSection[];
  flat: PdfSection[];
}

function isPdfAnalysis(value: unknown): value is PdfAnalysis {
  if (!value || typeof value !== 'object') return false;
  const analysis = value as Partial<PdfAnalysis>;
  return Number.isInteger(analysis.total_pages) &&
    Number.isInteger(analysis.total_minutes) &&
    typeof analysis.outline_source === 'string' &&
    Array.isArray(analysis.sections) &&
    Array.isArray(analysis.flat) &&
    analysis.flat.length > 0 &&
    analysis.flat.every(section =>
      typeof section.title === 'string' &&
      Number.isInteger(section.level) &&
      Number.isInteger(section.start_page) &&
      Number.isInteger(section.end_page) &&
      Number.isInteger(section.words) &&
      Number.isInteger(section.minutes) &&
      typeof section.excerpt === 'string' &&
      typeof section.category?.label === 'string'
    );
}

export async function analyzePdfLesson(lessonId: number) {
  const lesson = await prisma.lesson.findUnique({
    where: { id: lessonId },
    select: { id: true, kind: true, url: true },
  });
  if (!lesson || lesson.kind !== 'pdf') return false;

  try {
    if (!lesson.url?.startsWith('private:')) {
      throw new Error('PDF analysis requires a PDF uploaded to private storage.');
    }

    const objectPath = lesson.url.slice('private:'.length);
    const signedUrl = await createPrivateFileUrl(objectPath, 300);
    const response = await fetch(signedUrl, { signal: AbortSignal.timeout(120_000) });
    if (!response.ok) throw new Error(`PDF download failed with HTTP ${response.status}.`);
    const declaredLength = Number(response.headers.get('content-length') || 0);
    if (declaredLength > MAX_PRIVATE_FILE_BYTES) throw new Error('PDF exceeds the configured file size limit.');
    const pdf = Buffer.from(await response.arrayBuffer());
    if (!pdf.length || pdf.length > MAX_PRIVATE_FILE_BYTES) throw new Error('PDF is empty or exceeds the configured file size limit.');
    if (pdf.subarray(0, 5).toString('ascii') !== '%PDF-') throw new Error('Stored file is not a valid PDF.');

    const tempDirectory = await mkdtemp(path.join(os.tmpdir(), 's-learning-pdf-'));
    try {
      const pdfPath = path.join(tempDirectory, 'lesson.pdf');
      await writeFile(pdfPath, pdf);
      const { stdout } = await execFileAsync(PYTHON, [ANALYZER, pdfPath, '--json'], {
        encoding: 'utf8',
        timeout: 10 * 60 * 1000,
        maxBuffer: 32 * 1024 * 1024,
      });
      let parsed: unknown;
      try {
        parsed = JSON.parse(stdout);
      } catch {
        throw new Error('PDF analyzer returned invalid JSON.');
      }
      if (!isPdfAnalysis(parsed)) throw new Error('PDF analyzer returned an incomplete outline.');

      const saved = await prisma.lesson.updateMany({
        where: { id: lesson.id, kind: 'pdf', url: lesson.url },
        data: { pdfOutline: JSON.parse(JSON.stringify(parsed)), outlineStatus: 'ready' },
      });
      return saved.count > 0;
    } finally {
      await rm(tempDirectory, { recursive: true, force: true });
    }
  } catch (error) {
    await prisma.lesson.updateMany({
      where: { id: lesson.id, kind: 'pdf', url: lesson.url },
      data: { pdfOutline: Prisma.DbNull, outlineStatus: 'failed' },
    });
    console.error(`PDF outline analysis failed for lesson ${lesson.id}:`, error);
    return false;
  }
}

export async function processPendingPdfOutlines(limit = 10) {
  const lessons = await prisma.$queryRaw<{ id: number }[]>`
    SELECT id
    FROM "Lesson"
    WHERE kind = 'pdf'
      AND "outlineStatus" = 'pending'
      AND "outlineRequestedAt" IS NOT NULL
    ORDER BY "outlineRequestedAt" ASC, id ASC
    LIMIT ${limit}
  `;
  for (const lesson of lessons) await analyzePdfLesson(lesson.id);
  return lessons.length;
}

export async function runPdfAnalysisWorker() {
  console.log('PDF outline worker started.');
  for (;;) {
    try {
      const processed = await processPendingPdfOutlines();
      if (!processed) await new Promise(resolve => setTimeout(resolve, 5_000));
    } catch (error) {
      console.error('PDF outline worker could not check the queue:', error);
      await new Promise(resolve => setTimeout(resolve, 5_000));
    }
  }
}
