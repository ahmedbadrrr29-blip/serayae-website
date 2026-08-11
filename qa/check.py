import sys, json, pathlib
from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent
URL = "file://" + str(ROOT / "index.html")

JS = """() => {
  const rect = el => { const r = el.getBoundingClientRect();
    return {x:Math.round(r.x),y:Math.round(r.y),w:Math.round(r.width),h:Math.round(r.height),
            x2:Math.round(r.right),y2:Math.round(r.bottom)}; };
  const textRect = el => { const rg=document.createRange(); rg.selectNodeContents(el);
    const r=rg.getBoundingClientRect();
    return {x:Math.round(r.x),y:Math.round(r.y),w:Math.round(r.width),h:Math.round(r.height),
            x2:Math.round(r.right),y2:Math.round(r.bottom)}; };
  const items = [...document.querySelectorAll('#field > *')].map(el => {
    const cap = el.querySelector('.cap, figcaption');
    return {name: (cap && cap.textContent.trim()) || el.className.split(' ')[0] || el.tagName,
            cls: el.className, ...rect(el)};
  });
  const prot = {};
  const p = (k, el, txt) => { if (el) prot[k] = txt ? textRect(el) : rect(el); };
  p('h1', document.querySelector('.hero-h'), true);
  p('lede', document.querySelector('.hero .lede'), true);
  p('chapterno', document.querySelector('.hero .chapter-no'), true);
  [...document.querySelectorAll('.hero .actions .btn, .hero .actions .story-cue')].forEach((b,i)=>{prot['cta'+i]=rect(b);});
  p('film', document.getElementById('film'));
  p('shelf', document.getElementById('shelf'));
  p('hint', document.querySelector('.hero .scroll-hint'));
  const hero = rect(document.getElementById('ch1'));
  const de = document.documentElement;
  return {items, prot, hero, vw: innerWidth, vh: innerHeight,
          overflow: de.scrollWidth - de.clientWidth,
          vids: [...document.querySelectorAll('.filmwin .clip')].map(v=>({
            n: v.dataset.clip.split('/').pop(), paused: v.paused,
            top: Math.round(v.getBoundingClientRect().top),
            inFold: v.getBoundingClientRect().top < innerHeight && v.getBoundingClientRect().bottom > 0}))};
}"""

def ov(a, b):
    dx = min(a['x2'], b['x2']) - max(a['x'], b['x'])
    dy = min(a['y2'], b['y2']) - max(a['y'], b['y'])
    return (dx, dy) if dx > 0 and dy > 0 else None

views = [(1280, 800), (1440, 900), (1728, 1080), (1920, 1080), (2560, 1440), (1366, 768)]
with sync_playwright() as p:
    b = p.chromium.launch(args=["--autoplay-policy=no-user-gesture-required"])
    for w, h in views:
        pg = b.new_page(viewport={"width": w, "height": h})
        pg.goto(URL); pg.wait_for_timeout(2200)
        d = pg.evaluate(JS)
        print(f"\n===== {w}x{h}  hero h={d['hero']['h']} overflowX={d['overflow']}")
        print("videos playing in fold:", sum(1 for v in d['vids'] if not v['paused'] and v['inFold']),
              "| all:", [(v['n'], 'play' if not v['paused'] else 'PAUSED', v['top']) for v in d['vids']])
        bad = []
        for it in d['items']:
            for k, pr in d['prot'].items():
                o = ov(it, pr)
                if o: bad.append((it['name'], k, o, it['x'], it['y']))
        # item-item overlaps > 8px in both axes
        soft = []
        for i, a in enumerate(d['items']):
            for bb in d['items'][i+1:]:
                o = ov(a, bb)
                if o and min(o) > 8: soft.append((a['name'], bb['name'], o))
        # out of bounds
        oob = [(it['name'], it['x'], it['x2'], it['y2']) for it in d['items']
               if it['x'] < -4 or it['x2'] > w + 4 or it['y2'] > d['hero']['h'] + 4 or it['y'] < 56]
        print("PROTECTED OVERLAPS:", json.dumps(bad, indent=0) if bad else "none")
        print("ITEM OVERLAPS>8:", soft if soft else "none")
        print("OUT OF BOUNDS:", oob if oob else "none")
        if "-v" in sys.argv:
            for it in d['items']: print(" ", it['name'], it['x'], it['y'], it['x2'], it['y2'])
        pg.close()
    b.close()
