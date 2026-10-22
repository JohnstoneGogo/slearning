import fs from "node:fs";
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
const u =
  "https://open.oregonstate.education/permaculture/open/download?type=pdf";
const headers = {
  "User-Agent": UA,
  Referer: new URL(u).origin + "/",
  Accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
  "Sec-Fetch-Dest": "document",
  "Sec-Fetch-Mode": "navigate",
  "Sec-Fetch-Site": "same-origin",
  "Upgrade-Insecure-Requests": "1",
};
const dest = "uploads/private/probe_permaculture.pdf.part";
try {
  const r = await fetch(u, {
    headers,
    redirect: "follow",
    signal: AbortSignal.timeout(600000),
  });
  console.log(
    "status",
    r.status,
    r.headers.get("content-type"),
    r.headers.get("content-length"),
  );
  const { Readable } = await import("node:stream");
  const { pipeline } = await import("node:stream/promises");
  await pipeline(Readable.fromWeb(r.body), fs.createWriteStream(dest));
  console.log("size", (fs.statSync(dest).size / 1048576).toFixed(1), "MB");
} catch (e) {
  console.log("ERR", e.name, e.cause?.code || "", e.message);
}
