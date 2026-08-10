const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();

  // form + localStorage
  let page = await browser.newPage({ viewport: { width: 375, height: 780 } });
  await page.goto('http://localhost:8811/', { waitUntil: 'load' });
  await page.click('.nav-cta');
  await page.waitForTimeout(1200);
  await page.fill('#email', 'not-an-email');
  await page.click('#wlForm button');
  await page.waitForTimeout(400);
  console.log('error shown for bad email:', await page.isVisible('#wlError'));
  await page.fill('#email', 'someone@example.com');
  await page.click('#wlForm button');
  await page.waitForTimeout(900);
  console.log('confirmation shown:', await page.isVisible('#wlDone'));
  console.log('stored:', await page.evaluate(() => localStorage.getItem('serayae.waitlist')));
  await page.screenshot({ path: 'qa/mobile-waitlist-confirmed.png' });
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(800);
  console.log('persists after reload:', await page.evaluate(() => !document.getElementById('wlDone').hidden));
  await page.close();

  // reduced motion
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, reducedMotion: 'reduce' });
  page = await ctx.newPage();
  await page.goto('http://localhost:8811/', { waitUntil: 'load' });
  await page.waitForTimeout(2000);
  const hidden = await page.evaluate(() => {
    const els = Array.from(document.querySelectorAll('.reveal, .beat, .freeze-copy p'));
    return els.filter(e => parseFloat(getComputedStyle(e).opacity) < 0.05).length;
  });
  console.log('reduced-motion hidden elements (should be 0):', hidden);
  await page.screenshot({ path: 'qa/reduced-ch1.png' });
  await page.evaluate(() => document.getElementById('ch3').scrollIntoView());
  await page.waitForTimeout(800);
  await page.screenshot({ path: 'qa/reduced-ch3.png' });
  await ctx.close();

  // keyboard focus
  const ctx2 = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const p2 = await ctx2.newPage();
  await p2.goto('http://localhost:8811/', { waitUntil: 'load' });
  await p2.waitForTimeout(1500);
  await p2.keyboard.press('Tab');
  await p2.keyboard.press('Tab');
  await p2.screenshot({ path: 'qa/focus.png' });
  await ctx2.close();

  await browser.close();
})();
