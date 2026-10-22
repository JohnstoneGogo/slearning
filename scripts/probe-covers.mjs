const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
const sites = [
  "https://iastate.pressbooks.pub/genagbiotech/",
  "https://boisestate.pressbooks.pub/pathwaysarabic/",
  "https://open.oregonstate.education/permaculture/",
  "https://openbooks.lib.msu.edu/arb101/",
  "https://nulib-oer.github.io/swahili/",
];
for (const s of sites) {
  try {
    const r = await fetch(s, {
      headers: { "User-Agent": UA, "Accept-Language": "en-US,en;q=0.9" },
      redirect: "follow",
    });
    const t = await r.text();
    const og =
      t.match(/property="og:image"\s+content="([^"]+)"/i) ||
      t.match(/content="([^"]+)"\s+property="og:image"/i);
    const imgs = [
      ...new Set(
        [...t.matchAll(/src="([^"]+\.(?:jpe?g|png|webp|svg)[^"]*)"/gi)]
          .map((m) => m[1])
          .filter((x) => /cover|book|title|header/i.test(x)),
      ),
    ]
      .map((x) => (x.startsWith("/") ? new URL(x, s).href : x))
      .slice(0, 3);
    console.log(s);
    console.log("  og:", og?.[1] || "-");
    imgs.forEach((i) => console.log("  img:", i));
  } catch (e) {
    console.log("ERR", s, e.message);
  }
}
