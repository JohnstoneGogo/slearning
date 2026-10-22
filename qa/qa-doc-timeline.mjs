// Load a lesson player page, sign in first via the API (cookie), then inspect the
// preview area over time: empty skeleton? iframe present? did the PDF respond?
export default async function run(page, ui) {
  // find the course that owns a pdf lesson
  await page.goto('http://localhost:3000/courses', { waitUntil: 'load' });
  await page.waitForTimeout(1200);
  const hit = await page.evaluate(async () => {
    const list = await (await fetch('/api/v1/courses?limit=50')).json();
    for (const c of list.items) {
      const d = await (await fetch('/api/v1/courses/' + c.id)).json();
      const p = (d.lessons || []).find(l => l.kind === 'pdf');
      if (p) return { course: c.id, lesson: p.id, title: c.title, lessonTitle: p.title };
    }
    return null;
  });
  if (!hit) return { error: 'no pdf lesson found' };
  const course = hit.course;
  await page.goto('http://localhost:3000/signup', { waitUntil: 'load' });
  await page.waitForTimeout(800);

  const stamp = Date.now().toString(36);
  const uname = ('dl' + stamp).slice(0, 16);
  const filled = await page.evaluate(async u => {
    const r = await fetch('/api/v1/auth/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: u, full_name: 'Doc Reader', email: u + '@example.com', country: 'GH', phone: '+233244123456', password: 'Passw0rd123', confirm_password: 'Passw0rd123' }) });
    const b = await r.json().catch(() => null);
    return { status: r.status, ok: !!b?.token };
  }, uname);

  const net = [];
  page.on('response', r => { if (/\/api\/v1\/(lessons|files)\//.test(r.url())) net.push(r.status() + ' ' + r.url().replace('http://localhost:3000', '').slice(0, 120)); });

  await page.goto(`http://localhost:3000/learn/${course}?lesson=${hit.lesson}`, { waitUntil: 'load' });
  const timeline = [];
  for (let i = 0; i < 8; i++) {
    timeline.push(await page.evaluate(() => ({
      ms: Math.round(performance.now()),
      path: location.pathname + location.search,
      skeleton: !!document.querySelector('.player .skel'),
      bodyText: (document.querySelector('.player')?.innerText || '').replace(/\s+/g, ' ').slice(0, 160),
      iframe: [...document.querySelectorAll('.player iframe')].map(f => ({ cls: f.className, src: f.getAttribute('src')?.slice(0, 90) })),
    })));
    await page.waitForTimeout(1500);
  }

  return { hit, signup: filled, timeline, net };
}
