// Signup route probe.
// 1. Loads /signup and inspects the form the user actually gets.
// 2. POSTs to /api/v1/auth/register with (a) an invalid payload and (b) a
//    disposable unique account, recording status + body for each.
// Nothing is guessed: every answer comes from the running server.
export default async function run(page, ui) {
  await page.goto("http://localhost:3000/signup", { waitUntil: "load" });

  const form = await page.evaluate(() => {
    const f = document.querySelector("form.formcard");
    if (!f)
      return { found: false, body: document.body.innerText.slice(0, 300) };
    const fields = [...f.querySelectorAll("input,select")].map((el) => ({
      name: el.getAttribute("name"),
      type: el.getAttribute("type"),
      required: el.required,
      pattern: el.getAttribute("pattern"),
    }));
    return {
      found: true,
      heading: f.querySelector("h2")?.textContent,
      submit: f.querySelector("button[type=submit],button")?.textContent,
      fields,
    };
  });

  // (a) invalid payload — should be rejected with a 400 and a readable message
  const invalid = await page.evaluate(async () => {
    const r = await fetch("/api/v1/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: "x",
        full_name: "A",
        email: "nope",
        country: "US",
        phone: "1",
        password: "short",
        confirm_password: "other",
      }),
    });
    return { status: r.status, body: await r.json().catch(() => null) };
  });

  // (b) a real registration attempt with a unique, disposable account
  const stamp = Date.now().toString(36);
  const payload = {
    username: ("qa_" + stamp).slice(0, 20),
    full_name: "QA Probe Account",
    email: `qa_${stamp}@example.com`,
    country: "GH",
    phone: "+233200000000",
    password: "Passw0rd123",
    confirm_password: "Passw0rd123",
    referrer_id: "",
  };
  const valid = await page.evaluate(async (p) => {
    const r = await fetch("/api/v1/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(p),
    });
    const body = await r.json().catch(() => null);
    return {
      status: r.status,
      setCookie: !!document.cookie || r.headers.get("set-cookie") !== null,
      token: body?.token ? "present" : "missing",
      user: body?.user
        ? {
            username: body.user.username,
            member_id: body.user.member_id,
            status: body.user.status,
            country: body.user.country,
            phone: body.user.phone,
            email_verified: body.user.email_verified,
          }
        : null,
      error: body?.error ?? null,
      password_hash_leaked: body?.user ? "password_hash" in body.user : "n/a",
    };
  }, payload);

  // does the new session actually work? ask for /me
  const me = await page.evaluate(async () => {
    const r = await fetch("/api/v1/me", { credentials: "same-origin" });
    const b = await r.json().catch(() => null);
    return { status: r.status, username: b?.username ?? null };
  });

  // duplicate registration should be refused
  const dup = await page.evaluate(async (p) => {
    const r = await fetch("/api/v1/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(p),
    });
    return { status: r.status, body: await r.json().catch(() => null) };
  }, payload);

  return {
    form,
    invalid,
    valid,
    me,
    duplicate: dup,
    username: payload.username,
  };
}
