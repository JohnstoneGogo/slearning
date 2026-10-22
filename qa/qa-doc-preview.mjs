// Document/eBook preview probe.
// 1. Finds a course whose lesson is kind 'pdf' via the app's own public API.
// 2. Registers a disposable user, so lesson access is granted.
// 3. Opens /learn/<course>?lesson=<pdf lesson> and reports what the preview area shows:
//    iframe src, whether the PDF loaded, console/network failures, and heading structure.
export default async function run(page, ui) {
  await page.goto("http://localhost:3000/courses", { waitUntil: "load" });
  await page.waitForTimeout(1500);

  // find a pdf lesson without touching the DB directly: try the first courses and inspect their lessons
  const found = await page.evaluate(async () => {
    const list = await (await fetch("/api/v1/courses?limit=50")).json();
    const report = [];
    for (const c of list.items.slice(0, 20)) {
      const d = await (await fetch("/api/v1/courses/" + c.id)).json();
      const pdfs = (d.lessons || []).filter((l) => l.kind === "pdf");
      report.push({
        id: c.id,
        title: c.title,
        lessons: (d.lessons || []).length,
        pdfLessons: pdfs.map((p) => ({
          id: p.id,
          title: p.title,
          preview: p.preview,
        })),
      });
      if (pdfs.length)
        return { course: c.id, title: c.title, lesson: pdfs[0], all: report };
    }
    return { course: null, all: report };
  });

  if (!found.course)
    return { error: "No course with a pdf lesson found", scanned: found.all };

  // /api/v1/lessons/:id is a member route — sign in with a throwaway account through the UI
  const stamp = Date.now().toString(36);
  await page.goto("http://localhost:3000/signup", { waitUntil: "load" });
  await page.waitForTimeout(800);
  const f = (n) => page.locator(`form.formcard [name="${n}"]`);
  for (const [n, v] of [
    ["username", "doc" + stamp.slice(-6)],
    ["full_name", "Doc Probe"],
    ["email", `doc${stamp}@example.com`],
    ["phone", "0244123456"],
    ["password", "Passw0rd123"],
    ["confirm_password", "Passw0rd123"],
  ]) {
    await f(n).fill(v);
  }
  await page.locator("form.formcard button").last().click();
  await page.waitForURL(/\/dashboard/, { timeout: 60000 }).catch(() => {});

  // what does the lesson payload say the file is?
  const payload = await page.evaluate(async (id) => {
    const r = await fetch("/api/v1/lessons/" + id);
    const b = await r.json().catch(() => null);
    return {
      status: r.status,
      kind: b?.kind,
      url: b?.url,
      contentChars: (b?.content || "").length,
      error: b?.error,
    };
  }, found.lesson.id);

  const consoleMsgs = [];
  page.on("console", (m) => {
    if (m.type() === "error") consoleMsgs.push(m.text().slice(0, 160));
  });
  const failed = [];
  page.on("requestfailed", (r) =>
    failed.push(r.url().slice(0, 140) + " :: " + r.failure()?.errorText),
  );
  page.on("response", (r) => {
    if (r.status() >= 400)
      failed.push(r.status() + " " + r.url().slice(0, 140));
  });

  await page.goto(
    `http://localhost:3000/learn/${found.course}?lesson=${found.lesson.id}`,
    { waitUntil: "load" },
  );
  await page.waitForTimeout(6000);

  const view = await page.evaluate(() => {
    const pdf = document.querySelector("iframe.pdf");
    return {
      heading: document.querySelector(".player h1")?.textContent,
      hasPdfFrame: !!pdf,
      pdfSrc: pdf?.getAttribute("src")?.slice(0, 180) ?? null,
      pdfBox: pdf ? { w: pdf.clientWidth, h: pdf.clientHeight } : null,
      hasProse: !!document.querySelector(".prose"),
      proseChars: document.querySelector(".prose")?.textContent?.length ?? 0,
      fallbackText: [...document.querySelectorAll(".player .muted")]
        .map((e) => e.textContent)
        .slice(0, 3),
      outlineItems: [
        ...document.querySelectorAll(".player h1, .player h2, .player h3"),
      ]
        .map((h) => h.tagName + ": " + h.textContent.trim())
        .slice(0, 15),
    };
  });

  return {
    pdfLesson: found.lesson,
    course: found.title,
    payload,
    view,
    consoleMsgs,
    failed,
  };
}
