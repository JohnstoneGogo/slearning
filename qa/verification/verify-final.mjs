const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
const H = {
  "User-Agent": UA,
  "Accept-Language": "en-US,en;q=0.9",
  Range: "bytes=0-3",
};

async function pdfSize(u) {
  const r = await fetch(u, {
    headers: { ...H, Referer: new URL(u).origin + "/" },
    redirect: "follow",
    signal: AbortSignal.timeout(25000),
  });
  const ct = r.headers.get("content-type") || "";
  const total = Number(
    (r.headers.get("content-range") || "").split("/")[1] ||
      r.headers.get("content-length") ||
      0,
  );
  return { ok: ct.includes("pdf"), mb: total / 1048576 };
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

const lang = [
  [
    "Basic Arabic (MSU)",
    "https://openbooks.lib.msu.edu/arb101/",
    "https://openbooks.lib.msu.edu/arb101/open/download?type=pdf",
  ],
  [
    "Intermediate Arabic (MSU)",
    "https://openbooks.lib.msu.edu/arb201/",
    "https://openbooks.lib.msu.edu/arb201/open/download?type=pdf",
  ],
  [
    "Elementary Spanish (Houston)",
    "https://louis.pressbooks.pub/elementaryspanish1/",
    "https://louis.pressbooks.pub/elementaryspanish1/open/download?type=pdf",
  ],
  [
    "Français inclusif 101",
    "https://boisestate.pressbooks.pub/french101/",
    "https://boisestate.pressbooks.pub/french101/open/download?type=pdf",
  ],
  [
    "Let's Chat! Arabic",
    "https://boisestate.pressbooks.pub/pathwaysarabic/",
    "https://boisestate.pressbooks.pub/pathwaysarabic/open/download?type=pdf",
  ],
  [
    "Elementary Swahili",
    "https://nulib-oer.github.io/swahili/",
    "https://nulib-oer.github.io/swahili/images/cover.png",
  ],
];
const farm = [
  [
    "Introduction to Permaculture",
    "https://open.oregonstate.education/permaculture/",
    "https://open.oregonstate.education/permaculture/open/download?type=pdf",
  ],
  [
    "Rain or Shine",
    "https://open.library.okstate.edu/rainorshine/",
    "https://open.library.okstate.edu/rainorshine/open/download?type=pdf",
  ],
  [
    "Crop Improvement",
    "https://iastate.pressbooks.pub/cropimprovement/",
    "https://iastate.pressbooks.pub/cropimprovement/open/download?type=pdf",
  ],
  [
    "A Guide to the Principles of Animal Nutrition",
    "https://open.oregonstate.education/animalnutrition/",
    "https://open.oregonstate.education/animalnutrition/open/download?type=pdf",
  ],
  [
    "Genetics, Agriculture, and Biotechnology",
    "https://iastate.pressbooks.pub/genagbiotech/",
    "https://iastate.pressbooks.pub/genagbiotech/open/download?type=pdf",
  ],
  [
    "Gardener Handbook (VT)",
    "https://pressbooks.lib.vt.edu/emgtraining/",
    "https://pressbooks.lib.vt.edu/emgtraining/open/download?type=pdf",
  ],
];
for (const [group, list] of [
  ["LANG", lang],
  ["FARM", farm],
]) {
  console.log("== " + group);
  for (const [name, page, pdf] of list) {
    const [p, c] = await Promise.all([
      pdfSize(pdf).catch((e) => ({ ok: false, mb: 0, err: e.name })),
      og(page),
    ]);
    console.log(
      `${name} | ${p.ok ? "PDF" : p.err || "NOT-PDF"} ${p.mb.toFixed(1)}MB | cover=${c || "-"}`,
    );
  }
}
