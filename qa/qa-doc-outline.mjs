// End-to-end check of the document reader:
//  - the note renders as text with real <h2>/<h3> topic and subtopic headings
//  - the outline panel lists topics/subtopics and scrolls the document on click
//  - PDF lessons are converted to a readable, outline-annotated document
export default async function run(page, ui) {
  await page.goto('http://localhost:3000/courses', { waitUntil: 'load' });
  await page.waitForTimeout(1200);

  const picks = await page.evaluate(async () => {
    const list = await (await fetch('/api/v1/courses?limit=50')).json();
    let text = null, pdf = null;
    for (const c of list.items) {
      const d = await (await fetch('/api/v1/courses/' + c.id)).json();
      for (const l of d.lessons || []) {
        if (!text && l.kind === 'text') text = { course: c.id, lesson: l.id, title: l.title };
        if (!pdf && l.kind === 'pdf') pdf = { course: c.id, lesson: l.id, title: l.title };
      }
      if (text && pdf) break;
    }
    return { text, pdf };
  });
  const stamp = Date.now().toString(36);
  await page.evaluate(async u => {
    await fetch('/api/v1/auth/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: u, full_name: 'Reader One', email: u + '@example.com', country: 'GH', phone: '+233244123456', password: 'Passw0rd123', confirm_password: 'Passw0rd123' }) });
  }, ('rd' + stamp).slice(0, 16));

  const out = {};

  // ── text lesson ──
  await page.goto(`http://localhost:3000/learn/${picks.text.course}?lesson=${picks.text.lesson}`, { waitUntil: 'load' });
  await page.waitForSelector('.doc', { timeout: 30000 }).catch(() => {});
  out.text = await page.evaluate(() => {
    const doc = document.querySelector('.doc'), outline = document.querySelector('.doc-outline');
    return {
      rendered: !!doc,
      wordCount: (doc?.innerText || '').split(/\s+/).filter(Boolean).length,
      topics: [...(doc?.querySelectorAll('h2') || [])].map(h => h.textContent).slice(0, 10),
      subtopics: [...(doc?.querySelectorAll('h3') || [])].map(h => h.textContent).slice(0, 10),
      bullets: doc?.querySelectorAll('li').length ?? 0,
      outlineTopics: [...(outline?.querySelectorAll('.doc-t, .doc-s') || [])].map(e => (e.className.includes('doc-t') ? 'T: ' : '  S: ') + e.textContent).slice(0, 14),
      hasOutlinePanel: !!outline,
    };
  });

  const scrollBefore = await page.evaluate(() => document.querySelector('.doc')?.parentElement?.scrollTop ?? 0);
  await page.locator('.doc-outline .doc-t').nth(1).click().catch(() => {});
  await page.waitForTimeout(700);
  out.outlineNav = { scrollBefore, after: await page.evaluate(() => ({ top: document.querySelector('.doc')?.parentElement?.scrollTop ?? 0, active: document.querySelector('.doc-outline .on')?.textContent ?? null })) };

  // ── pdf lesson ──
  await page.goto(`http://localhost:3000/learn/${picks.pdf.course}?lesson=${picks.pdf.lesson}`, { waitUntil: 'load' });
  await page.waitForSelector('.doc', { timeout: 30000 }).catch(() => {});
  out.pdf = await page.evaluate(() => {
    const doc = document.querySelector('.doc');
    return {
      extractedText: (doc?.innerText || '').replace(/\s+/g, ' ').slice(0, 200),
      wordCount: (doc?.innerText || '').split(/\s+/).filter(Boolean).length,
      topics: [...(doc?.querySelectorAll('h2') || [])].map(h => h.textContent).slice(0, 8),
      subtopics: [...(doc?.querySelectorAll('h3') || [])].map(h => h.textContent).slice(0, 8),
      sourceNote: document.querySelector('.doc-src')?.textContent ?? null,
      hasPdfToggle: [...document.querySelectorAll('.doc button')].some(b => /pdf/i.test(b.textContent || '')),
    };
  });

  return { picks, ...out };
}
