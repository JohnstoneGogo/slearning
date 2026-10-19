const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
const r = await fetch("https://openbooks.lib.msu.edu/arb101/", {
  headers: { "User-Agent": UA },
  redirect: "follow",
});
const t = await r.text();
const imgs = [
  ...new Set(
    [...t.matchAll(/(?:src|href)="([^"]+\.(?:jpe?g|png|webp)[^"]*)"/gi)].map(
      (m) => (m[1].startsWith("/") ? new URL(m[1], r.url).href : m[1]),
    ),
  ),
]
  .filter((u) => /cover|arb|arab/i.test(u))
  .slice(0, 8);
console.log(imgs.join("\n"));
const og = t.match(/property="og:image"\s+content="([^"]+)"/i);
console.log("og:", og?.[1]);
