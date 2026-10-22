// Pure UI signup: type into the form and press "Create account" — nothing else.
// No direct API calls. Success = the browser itself navigates off /signup.
export default async function run(page, ui) {
  await page.goto('http://localhost:3000/signup', { waitUntil: 'load' });
  await page.waitForTimeout(1500);

  const stamp = Date.now().toString(36);
  const username = ('ui' + stamp).slice(0, 18);
  const email = `ui${stamp}@example.com`;
  const field = n => page.locator(`form.formcard [name="${n}"]`);

  // Click into each field and type, like a person
  for (const [n, v] of [
    ['username', username],
    ['full_name', 'Ui Person'],
    ['email', email],
    ['phone', '0244123456'],
    ['password', 'Passw0rd123'],
    ['confirm_password', 'Passw0rd123'],
  ]) {
    await field(n).click();
    await field(n).type(v, { delay: 20 });
  }

  const filled = await page.evaluate(() =>
    Object.fromEntries([...document.querySelectorAll('form.formcard [name]')].map(e => [e.name, e.value])));

  const buttonTextBefore = await page.locator('form.formcard button').last().innerText();
  const t0 = Date.now();
  await page.locator('form.formcard button').last().click();

  // wait for the app to navigate itself, or to show an error
  let outcome = 'still on /signup after 60s', elapsed = null, errorShown = null;
  const deadline = Date.now() + 60000;
  while (Date.now() < deadline) {
    const s = await page.evaluate(() => ({
      path: location.pathname,
      err: document.querySelector('form.formcard p.err')?.textContent || '',
    }));
    if (s.err) { outcome = 'error shown'; errorShown = s.err; elapsed = Date.now() - t0; break; }
    if (s.path !== '/signup') { outcome = 'navigated to ' + s.path; elapsed = Date.now() - t0; break; }
    await page.waitForTimeout(400);
  }
  await page.waitForTimeout(1200);

  return {
    filled, buttonTextBefore, outcome, elapsed,
    errorShown,
    finalUrl: page.url(),
    pageHeading: await page.locator('h1,h2').first().innerText().catch(() => null),
    headerSays: (await page.locator('header').innerText().catch(() => '')).replace(/\s+/g, ' ').slice(0, 120),
    account: { username, email },
  };
}
