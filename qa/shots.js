const { chromium } = require('playwright');

const IDS = ['ch1', 'ch2', 'ch3', 'ch4', 'ch5', 'ch6', 'ch7', 'waitlist'];

(async () => {
  const browser = await chromium.launch();
  const errs = [];
  for (const vp of [{ w: 1280, h: 800, tag: 'desktop' }, { w: 375, h: 780, tag: 'mobile' }]) {
    const page = await browser.newPage({ viewport: { width: vp.w, height: vp.h }, deviceScaleFactor: 1 });
    page.on('console', m => { if (m.type() === 'error') errs.push(`[${vp.tag}] ${m.text()}`); });
    page.on('pageerror', e => errs.push(`[${vp.tag}] pageerror: ${e.message}`));
    await page.goto('http://localhost:8811/', { waitUntil: 'load' });
    await page.waitForTimeout(3500);

    for (const id of IDS) {
      // smooth-ish incremental scroll so ScrollTrigger scrubs fire
      const target = await page.evaluate((i) => {
        const el = document.getElementById(i);
        const r = el.getBoundingClientRect();
        return window.scrollY + r.top + Math.max(0, (r.height - window.innerHeight) / 2);
      }, id);
      await page.evaluate(async (y) => {
        const start = window.scrollY;
        const steps = 22;
        for (let s = 1; s <= steps; s++) {
          window.scrollTo(0, start + ((y - start) * s) / steps);
          await new Promise(r => setTimeout(r, 40));
        }
      }, target);
      await page.waitForTimeout(1800);
      await page.screenshot({ path: `qa/${vp.tag}-${id}.png` });

      if (id === 'ch3') {
        // capture the freeze beat specifically
        await page.evaluate(() => {
          const el = document.getElementById('freezeCopy');
          const r = el.getBoundingClientRect();
          window.scrollTo(0, window.scrollY + r.top - window.innerHeight * 0.55);
        });
        await page.waitForTimeout(1600);
        await page.screenshot({ path: `qa/${vp.tag}-ch3-freeze.png` });
      }
    }

    const diag = await page.evaluate(() => {
      const over = [];
      document.querySelectorAll('body *').forEach(el => {
        const r = el.getBoundingClientRect();
        if (r.width && (r.right > window.innerWidth + 2 || r.left < -2)) {
          const cs = getComputedStyle(el);
          if (cs.position === 'fixed' || cs.position === 'absolute') return;
          over.push(el.tagName + '.' + (el.className || '').toString().slice(0, 40) + ' r=' + Math.round(r.right));
        }
      });
      return {
        docScrollW: document.documentElement.scrollWidth,
        innerW: window.innerWidth,
        overflow: over.slice(0, 12),
        frozenClassWorks: typeof gsap !== 'undefined'
      };
    });
    console.log(vp.tag, JSON.stringify(diag, null, 1));
    await page.close();
  }
  console.log('ERRORS:', errs.length ? errs.join('\n') : 'none');
  await browser.close();
})();
