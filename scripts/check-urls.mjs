const urls = [
  // Languages
  'https://openbooks.lib.msu.edu/arb101/open/download?type=pdf',
  'https://louis.pressbooks.pub/elementaryspanish1/open/download?type=pdf',
  'https://boisestate.pressbooks.pub/french101/open/download?type=pdf',
  'https://openbooks.lib.msu.edu/chs101/open/download?type=pdf',
  'https://nulib-oer.github.io/swahili/',
  'https://openbooks.lib.msu.edu/basictibetan/open/download?type=pdf',
  'https://boisestate.pressbooks.pub/pathwaysarabic/open/download?type=pdf',
  // Farming / agriculture
  'https://open.oregonstate.education/permaculture/open/download?type=pdf',
  'https://iastate.pressbooks.pub/genagbiotech/open/download?type=pdf',
  'https://iastate.pressbooks.pub/quantitativeplantbreeding/open/download?type=pdf',
  'https://vtechworks.lib.vt.edu/items/37bce666-c903-43bd-a33b-6125449ade03',
  'https://www.iastatedigitalpress.com/plugins/books/207/format/170/',
  'https://pdxscholar.library.pdx.edu/pdxopen/18/',
  'https://opentextbc.ca/horticulture/',
  'https://opentextbc.ca/horticulture/open/download?type=pdf'
];
for (const u of urls) {
  try {
    const r = await fetch(u, { method: 'GET', headers: { Range: 'bytes=0-3', 'User-Agent': 'Mozilla/5.0' }, redirect: 'follow' });
    const b = Buffer.from(await r.arrayBuffer());
    const len = r.headers.get('content-range')?.split('/')[1] || r.headers.get('content-length') || '?';
    console.log(`${r.status} | ${r.headers.get('content-type')} | ${len === '?' ? '?' : (Number(len) / 1048576).toFixed(1)}MB | ${b.toString('latin1').replace(/\n/g, '')} | ${u}`);
  } catch (e) { console.log(`ERR | ${e.message} | ${u}`); }
}
