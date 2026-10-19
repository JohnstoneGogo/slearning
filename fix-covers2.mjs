import fs from "node:fs";
const f = "scripts/import-open-ebooks.ts";
let s = fs.readFileSync(f, "utf8");
// The first pass prefixed the host even though the stored value already had it.
const doubled = [
  "boisestate.pressbooks.pub/",
  "openbooks.lib.msu.edu/",
  "open.oregonstate.education/",
  "open.library.okstate.edu/",
  "iastate.pressbooks.pub/",
  "pressbooks.lib.vt.edu/",
];
let n = 0;
for (const host of doubled) {
  const bad = `https://${host}${host}`;
  if (s.includes(bad)) {
    s = s.split(bad).join(`https://${host}`);
    n++;
    console.log("fixed", host);
  }
}
// Higher-resolution Arabic MSU cover.
s = s.replace("Elementary-Arabic-1.jpg", "Elementary-Arabic-1-150.jpg");

// Swahili has no downloadable PDF; replace it with a verified Portuguese title.
const swahili = /  \{\n    title: 'Elementary Swahili',[\s\S]*?\n  \},\n/;
if (!swahili.test(s)) {
  console.log("MISS: Swahili block");
} else {
  s = s.replace(
    swahili,
    `  {
    title: 'Bate-Papo: Beginning Portuguese',
    author: 'University of Washington',
    description: 'An open introductory Portuguese course for real conversation: greetings, daily routines, travel, and Brazilian culture.',
    source: 'https://uw.pressbooks.pub/batepapo/',
    pdf: 'https://uw.pressbooks.pub/batepapo/open/download?type=pdf',
    cover: 'https://uw.pressbooks.pub/app/uploads/sites/12/2019/06/Bate-Papo-COVER-_IMG.jpg',
    coverName: 'real-bate-papo-portuguese',
    category: 'Languages',
    language: 'Portuguese',
    duration: 300,
    points: ['Greet people and introduce yourself in Portuguese', 'Use everyday vocabulary and present-tense verbs', 'Understand Brazilian culture and expression'],
    skills: 'Portuguese, conversation, listening, vocabulary',
    license: 'CC BY 4.0',
  },
`,
  );
  console.log("Swahili replaced with Portuguese");
}
fs.writeFileSync(f, s);
console.log("host fixes", n);
