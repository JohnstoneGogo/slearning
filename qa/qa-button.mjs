// Drive the signup form EXACTLY as a person does: fill every field and press the
// "Create account" button itself. Report what blocks the click, if anything.
export default async function run(page, ui) {
  await page.goto("http://localhost:3000/signup", { waitUntil: "load" });
  await page.waitForTimeout(150);

  const stamp = Date.now().toString(36);
  const username = ("btn_" + stamp).slice(0, 20);
  const email = `btn_${stamp}@example.com`;
  const field = (n) => page.locator(`form.formcard [name="${n}"]`);
  const err = () =>
    page
      .locator("form.formcard p.err")
      .innerText()
      .catch(() => null);

  await field("username").fill(username);
  await field("full_name").fill("Button Probe");
  await field("email").fill(email);
  await field("country").selectOption("GH");
  await field("phone").fill("200000000");
  await field("referrer_id").fill("");
  await field("password").fill("Passw0rd123");
  await field("confirm_password").fill("Passw0rd123");

  // what element is at the centre of the button? (catches an overlay eating the click)
  const button = page
    .locator("form.formcard button[type=submit], form.formcard button")
    .first();
  const box = await button.boundingBox();
  const atPoint = box
    ? await page.evaluate(
        ([x, y]) => {
          const el = document.elementFromPoint(x, y);
          return el ? `${el.tagName.toLowerCase()}.${el.className}` : null;
        },
        [box.x + box.width / 2, box.y + box.height / 2],
      )
    : null;

  const before = {
    validity: await page.evaluate(() => {
      const f = document.querySelector("form.formcard");
      return {
        valid: f.checkValidity(),
        values: Object.fromEntries(
          [...f.elements].filter((e) => e.name).map((e) => [e.name, e.value]),
        ),
      };
    }),
  };

  // real click on the real button
  await button
    .click({ timeout: 5000 })
    .catch((e) => ({ clickError: String(e).slice(0, 200) }));
  await page.waitForTimeout(1500);
  const afterClick = {
    path: new URL(page.url()).pathname,
    err: await err(),
    disabled: await button.isDisabled().catch(() => null),
  };

  await page.waitForURL(/\/dashboard/, { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(800);

  return {
    atPoint,
    before,
    afterClick,
    finalPath: new URL(page.url()).pathname,
    heading: await page
      .locator("h1,h2")
      .first()
      .innerText()
      .catch(() => null),
    username,
  };
}
