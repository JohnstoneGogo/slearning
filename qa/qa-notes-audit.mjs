// Inspect lesson notes through the app's own API: which lessons have real text,
// and what shape is that text in (markdown? numbered topics?)?
export default async function run(page, ui) {
  await page.goto("http://localhost:3000/courses", { waitUntil: "load" });
  await page.waitForTimeout(1000);

  const stamp = Date.now().toString(36);
  const acct = ("an" + stamp).slice(0, 16);
  await page.evaluate(async (u) => {
    await fetch("/api/v1/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: u,
        full_name: "Note Audit",
        email: u + "@example.com",
        country: "GH",
        phone: "+233244123456",
        password: "Passw0rd123",
        confirm_password: "Passw0rd123",
      }),
    });
  }, acct);

  return page.evaluate(async () => {
    const list = await (await fetch("/api/v1/courses?limit=50")).json();
    const rows = [];
    for (const c of list.items) {
      const d = await (await fetch("/api/v1/courses/" + c.id)).json();
      for (const l of (d.lessons || []).slice(0, 4)) {
        const r = await fetch("/api/v1/lessons/" + l.id);
        const b = await r.json().catch(() => ({}));
        const text = typeof b.content === "string" ? b.content : "";
        rows.push({
          course: c.id,
          lesson: l.id,
          kind: l.kind,
          title: l.title?.slice(0, 45),
          status: r.status,
          chars: text.length,
          sample: text.replace(/\s+/g, " ").slice(0, 120),
          mdHeadings: (text.match(/^#{1,4}\s/gm) || []).length,
          numbered: (text.match(/^\d+(\.\d+)*\.?\s+\S/gm) || []).length,
        });
      }
    }
    return { withText: rows.filter((r) => r.chars > 200), total: rows.length };
  });
}
