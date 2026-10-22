const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
const sites = [
  ["Chinese MSU", "https://openbooks.lib.msu.edu/chs101/"],
  ["Turkish Boise", "https://boisestate.pressbooks.pub/pathwaysturkish/"],
  ["Japanese PDX", "https://pdxscholar.library.pdx.edu/pdxopen/15/"],
  ["Portuguese UW", "https://uw.pressbooks.pub/batepapo/"],
];
for (const [n, s] of sites) {
  try {
    const r = await fetch(s, {
      headers: { "User-Agent": UA },
      redirect: "follow",
      signal: AbortSignal.timeout(25000),
    });
    if (r.status !== 200) {
      console.log(`${n} | page ${r.status}`);
      continue;
    }
    const t = await r.text();
    const og =
      t.match(/property="og:image"\s+content="([^"]+)"/i) ||
      t.match(/content="([^"]+)"\s+property="og:image"/i);
    const pdf = await fetch(
      s + (s.includes("pdxscholar") ? "" : "open/download?type=pdf"),
      {
        headers: { "User-Agent": UA, Referer: s, Range: "bytes=0-3" },
        redirect: "follow",
        signal: AbortSignal.timeout(25000),
      },
    );
    const ct = pdf.headers.get("content-type") || "";
    const total = Number(
      (pdf.headers.get("content-range") || "").split("/")[1] || 0,
    );
    console.log(
      `${n} | page ${r.status} | ${ct.includes("pdf") ? `PDF ${(total / 1048576).toFixed(1)}MB` : ct} | og=${og?.[1] || "-"}`,
    );
  } catch (e) {
    console.log(`${n} | ERR ${e.name}`);
  }
}
