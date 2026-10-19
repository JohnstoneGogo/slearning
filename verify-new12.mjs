const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
const urls = [
  [
    "Arabic Boise",
    "https://boisestate.pressbooks.pub/pathwaysarabic/open/download?type=pdf",
  ],
  ["Arabic MSU", "https://openbooks.lib.msu.edu/arb101/open/download?type=pdf"],
  [
    "Spanish Boise",
    "https://boisestate.pressbooks.pub/pathwaysspanish/open/download?type=pdf",
  ],
  [
    "French Boise",
    "https://boisestate.pressbooks.pub/pathwaysfrench/open/download?type=pdf",
  ],
  [
    "German Boise",
    "https://boisestate.pressbooks.pub/pathwaysgerman/open/download?type=pdf",
  ],
  [
    "Permaculture",
    "https://open.oregonstate.education/permaculture/open/download?type=pdf",
  ],
  [
    "Rain or Shine",
    "https://open.library.okstate.edu/rainorshine/open/download?type=pdf",
  ],
  [
    "Crop Improvement",
    "https://iastate.pressbooks.pub/cropimprovement/open/download?type=pdf",
  ],
  [
    "Animal Nutrition",
    "https://open.oregonstate.education/animalnutrition/open/download?type=pdf",
  ],
  [
    "GenAgBiotech",
    "https://iastate.pressbooks.pub/genagbiotech/open/download?type=pdf",
  ],
  [
    "Gardener VT",
    "https://pressbooks.lib.vt.edu/emgtraining/open/download?type=pdf",
  ],
  ["Swahili root", "https://nulib-oer.github.io/swahili/"],
];
for (const [n, u] of urls) {
  try {
    const r = await fetch(u, {
      headers: {
        "User-Agent": UA,
        Referer: new URL(u).origin + "/",
        Range: "bytes=0-3",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(30000),
    });
    const ct = r.headers.get("content-type") || "";
    const total = Number(
      (r.headers.get("content-range") || "").split("/")[1] ||
        r.headers.get("content-length") ||
        0,
    );
    if (ct.includes("pdf"))
      console.log(`${n} | PDF ${(total / 1048576).toFixed(1)}MB OK`);
    else {
      const t = await r.text();
      const links = [
        ...new Set(
          [...t.matchAll(/href="([^"]*\.pdf[^"]*)"/gi)].map((m) => m[1]),
        ),
      ].slice(0, 3);
      console.log(
        `${n} | ${r.status} ${ct} | pdf links: ${links.join(", ") || "none"}`,
      );
    }
  } catch (e) {
    console.log(`${n} | ERR ${e.name}`);
  }
}
