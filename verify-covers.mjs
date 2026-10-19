import fs from "node:fs";
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
const s = fs.readFileSync("scripts/import-open-ebooks.ts", "utf8");
const body = s.slice(s.indexOf("const books = ["), s.indexOf("] as const;"));
const blocks = body.split(/(?=^\s{2}\{$)/m).slice(1);
for (const b of blocks) {
  const title = (b.match(/title: ['"]((?:[^'"\\]|\\.)*)['"]/) || [])[1];
  const cover = (b.match(/cover: '([^']+)'/) || [])[1];
  const name = (b.match(/coverName: '([^']+)'/) || [])[1];
  if (!cover) {
    console.log(`NO COVER | ${title}`);
    continue;
  }
  try {
    const r = await fetch(cover, {
      method: "GET",
      headers: { "User-Agent": UA, Range: "bytes=0-0" },
      redirect: "follow",
      signal: AbortSignal.timeout(20000),
    });
    const ct = r.headers.get("content-type") || "";
    console.log(
      `${r.status} ${ct.includes("image") ? "IMG" : ct} | ${name} | ${title}`,
    );
  } catch (e) {
    console.log(`ERR ${e.name} | ${title} | ${cover}`);
  }
}
