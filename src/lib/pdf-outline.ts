export interface PdfSection {
  id: number;
  title: string;
  level: number;
  start_page?: number;
  end_page?: number;
  words?: number;
  minutes: number;
  category: { key: string; label: string; hint: string };
  excerpt?: string;
}

export interface PdfOutlineData {
  total_pages?: number;
  total_minutes: number;
  outline_source?: string;
  flat: PdfSection[];
}

export function readPdfOutline(value: unknown): PdfOutlineData | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const outline = value as Record<string, unknown>;
  if (!Number.isSafeInteger(outline.total_minutes) || !Array.isArray(outline.flat)) return null;

  const flat: PdfSection[] = [];
  for (const value of outline.flat) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    const section = value as Record<string, unknown>;
    const category = section.category;
    if (
      !Number.isSafeInteger(section.id) ||
      typeof section.title !== 'string' ||
      !Number.isSafeInteger(section.level) ||
      !Number.isSafeInteger(section.minutes) ||
      !category ||
      typeof category !== 'object' ||
      typeof (category as Record<string, unknown>).label !== 'string'
    ) return null;
    flat.push({
      id: section.id as number,
      title: section.title,
      level: section.level as number,
      minutes: section.minutes as number,
      category: category as PdfSection['category'],
      ...(Number.isSafeInteger(section.start_page) ? { start_page: section.start_page as number } : {}),
      ...(Number.isSafeInteger(section.end_page) ? { end_page: section.end_page as number } : {}),
      ...(Number.isSafeInteger(section.words) ? { words: section.words as number } : {}),
      ...(typeof section.excerpt === 'string' ? { excerpt: section.excerpt } : {}),
    });
  }

  if (!flat.length) return null;
  return {
    total_minutes: outline.total_minutes as number,
    flat,
    ...(Number.isSafeInteger(outline.total_pages) ? { total_pages: outline.total_pages as number } : {}),
    ...(typeof outline.outline_source === 'string' ? { outline_source: outline.outline_source } : {}),
  };
}

export function publicPdfOutline(value: unknown, preview: boolean): PdfOutlineData | null {
  const outline = readPdfOutline(value);
  if (!outline || preview) return outline;
  return {
    total_minutes: outline.total_minutes,
    flat: outline.flat.map(({ id, title, level, minutes, category }) => ({
      id,
      title,
      level,
      minutes,
      category,
    })),
  };
}

export function isSectionPageAllowed(page: number, startPage: number, endPage: number) {
  return Number.isSafeInteger(page) &&
    Number.isSafeInteger(startPage) &&
    Number.isSafeInteger(endPage) &&
    startPage >= 1 &&
    endPage >= startPage &&
    page >= startPage &&
    page <= endPage;
}

export function canViewPdfSection(preview: boolean, enrolled: boolean) {
  return preview || enrolled;
}
