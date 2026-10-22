const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
async function pdfSize(u) {
  const r = await fetch(u, {
    headers: {
      "User-Agent": UA,
      Referer: new URL(u).origin + "/",
      Range: "bytes=0-3",
    },
    redirect: "follow",
    signal: AbortSignal.timeout(25000),
  });
  const ct = r.headers.get("content-type") || "";
  const total = Number(
    (r.headers.get("content-range") || "").split("/")[1] ||
      r.headers.get("content-length") ||
      0,
  );
  return `${ct.includes("pdf") ? "PDF" : "NOT-PDF"} ${(total / 1048576).toFixed(1)}MB`;
}
async function og(u) {
  try {
    const r = await fetch(u, {
      headers: { "User-Agent": UA },
      redirect: "follow",
      signal: AbortSignal.timeout(25000),
    });
    const t = await r.text();
    const m =
      t.match(/property="og:image"\s+content="([^"]+)"/i) ||
      t.match(/content="([^"]+)"\s+property="og:image"/i);
    return m ? (m[1].startsWith("/") ? new URL(m[1], u).href : m[1]) : null;
  } catch {
    return null;
  }
}
const list = [
  [
    "Let's Chat! Spanish",
    "https://boisestate.pressbooks.pub/pathwaysspanish/",
    "https://boisestate.pressbooks.pub/pathwaysspanish/open/download?type=pdf",
  ],
  [
    "Let's Chat! German",
    "https://boisestate.pressbooks.pub/pathwaysgerman/",
    "https://boisestate.pressbooks.pub/pathwaysgerman/open/download?type=pdf",
  ],
  [
    "Let's Chat! French",
    "https://boisestate.pressbooks.pub/pathwaysfrench/",
    "https://boisestate.pressbooks.pub/pathwaysfrench/open/download?type=pdf",
  ],
  [
    "First-Year Arabic (Northwestern)",
    "https://openbooks.library.northwestern.edu/firstyeararabic/",
    "https://openbooks.library.northwestern.edu/firstyeararabic/open/download?type=pdf",
  ],
  [
    "German 101 (UNA)",
    "https://una.pressbooks.pub/gr101/",
    "https://una.pressbooks.pub/gr101/open/download?type=pdf",
  ],
  [
    "Beginning Japanese for Professionals 1",
    "https://pdxscholar.library.pdx.edu/pdxopen/6/",
    "https://pdxscholar.library.pdx.edu/cgi/viewcontent.cgi?article=1005&context=pdxopen",
  ],
  [
    "Bate-Papo (Portuguese)",
    "https://uw.pressbooks.pub/batepapo/",
    "https://uw.pressbooks.pub/batepapo/open/download?type=pdf",
  ],
];
for (const [name, page, pdf] of list) {
  const [s, c] = await Promise.all([
    pdfSize(pdf).catch((e) => "ERR " + e.name),
    og(page),
  ]);
  console.log(`${name} | ${s} | cover=${c || "-"}`);
}
