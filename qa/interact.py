"""Behavioural QA for the V8 living fold: drag, shelf actions, offscreen pausing,
reduced-motion stillness. Run: python3 qa/interact.py"""
from playwright.sync_api import sync_playwright

URL = "file:///home/user/workspace/serayae-site/index.html"
ARGS = ["--autoplay-policy=no-user-gesture-required"]
ok = lambda c: "PASS" if c else "FAIL"


def drag(pg, sel, dx, dy):
    b = pg.locator(sel).first.bounding_box()
    pg.mouse.move(b["x"] + b["width"] / 2, b["y"] + 8)
    pg.mouse.down()
    for i in range(1, 6):
        pg.mouse.move(b["x"] + b["width"] / 2 + dx * i / 5, b["y"] + 8 + dy * i / 5)
        pg.wait_for_timeout(20)
    pg.mouse.up()
    pg.wait_for_timeout(120)
    return b, pg.locator(sel).first.bounding_box()


with sync_playwright() as p:
    br = p.chromium.launch(args=ARGS)

    # ── desktop ──
    pg = br.new_page(viewport={"width": 1440, "height": 900})
    pg.goto(URL)
    pg.wait_for_timeout(2500)

    a, b = drag(pg, ".filmwin", -120, 60)
    print("drag film window   :", ok(abs(b["x"] - a["x"]) > 60 and abs(b["y"] - a["y"]) > 20), a["x"], "->", b["x"])
    a, b = drag(pg, ".sticker-moon", 90, -40)
    print("drag sticker       :", ok(abs(b["x"] - a["x"]) > 40), a["x"], "->", b["x"])
    a, b = drag(pg, ".note", 60, 70)
    print("drag note          :", ok(abs(b["y"] - a["y"]) > 30), a["y"], "->", b["y"])

    # ── shelf: five real actions, each checked against its own target state ──
    pg.evaluate("document.body.classList.remove('warmed')")
    pg.click("#shelfLantern"); pg.wait_for_timeout(400)
    print("shelf lantern      :", ok(pg.evaluate("document.body.classList.contains('warmed')")), "body.warmed")

    pg.click("#shelfLedger"); pg.wait_for_timeout(500)
    print("shelf ledger       :", ok(pg.evaluate("!document.getElementById('modalResponse').hidden")), "#modalResponse open")
    pg.keyboard.press("Escape"); pg.wait_for_timeout(400)
    print("  escape closes it :", ok(pg.evaluate("document.getElementById('modalResponse').hidden")))

    pg.click("#shelfSignal"); pg.wait_for_timeout(700)
    print("shelf signal       :", ok(pg.evaluate("!document.getElementById('modalFounding').hidden")),
          "#modalFounding open, typing", pg.evaluate("document.getElementById('foundingType').textContent.length"), "chars")
    pg.keyboard.press("Escape"); pg.wait_for_timeout(400)

    pg.click("#shelfRadio"); pg.wait_for_timeout(700)
    print("shelf radio        :", ok(pg.evaluate("!document.getElementById('radioWidget').hidden")), "#radioWidget open")
    pg.click("#cassetteSticker"); pg.wait_for_timeout(500)
    print("cassette sticker   :", ok(pg.evaluate("!document.getElementById('radioWidget').hidden")), "radio stays open")
    pg.click("#radioBtn"); pg.wait_for_timeout(300)

    pg.evaluate("window.scrollTo(0,0)"); pg.wait_for_timeout(500)
    pg.click("#shelfEnvelope"); pg.wait_for_timeout(2200)
    print("shelf envelope     :", ok(pg.evaluate("(()=>{const r=document.getElementById('waitlist').getBoundingClientRect();return r.top<window.innerHeight&&r.bottom>0})()")),
          "waitlist in view, focus", pg.evaluate("document.activeElement.tagName"))

    # offscreen pausing
    pg.evaluate("window.scrollTo(0,0)")
    pg.wait_for_timeout(1200)
    top = pg.evaluate("[...document.querySelectorAll('.filmwin .clip')].filter(v=>!v.paused).length")
    pg.evaluate("window.scrollTo(0, document.body.scrollHeight)")
    pg.wait_for_timeout(1600)
    bot = pg.evaluate("[...document.querySelectorAll('.filmwin .clip')].filter(v=>!v.paused).length")
    print("clips playing top  :", top, "| after scrolling away:", bot, "->", ok(top >= 4 and bot == 0))
    pg.close()

    # ── reduced motion ──
    pg = br.new_page(viewport={"width": 1440, "height": 900}, reduced_motion="reduce")
    pg.goto(URL)
    pg.wait_for_timeout(2500)
    st = pg.evaluate("[...document.querySelectorAll('.filmwin .clip')].map(v=>[v.paused,+v.currentTime.toFixed(2)])")
    print("reduced motion     :", ok(all(s[0] for s in st)), st[:3])
    a, b = drag(pg, ".filmwin", -100, 40)
    print("reduced no-drag    :", ok(abs(b["x"] - a["x"]) < 4))
    pg.close()

    # ── mobile ──
    pg = br.new_page(viewport={"width": 390, "height": 844}, is_mobile=True, has_touch=True, device_scale_factor=2)
    pg.goto(URL)
    pg.wait_for_timeout(2500)
    print("mobile overflowX   :", ok(pg.evaluate("document.documentElement.scrollWidth<=390")), pg.evaluate("document.documentElement.scrollWidth"))
    print("mobile strip clips :", pg.evaluate("[...document.querySelectorAll('.filmwin')].filter(f=>getComputedStyle(f).display!=='none').length"), "visible")
    pg.evaluate("document.querySelector('#field').scrollLeft = 400")
    pg.wait_for_timeout(400)
    print("mobile strip scroll:", ok(pg.evaluate("document.querySelector('#field').scrollLeft > 100")))
    for sel in ["#shelfLedger", "#shelfRadio"]:
        pg.keyboard.press("Escape")
        pg.wait_for_timeout(250)
        pg.locator(sel).scroll_into_view_if_needed()
        pg.locator(sel).tap()
        pg.wait_for_timeout(700)
        target = "modalResponse" if sel == "#shelfLedger" else "radioWidget"
        print(f"mobile {sel:<12}:", ok(pg.evaluate(f"!document.getElementById('{target}').hidden")), target, "open")
    pg.keyboard.press("Escape")
    pg.wait_for_timeout(300)
    pg.evaluate("window.scrollTo(0, document.body.scrollHeight)")
    pg.wait_for_timeout(1500)
    print("mobile offscreen   :", ok(pg.evaluate("[...document.querySelectorAll('.filmwin .clip')].every(v=>v.paused)")))
    pg.close()
    br.close()
