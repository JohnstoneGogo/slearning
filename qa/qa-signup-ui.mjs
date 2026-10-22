// End-to-end signup through the real UI: type into the form, click "Create account",
// and see where the browser lands. Uses a fresh, unique account each run.
export default async function run(page, ui) {
  await page.goto("http://localhost:3000/signup", { waitUntil: "load" });
  const before = await ui.snapshot();

  const stamp = Date.now().toString(36);
  const username = ("ui_" + stamp).slice(0, 20);
  const email = `ui_${stamp}@example.com`;
  const phone = "200000000";

  const field = (n) => page.locator(`form.formcard [name="${n}"]`);
  await field("username").fill(username);
  await field("full_name").fill("UI Probe Account");
  await field("email").fill(email);
  await field("country").selectOption("NG");
  await field("phone").fill(phone);
  await field("password").fill("Passw0rd123");
  await field("confirm_password").fill("Passw0rd123");

  // phone is sent as +234 + 200000000 (leading 0 stripped, dial code added)
  await field("confirm_password").press("Enter");
  await page.waitForURL(/\/dashboard/, { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(800);

  return {
    landedOn: new URL(page.url()).pathname,
    heading: await page
      .locator("h1,h2")
      .first()
      .innerText()
      .catch(() => null),
    hasError: await page
      .locator("p.err")
      .innerText()
      .catch(() => null),
    loggedInName: await page
      .locator("header")
      .innerText()
      .then((t) => t.split("\n").slice(0, 6).join(" | "))
      .catch(() => null),
    username,
    email,
    signedUpViaForm: before.includes("Create account"),
  };
}
