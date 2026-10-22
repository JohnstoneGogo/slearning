const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
const urls = [
  'https://iastate.pressbooks.pub/genagbiotech/open/download?type=pdf',
  'https://boisestate.pressbooks.pub/pathwaysarabic/open/download?type=pdf',
  'https://open.oregonstate.education/permaculture/open/download?type=pdf',
  'https://openbooks.lib.msu.edu/arb101/open/download?type=pdf'
];
for (const u of urls) {
  const origin = new URL(u).origin;
  try {
    const r = await fetch(u, {
      headers: {
        'User-Agent': UA, Referer: origin + '/',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Sec-Fetch-Dest': 'document', 'Sec-Fetch-Mode': 'navigate', 'Sec-Fetch-Site': 'same-origin',
        'Upgrade-Insecure-Requests': '1'
      },
      redirect: 'follow'
    });
    const ct = r.headers.get('content-type') || '';
    if (ct.includes('pdf')) {
      const b = Buffer.from(await r.arrayBuffer());
      console.log(`${r.status} | ${ct} | ${(b.length / 1048576).toFixed(1)}MB | ${b.subarray(0, 5).toString('latin1')} | ${u}`);
    } else {
      console.log(`${r.status} | ${ct} | NOT PDF | ${u}`);
    }
  } catch (e) { console.log(`ERR | ${e.cause?.code || e.message} | ${u}`); }
}
