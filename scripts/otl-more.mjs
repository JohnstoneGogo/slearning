const qs = [
  "swahili",
  "agriculture",
  "farming",
  "crop",
  "soil",
  "livestock",
  "irrigation",
  "gardening",
  "nutrition",
];
for (const q of qs) {
  const r = await fetch(
    `https://open.umn.edu/opentextbooks/textbooks.json?per_page=50&q=${q}`,
    { headers: { "User-Agent": "Mozilla/5.0" } },
  );
  const j = await r.json();
  console.log(`=== ${q} ===`);
  for (const b of j.data) {
    const links = (b.formats || [])
      .filter((f) => ["PDF", "Online", "eBook"].includes(f.type))
      .map((f) => `${f.type}:${f.url}`);
    console.log(`${b.title} || ${b.license} || ${links.join(" | ")}`);
  }
}
