import fs from "node:fs";
const f = "scripts/import-open-ebooks.ts";
let s = fs.readFileSync(f, "utf8");
const fixes = [
  [
    "pathwaysarabic/wp-content/uploads/sites/1223/2022/08/cropped-Artboard-1.png",
    "boisestate.pressbooks.pub/app/uploads/sites/59/2022/10/Black-and-White-Minimal-Cityscape-Architecture-Book-Cover-2.png",
  ],
  [
    "openbooks.lib.msu.edu/arb101/wp-content/uploads/sites/12/2022/08/arb101-cover.png",
    "openbooks.lib.msu.edu/app/uploads/sites/65/2021/12/Elementary-Arabic-1.jpg",
  ],
  [
    "pathwaysfrench/wp-content/uploads/sites/1223/2022/08/cropped-Artboard-1.png",
    "boisestate.pressbooks.pub/app/uploads/sites/58/2022/10/6.png",
  ],
  [
    "pathwaysgerman/wp-content/uploads/sites/1223/2022/08/cropped-Artboard-1.png",
    "boisestate.pressbooks.pub/app/uploads/sites/60/2022/10/7.png",
  ],
  [
    "open.oregonstate.education/permaculture/wp-content/uploads/2022/03/Permaculture-Cover.png",
    "open.oregonstate.education/app/uploads/sites/38/2026/04/OER-Archived-Textbook-Cover-Introduction-to-Permaculture-Pressbooks.png",
  ],
  [
    "open.library.okstate.edu/rainorshine/wp-content/uploads/sites/113/2022/12/Rain-or-Shine-Cover.png",
    "open.library.okstate.edu/app/uploads/sites/4/2019/06/Rain-or-Shine-June-2017-1.png",
  ],
  [
    "iastate.pressbooks.pub/cropimprovement/wp-content/uploads/sites/31/2021/05/crop-improvement-cover.png",
    "iastate.pressbooks.pub/app/uploads/sites/93/2023/06/cropimprovement-cover.png",
  ],
  [
    "open.oregonstate.education/animalnutrition/wp-content/uploads/2021/04/AN-Cover-Image.png",
    "open.oregonstate.education/app/uploads/sites/310/2025/12/OER-Textbook-Cover-Animal-Nutrition.png",
  ],
  [
    "iastate.pressbooks.pub/genagbiotech/wp-content/uploads/sites/74/2021/08/genagbiotech-cover.png",
    "iastate.pressbooks.pub/app/uploads/sites/49/2021/09/suza-genetics-cover-1.png",
  ],
  [
    "pressbooks.lib.vt.edu/emgtraining/wp-content/uploads/sites/171/2020/10/gardener-handbook-cover.png",
    "pressbooks.lib.vt.edu/app/uploads/sites/55/2023/02/Front-cover-PB.png",
  ],
];
let applied = 0;
for (const [from, to] of fixes) {
  if (s.includes(from)) {
    s = s.split(from).join(to);
    applied++;
  } else console.log("MISS:", from);
}
fs.writeFileSync(f, s);
console.log("applied", applied);
