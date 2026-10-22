const urls = [
  "https://open.oregonstate.education/permaculture/open/download?type=pdf",
  "https://iastate.pressbooks.pub/genagbiotech/open/download?type=pdf",
  "https://boisestate.pressbooks.pub/pathwaysarabic/open/download?type=pdf",
  "https://openbooks.lib.msu.edu/arb101/open/download?type=pdf",
  "https://opentextbc.ca/horticulture/open/download?type=pdf",
  "https://nulib-oer.github.io/swahili/",
];
for (const u of urls) {
  try {
    const r = await fetch(u, { method: "GET", redirect: "follow" });
    const ct = r.headers.get("content-type");
    const b = Buffer.from(await r.arrayBuffer());
    console.log(
      `${r.status} | ${ct} | ${(b.length / 1048576).toFixed(1)}MB | ${b.subarray(0, 4).toString("latin1")} | ${u}`,
    );
  } catch (e) {
    console.log(`ERR | ${e.message} | ${u}`);
  }
}
