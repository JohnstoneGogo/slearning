// Follow the preview iframe to prove whether the document actually renders:
// request the signed URL, follow the redirect, classify the final body, and
// measure how long it takes. Also capture the browser's view of the frame.
export default async function run(page, ui) {
  await page.goto("http://localhost:3000/courses", { waitUntil: "load" });
  await page.waitForTimeout(1200);

  const hit = await page.evaluate(async () => {
    const list = await (await fetch("/api/v1/courses?limit=50")).json();
    for (const c of list.items) {
      const d = await (await fetch("/api/v1/courses/" + c.id)).json();
      const p = (d.lessons || []).find((l) => l.kind === "pdf");
      if (p) return { course: c.id, lesson: p.id };
    }
    return null;
  });

  const stamp = Date.now().toString(36);
  await page.evaluate(
    async (u) => {
      await fetch("/api/v1/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: u,
          full_name: "Pdf Read",
          email: u + "@example.com",
          country: "GH",
          phone: "+233244123456",
          password: "Passw0rd123",
          confirm_password: "Passw0rd123",
        }),
      });
    },
    ("pdf" + stamp).slice(0, 16),
  );

  const lesson = await page.evaluate(
    async (id) => (await fetch("/api/v1/lessons/" + id)).json(),
    hit.lesson,
  );

  // walk the signed URL the iframe uses
  const trace = await page.evaluate(async (url) => {
    const steps = [];
    let cur = url,
      t0 = Date.now();
    for (let i = 0; i < 3; i++) {
      const r = await fetch(cur, { redirect: "manual" });
      const ct = r.headers.get("content-type") || "";
      const loc = r.headers.get("location") || "";
      if (i === 0) {
        const buf = new Uint8Array(await r.arrayBuffer()).slice(0, 5);
        steps.push({
          hop: i,
          from: cur.slice(0, 70),
          status: r.status,
          contentType: ct,
          location: loc.slice(0, 90),
          firstBytes: String.fromCharCode(...buf),
          ms: Date.now() - t0,
        });
      } else {
        steps.push({
          hop: i,
          from: cur.slice(0, 90),
          status: r.status,
          contentType: ct,
          location: loc.slice(0, 90),
          bytes: r.headers.get("content-length"),
          cors: r.headers.get("access-control-allow-origin"),
          ms: Date.now() - t0,
        });
      }
      if (![301, 302, 303, 307, 308].includes(r.status) || !loc) break;
      cur = loc.startsWith("http") ? loc : new URL(loc, location.origin).href;
    }
    return steps;
  }, lesson.url);

  return {
    course: hit.course,
    lesson: { kind: lesson.kind, title: lesson.title },
    trace,
  };
}
