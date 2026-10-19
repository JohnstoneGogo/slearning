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
  [
    "Livestock Health",
    "https://www.iastatedigitalpress.com/plugins/books/207/format/170/",
  ],
  [
    "Soil Science (ISU)",
    "https://www.iastatedigitalpress.com/plugins/books/201/format/",
  ],
  ["Arabic MSU", "https://openbooks.lib.msu.edu/arb101/open/download?type=pdf"],
  [
    "Arabic Boise",
    "https://boisestate.pressbooks.pub/pathwaysarabic/open/download?type=pdf",
  ],
  [
    "Turkish",
    "https://boisestate.pressbooks.pub/pathwaysturkish/open/download?type=pdf",
  ],
  ["Swahili", "https://nulib-oer.github.io/swahili/"],
];
for (const [name, u] of books) {
  try {
    const page = new URL(u).origin;
    const r = await fetch(u, {
      headers: { ...H, Referer: page + "/" },
      redirect: "follow",
    });
    const ct = r.headers.get("content-type") || "";
    if (ct.includes("pdf")) {
      const b = Buffer.from(await r.arrayBuffer());
      console.log(
        `${name} | PDF ${(b.length / 1048576).toFixed(1)}MB ${b.subarray(0, 5).toString("latin1")} | ${u}`,
      );
    } else {
      const t = await r.text();
      const links = [
        ...new Set(
          [...t.matchAll(/href="([^"]*(?:download|\.pdf)[^"]*)"/gi)].map(
            (m) => m[1],
          ),
        ),
      ].slice(0, 6);
      console.log(`${name} | ${r.status} NOT-PDF | ${u}`);
      links.forEach((l) => console.log("     ", l));
    }
  } catch (e) {
    console.log(`${name} | ERR ${e.cause?.code || e.message} | ${u}`);
  }
}
