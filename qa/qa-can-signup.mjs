// Definitive answer: can a real user create an account?
// Types every field like a person, clicks "Create account" once, waits up to 60s,
// and reports whether an account row now exists and the user is logged in.
export default async function run(page, ui) {
  await page.goto('http://localhost:3000/signup', { waitUntil: 'load' });
  await page.waitForTimeout(1000);

  const net = [];
  page.on('request', r => { if (r.url().includes('/auth/register')) net.push('sent'); });
  page.on('response', async r => { if (r.url().includes('/auth/register')) net.push('response ' + r.status()); });

  const stamp = Date.now().toString(36);
  const username = ('user_' + stamp).slice(0, 20);
  const email = `user_${stamp}@example.com`;
  const field = n => page.locator(`form.formcard [name="${n}"]`);

  for (const [n, v] of [['username', username], ['full_name', 'Real User'], ['email', email], ['phone', '0244123456'], ['password', 'Passw0rd123'], ['confirm_password', 'Passw0rd123']]) {
    await field(n).click();
    await field(n).type(v, { delay: 20 });
  }

  const t0 = Date.now();
  await page.locator('form.formcard button').last().click();

  // poll until the app leaves /signup (success) or shows an error
  let outcome = 'timeout', elapsedMs = null;
  const deadline = Date.now() + 60000;
  while (Date.now() < deadline) {
    const s = await page.evaluate(() => ({
      path: location.pathname,
      err: document.querySelector('form.formcard p.err')?.textContent || '',
      btn: document.querySelector('form.formcard button')?.textContent,
    }));
    if (s.path !== '/signup') { outcome = 'navigated to ' + s.path; elapsedMs = Date.now() - t0; break; }
    if (s.err) { outcome = 'error shown'; elapsedMs = Date.now() - t0; break; }
    await page.waitForTimeout(500);
  }

  await page.waitForTimeout(1000);
  // does the server agree an account exists? (login with the credentials we just used)
  const login = await page.evaluate(async e => {
    const r = await fetch('/api/v1/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ identifier: e, password: 'Passw0rd123' }) });
    const b = await r.json().catch(() => null);
    return { status: r.status, user: b?.user ? { username: b.user.username, member_id: b.user.member_id, status: b.user.status } : null, error: b?.error ?? null };
  }, email);

  return {
    message: outcome === 'navigated to /dashboard' && login.status === 200
      ? 'YES — a user can create an account'
      : 'NO — signup did not complete',
    outcome, elapsedMs, net,
    finalPath: new URL(page.url()).pathname,
    greeting: await page.locator('h1,h2').first().innerText().catch(() => null),
    loginCheck: login,
    credentials: { username, email, password: 'Passw0rd123' },
  };
}
