const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
const u =
  "https://boisestate.pressbooks.pub/pathwaysspanish/open/download?type=pdf";
for (let attempt = 1; attempt <= 2; attempt++) {
  try {
    const r = await fetch(u, {
      headers: {
        "User-Agent": UA,
        Referer: "https://boisestate.pressbooks.pub/",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Sec-Fetch-Dest": "document",
        "Sec-Fetch-Mode": "navigate",
        "Sec-Fetch-Site": "same-origin",
        "Upgrade-Insecure-Requests": "1",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(120000),
    });
    console.log(
      "status",
      r.status,
      r.headers.get("content-type"),
      r.headers.get("content-length"),
    );
    let bytes = 0;
    for await (const chunk of r.body) bytes += chunk.length;
    console.log("downloaded", (bytes / 1048576).toFixed(1), "MB");
    break;
  } catch (e) {
    console.log("attempt", attempt, "ERR", e.cause?.code || e.name, e.message);
  }
}
