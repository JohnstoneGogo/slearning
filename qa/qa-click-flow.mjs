// Human-paced run: fill the form by typing (not programmatic fill), wait 1.5s,
// then single-click "Create account". Records whether the request is actually
// sent and what the user sees while waiting.
export default async function run(page, ui) {
  await page.goto('http://localhost:3000/signup', { waitUntil: 'load' });
  await page.waitForTimeout(1200);

  const log = [];
  page.on('request', r => { if (r.url().includes('/auth/register')) log.push('request ' + r.method() + ' ' + r.url()); });
  page.on('response', r => { if (r.url().includes('/auth/register')) log.push('response ' + r.status()); });
  page.on('requestfailed', r => { if (r.url().includes('/auth/register')) log.push('failed ' + r.failure()?.errorText); });

  const stamp = Date.now().toString(36);
  const username = ('slow_' + stamp).slice(0, 20);
  const email = `slow_${stamp}@example.com`;
  const field = n => page.locator(`form.formcard [name="${n}"]`);

  for (const [n, v] of [['username', username], ['full_name', 'Slow Probe'], ['email', email], ['phone', '200000000'], ['password', 'Passw0rd123'], ['confirm_password', 'Passw0rd123']]) {
    await field(n).click();
    await field(n).type(v, { delay: 25 });
  }

  const btn = page.locator('form.formcard button').last();
  const snapshots = [];
  await btn.click();
  for (let i = 0; i < 6; i++) {
    snapshots.push(await page.evaluate(() => ({
      t: Math.round(performance.now()),
      path: location.pathname,
      btn: document.querySelector('form.formcard button')?.textContent,
      disabled: document.querySelector('form.formcard button')?.disabled ?? null,
      err: document.querySelector('form.formcard p.err')?.textContent || '',
      loaderVisible: !!document.querySelector('.page-loader'),
    })));
    await page.waitForTimeout(900);
  }

  return { snapshots, net: log, finalPath: new URL(page.url()).pathname, username };
}
