const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  for (const vp of [{ w: 1280, h: 800, tag: 'desktop' }, { w: 375, h: 780, tag: 'mobile' }]) {
    const page = await browser.newPage({ viewport: { width: vp.w, height: vp.h } });
    await page.goto('http://localhost:8811/', { waitUntil: 'load' });
    await page.waitForTimeout(3000);
    const top = await page.evaluate(() => window.scrollY + document.getElementById('ch3').getBoundingClientRect().top);
    const H = await page.evaluate(() => document.getElementById('ch3').getBoundingClientRect().height);
    const stops = [0.1, 0.3, 0.5, 0.7, 0.9];
    let cur = 0;
    for (const s of stops) {
      const y = top + H * s;
      await page.evaluate(async (y) => {
        const start = window.scrollY, steps = 18;
        for (let i = 1; i <= steps; i++) { window.scrollTo(0, start + (y - start) * i / steps); await new Promise(r => setTimeout(r, 45)); }
      }, y);
      await page.waitForTimeout(1200);
      await page.screenshot({ path: `qa/${vp.tag}-gap-${Math.round(s * 100)}.png` });
      const frozen = await page.evaluate(() => document.body.classList.contains('frozen'));
      console.log(vp.tag, s, 'frozen=', frozen);
    }
    await page.close();
  }
  await browser.close();
})();
