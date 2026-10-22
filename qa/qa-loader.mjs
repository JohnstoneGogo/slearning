// Probe the page-interchange loader: is it mounted, are the orbit dots animating,
// and does it disappear after the 600ms route-change window?
export default async function run(page, ui) {
  const sample = () =>
    page.evaluate(() => {
      const el = document.querySelector(".page-loader");
      if (!el) return { mounted: false };
      const orbit = el.querySelector(".orbit");
      const dots = [...el.querySelectorAll(".orbit span")];
      return {
        mounted: true,
        hasOrbit: !!orbit,
        dotCount: dots.length,
        orbitAnim: orbit ? getComputedStyle(orbit).animationName : null,
        orbitDur: orbit ? getComputedStyle(orbit).animationDuration : null,
        dotAnim: dots[0] ? getComputedStyle(dots[0]).animationName : null,
        dotDelays: dots.map((d) => getComputedStyle(d).animationDelay),
        // capture a transform mid-animation from two consecutive frames
        transforms: dots.map((d) => getComputedStyle(d).transform),
      };
    });

  const noMargin = await page.evaluate(
    () =>
      getComputedStyle(document.querySelector(".orbit span") || document.body)
        .marginTop,
  );
  const first = await sample();
  await page.waitForTimeout(120);
  const second = await sample();
  await page.waitForTimeout(700);
  const gone = await sample();

  return {
    noMargin,
    first,
    second,
    transformsChanged:
      JSON.stringify(first.transforms) !== JSON.stringify(second.transforms),
    goneAfter600ms: gone.mounted === false,
    gone,
  };
}
