const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
const sites = [
  ["Arabic Boise", "https://boisestate.pressbooks.pub/pathwaysarabic/"],
  ["Arabic MSU", "https://openbooks.lib.msu.edu/arb101/"],
  ["Spanish Houston", "https://louis.pressbooks.pub/elementaryspanish1/"],
  ["French Boise", "https://boisestate.pressbooks.pub/pathwaysfrench/"],
  ["German Boise", "https://boisestate.pressbooks.pub/pathwaysgerman/"],
  ["Permaculture", "https://open.oregonstate.education/permaculture/"],
  ["Rain or Shine", "https://open.library.okstate.edu/rainorshine/"],
  ["Crop Improvement", "https://iastate.pressbooks.pub/cropimprovement/"],
  ["Animal Nutrition", "https://open.oregonstate.education/animalnutrition/"],
  ["GenAgBiotech", "https://iastate.pressbooks.pub/genagbiotech/"],
  ["Gardener VT", "https://pressbooks.lib.vt.edu/emgtraining/"],
];
for (const [name, s] of sites) {
  try {
    const r = await fetch(s, {
      headers: { "User-Agent": UA },
      redirect: "follow",
      signal: AbortSignal.timeout(25000),
    });
    const t = await r.text();
    const og =
      t.match(/property="og:image"\s+content="([^"]+)"/i) ||
      t.match(/content="([^"]+)"\s+property="og:image"/i);
    const cands = [
      ...new Set(
        [...t.matchAll(/(?:src|href)="([^"]+\.(?:jpe?g|png|webp|svg)[^"]*)"/gi)]
          .map((m) => (m[1].startsWith("/") ? new URL(m[1], s).href : m[1]))
          .filter((x) => /cover|book-cover|cropped|header|title/i.test(x)),
      ),
    ].slice(0, 4);
    console.log(`${name} | ${r.status}`);
    console.log(`   og: ${og?.[1] || "-"}`);
    cands.forEach((c) => console.log(`   img: ${c}`));
  } catch (e) {
    console.log(`${name} | ERR ${e.name}`);
  }
}
