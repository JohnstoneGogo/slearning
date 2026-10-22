import fs from "node:fs";
const f = "scripts/import-open-ebooks.ts";
let s = fs.readFileSync(f, "utf8");
const from = /  \{\n    title: 'Elementary Spanish I',[\s\S]*?\n  \},\n/;
if (!from.test(s)) {
  console.log("MISS: Elementary Spanish I block");
  process.exit(1);
}
s = s.replace(
  from,
  `  {
    title: "Let's Chat! Spanish",
    author: 'Boise State University',
    description: 'A communicative Spanish workbook for beginners: greetings, daily life, family, travel, and cultural notes, with speaking and listening practice.',
    source: 'https://boisestate.pressbooks.pub/pathwaysspanish/',
    pdf: 'https://boisestate.pressbooks.pub/pathwaysspanish/open/download?type=pdf',
    cover: 'https://boisestate.pressbooks.pub/app/uploads/sites/56/2022/04/8-1.png',
    coverName: 'real-lets-chat-spanish',
    category: 'Languages',
    language: 'Spanish',
    duration: 300,
    points: ['Greet people and introduce yourself in Spanish', 'Use present-tense verbs and everyday vocabulary', 'Read and write short Spanish texts'],
    skills: 'Spanish, conversation, listening, vocabulary',
    license: 'CC BY 4.0',
  },
`,
);
fs.writeFileSync(f, s);
console.log("Spanish replaced");
