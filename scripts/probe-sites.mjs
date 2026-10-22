const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
const sites = [
  "https://open.oregonstate.education/permaculture/",
  "https://iastate.pressbooks.pub/genagbiotech/",
  "https://boisestate.pressbooks.pub/pathwaysarabic/",
  "https://openbooks.lib.msu.edu/arb101/",
  "https://opentextbc.ca/horticulture/",
];
for (const s of sites) {
  try {
    const r = await fetch(s, {
      headers: { "User-Agent": UA, Accept: "text/html" },
      redirect: "follow",
    });
    const t = await r.text();
    const links = [
      ...new Set(
        [...t.matchAll(/href="([^"]*(?:download|\.pdf)[^"]*)"/gi)].map(
          (m) => m[1],
        ),
      ),
    ].slice(0, 4);
    console.log(`${r.status} len=${t.length} ${s}`);
    links.forEach((l) => console.log("   ", l.replace(/&amp;/g, "&")));
  } catch (e) {
    console.log("ERR", s, e.message);
  }
}
