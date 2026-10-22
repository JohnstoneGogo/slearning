const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
const urls = [
  'https://iastate.pressbooks.pub/genagbiotech/open/download?type=pdf',
  'https://boisestate.pressbooks.pub/pathwaysarabic/open/download?type=pdf',
  'https://open.oregonstate.education/permaculture/open/download?type=pdf'
];
for (const u of urls) {
  const origin = new URL(u).origin;
  const r = await fetch(u, { headers: { 'User-Agent': UA, Referer: origin + '/', Accept: 'application/pdf,*/*' }, redirect: 'follow' });
  const ct = r.headers.get('content-type');
  const len = r.headers.get('content-length');
  if (ct?.includes('pdf')) { const b = Buffer.from(await r.arrayBuffer()); console.log(`${r.status} | ${ct} | ${(b.length / 1048576).toFixed(1)}MB | ${b.subarray(0, 5).toString('latin1')} | ${u}`); }
  else console.log(`${r.status} | ${ct} | len=${len} | ${u}`);
}
