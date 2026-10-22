const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
const H = {
  "User-Agent": UA,
  Accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
  "Sec-Fetch-Dest": "document",
  "Sec-Fetch-Mode": "navigate",
  "Sec-Fetch-Site": "same-origin",
  "Upgrade-Insecure-Requests": "1",
  Range: "bytes=0-3",
};
const books = [
  [
    "Soil Science",
    "https://openpress.usask.ca/soilscience/open/download?type=pdf",
  ],
  [
    "Rain or Shine",
    "https://open.library.okstate.edu/rainorshine/open/download?type=pdf",
  ],
  [
    "Gardener Handbook",
    "https://pressbooks.lib.vt.edu/emgtraining/open/download?type=pdf",
  ],
  [
    "Crop Improvement",
    "https://iastate.pressbooks.pub/cropimprovement/open/download?type=pdf",
  ],
  [
    "Crop Genetics",
    "https://iastate.pressbooks.pub/cropgenetics/open/download?type=pdf",
  ],
  [
    "Animal Nutrition",
    "https://open.oregonstate.education/animalnutrition/open/download?type=pdf",
  ],
  ["Arabic MSU", "https://openbooks.lib.msu.edu/arb101/open/download?type=pdf"],
  [
    "Arabic Boise",
    "https://boisestate.pressbooks.pub/pathwaysarabic/open/download?type=pdf",
  ],
  [
    "Turkish Boise",
    "https://boisestate.pressbooks.pub/pathwaysturkish/open/download?type=pdf",
  ],
  [
    "French Boise",
    "https://boisestate.pressbooks.pub/french101/open/download?type=pdf",
  ],
  [
    "Chinese MSU",
    "https://openbooks.lib.msu.edu/chs101/open/download?type=pdf",
  ],
];
for (const [name, u] of books) {
  try {
    const r = await fetch(u, {
      headers: { ...H, Referer: new URL(u).origin + "/" },
      redirect: "follow",
      signal: AbortSignal.timeout(25000),
    });
    const ct = r.headers.get("content-type") || "";
    const total =
      (r.headers.get("content-range") || "").split("/")[1] ||
      r.headers.get("content-length") ||
      "?";
    const b = Buffer.from(await r.arrayBuffer());
    console.log(
      `${name} | ${r.status} | ${ct.includes("pdf") ? "PDF" : "NOT-PDF"} | ${total === "?" ? "?" : (Number(total) / 1048576).toFixed(1)}MB | ${b.subarray(0, 5).toString("latin1")}`,
    );
  } catch (e) {
    console.log(`${name} | ERR ${e.cause?.code || e.name}`);
  }
}
