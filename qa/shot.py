import sys, json, pathlib
from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent
URL = "file://" + str(ROOT / "index.html")
OUT = ROOT / "qa"
OUT.mkdir(exist_ok=True)

tag = sys.argv[1] if len(sys.argv) > 1 else "base"

VIEWS = [("desk", 1280, 800), ("desk-tall", 1440, 900), ("mob", 390, 844)]

with sync_playwright() as p:
    b = p.chromium.launch(args=["--autoplay-policy=no-user-gesture-required"])
    for name, w, h in VIEWS:
        pg = b.new_page(viewport={"width": w, "height": h})
        pg.goto(URL)
        pg.wait_for_timeout(2500)
        pg.screenshot(path=str(OUT / f"{tag}-{name}.png"))
        info = pg.evaluate("""() => {
          const vids = [...document.querySelectorAll('#field video')].map(v => ({
            src: v.currentSrc.split('/').pop(), paused: v.paused, rt: v.readyState,
            w: Math.round(v.getBoundingClientRect().width),
            top: Math.round(v.getBoundingClientRect().top)
          }));
          const de = document.documentElement;
          return {
            vids,
            playing: vids.filter(v=>!v.paused).length,
            overflowX: de.scrollWidth > de.clientWidth ? de.scrollWidth : 0,
            heroH: document.getElementById('ch1').getBoundingClientRect().height,
            artifacts: document.querySelectorAll('#field > *').length
          };
        }""")
        print(name, json.dumps(info, indent=1)[:1600])
        pg.close()
    b.close()
