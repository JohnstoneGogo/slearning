const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
const sites = [
  ["Spanish Boise", "https://boisestate.pressbooks.pub/pathwaysspanish/"],
  ["Spanish UNA", "https://una.pressbooks.pub/gr101spanish/"],
  ["Spanish PDX", "https://pdxscholar.library.pdx.edu/pdxopen/3/"],
];
for (const [name, s] of sites) {
  try {
    const r = await fetch(s, {
      headers: { "User-Agent": UA },
      redirect: "follow",
      signal: AbortSignal.timeout(25000),
    });
    if (r.status !== 200) {
      console.log(`${name} | ${r.status}`);
      continue;
    }
    const t = await r.text();
    const og =
      t.match(/property="og:image"\s+content="([^"]+)"/i) ||
      t.match(/content="([^"]+)"\s+property="og:image"/i);
    console.log(`${name} | ${r.status} | og=${og?.[1] || "-"}`);
    const pdf = await fetch(s + "open/download?type=pdf", {
      headers: { "User-Agent": UA, Referer: s, Range: "bytes=0-3" },
      redirect: "follow",
      signal: AbortSignal.timeout(25000),
    });
    const total = Number(
      (pdf.headers.get("content-range") || "").split("/")[1] || 0,
    );
    console.log(
      `   pdf: ${pdf.status} ${pdf.headers.get("content-type")} ${(total / 1048576).toFixed(1)}MB`,
    );
  } catch (e) {
    console.log(`${name} | ERR ${e.name}`);
  }
}
