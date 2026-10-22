import fs from "node:fs";

const file = "scripts/import-open-ebooks.ts";
const src = fs.readFileSync(file, "utf8");
const start = src.indexOf("const books = [");
const end = src.indexOf("] as const;") + "] as const;".length;
let body = src.slice(start, end);

// Examined on the source pages: BCcampus Project Management is CC BY 4.0,
// every OpenStax title is CC BY-NC-SA 4.0, the OTL/Pressbooks titles are CC BY 4.0.
const licenses = {
  "Project Management": "CC BY 4.0",
  "Introduction to Business": "CC BY 4.0",
  "Let's Chat! Arabic": "CC BY 4.0",
  "Elementary Arabic I": "CC BY 4.0",
  "Elementary Spanish I": "CC BY 4.0",
  "Let's Chat! French": "CC BY 4.0",
  "Let's Chat! German": "CC BY 4.0",
  "Elementary Swahili": "CC BY 4.0",
  "Introduction to Permaculture": "CC BY 4.0",
  "Rain or Shine: Soil and Water Conservation": "CC BY 4.0",
  "Crop Improvement and Weather Forecasting": "CC BY 4.0",
  "Principles of Animal Nutrition": "CC BY 4.0",
  "Genetics, Agriculture, and Biotechnology": "CC BY 4.0",
  "The Gardeners Handbook": "CC BY 4.0",
};

// Language of the book's instruction. "" would mean English; the schema wants a real value.
const languages = {
  "Project Management": "English",
  "Introduction to Business": "English",
  "Business Ethics": "English",
  "Principles of Management": "English",
  "Principles of Marketing": "English",
  "Principles of Finance": "English",
  "Organizational Behavior": "English",
  "College Success Concise": "English",
  "Introduction to Python Programming": "English",
  "Introduction to Computer Science": "English",
  "Principles of Data Science": "English",
  "Introduction to Intellectual Property": "English",
  "Introduction to Permaculture": "English",
  "Rain or Shine: Soil and Water Conservation": "English",
  "Crop Improvement and Weather Forecasting": "English",
  "Principles of Animal Nutrition": "English",
  "Genetics, Agriculture, and Biotechnology": "English",
  "The Gardeners Handbook": "English",
};

const blocks = body.split(/(?=^\s{2}\{$)/m);
let changed = 0;

for (let i = 1; i < blocks.length; i++) {
  let b = blocks[i];
  const title = (b.match(/title: '((?:[^'\\]|\\.)*)'/) || [])[1]?.replace(
    /\\'/g,
    "'",
  );
  if (!title) continue;

  const language = languages[title];
  const license = licenses[title] ?? "CC BY-NC-SA 4.0";

  if (!/^\s{4}language:/m.test(b) && language) {
    // Put `language` right after `category` when present, otherwise before `duration`.
    if (/^\s{4}category:/m.test(b))
      b = b.replace(
        /^(\s{4}category:[^\n]*\n)/m,
        `$1    language: '${language}',\n`,
      );
    else
      b = b.replace(/^(\s{4}duration:)/m, `    language: '${language}',\n$1`);
    changed++;
  }
  if (!/^\s{4}license:/m.test(b)) {
    b = b.replace(/^(\s{4}skills:[^\n]*\n)/m, `$1    license: '${license}',\n`);
    changed++;
  }
  blocks[i] = b;
}

body = blocks.join("");
fs.writeFileSync(file, src.slice(0, start) + body + src.slice(end));
console.log("fields added:", changed);
