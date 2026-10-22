const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
const H = (u) => ({
  "User-Agent": UA,
  Referer: new URL(u).origin + "/",
  Accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
  "Sec-Fetch-Dest": "document",
  "Sec-Fetch-Mode": "navigate",
  "Sec-Fetch-Site": "same-origin",
  "Upgrade-Insecure-Requests": "1",
});
const urls = {
  "Spanish Boise":
    "https://boisestate.pressbooks.pub/pathwaysspanish/open/download?type=pdf",
  "French Boise":
    "https://boisestate.pressbooks.pub/pathwaysfrench/open/download?type=pdf",
  "German Boise":
    "https://boisestate.pressbooks.pub/pathwaysgerman/open/download?type=pdf",
  "Arabic Boise":
    "https://boisestate.pressbooks.pub/pathwaysarabic/open/download?type=pdf",
  "Arabic MSU": "https://openbooks.lib.msu.edu/arb101/open/download?type=pdf",
  "Portuguese UW": "https://uw.pressbooks.pub/batepapo/open/download?type=pdf",
  Permaculture:
    "https://open.oregonstate.education/permaculture/open/download?type=pdf",
  "Animal Nutrition":
    "https://open.oregonstate.education/animalnutrition/open/download?type=pdf",
  "Crop Improvement":
    "https://iastate.pressbooks.pub/cropimprovement/open/download?type=pdf",
  GenAgBiotech:
    "https://iastate.pressbooks.pub/genagbiotech/open/download?type=pdf",
  "Rain or Shine":
    "https://open.library.okstate.edu/rainorshine/open/download?type=pdf",
  "Gardener VT":
    "https://pressbooks.lib.vt.edu/emgtraining/open/download?type=pdf",
};
for (const [n, u] of Object.entries(urls)) {
  const started = Date.now();
  try {
    const r = await fetch(u, {
      headers: H(u),
      redirect: "follow",
      signal: AbortSignal.timeout(20000),
    });
    const total = Number(r.headers.get("content-length") || 0);
    let bytes = 0;
    for await (const c of r.body) {
      bytes += c.length;
      if (Date.now() - started > 8000) break;
    }
    const secs = (Date.now() - started) / 1000;
    console.log(
      `${n.padEnd(16)} ${((bytes / 1048576 / secs) * 8).toFixed(1).padStart(6)} Mbps  ${(total / 1048576).toFixed(1)}MB  ${r.status}`,
    );
  } catch (e) {
    console.log(
      `${n.padEnd(16)} ERR ${e.name} after ${((Date.now() - started) / 1000).toFixed(0)}s`,
    );
  }
}
