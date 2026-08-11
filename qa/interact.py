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

    # shelf: lantern (day theme toggle)
    day0 = pg.evaluate("document.body.classList.contains('day') || document.querySelector('.hero').classList.contains('day')")
    pg.click("#shelfLantern")
    pg.wait_for_timeout(700)
    day1 = pg.evaluate("document.body.classList.contains('day') || document.querySelector('.hero').classList.contains('day')")
    print("shelf lantern      :", ok(day0 != day1), day0, "->", day1)
    pg.click("#shelfLantern")
    pg.wait_for_timeout(500)

    def modal_open():
        return pg.evaluate(
            "[...document.querySelectorAll('.modal,[role=dialog],.ops-pop')].some(m=>m.classList.contains('open')||m.getAttribute('aria-hidden')==='false'||getComputedStyle(m).display!=='none'&&getComputedStyle(m).visibility!=='hidden'&&m.getBoundingClientRect().height>40)"
        )

    for name, sel in [("ledger", "#shelfLedger"), ("signal", "#shelfSignal"), ("radio", "#shelfRadio")]:
        pg.keyboard.press("Escape")
        pg.wait_for_timeout(300)
        before = modal_open()
        pg.click(sel)
        pg.wait_for_timeout(800)
        print(f"shelf {name:<12}:", ok(modal_open() and not before), "modal open =", modal_open())
    pg.keyboard.press("Escape")
    pg.wait_for_timeout(400)

    pg.click("#shelfEnvelope")
    pg.wait_for_timeout(1400)
    print("shelf envelope     :", ok(pg.evaluate("(()=>{const w=document.querySelector('#waitlist');const r=w.getBoundingClientRect();return r.top<window.innerHeight*0.8 && r.bottom>0})()")))

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
        print(f"mobile {sel:<12}:", ok(pg.evaluate("[...document.querySelectorAll('.modal,[role=dialog]')].some(m=>m.getBoundingClientRect().height>40&&getComputedStyle(m).visibility!=='hidden')")))
    pg.keyboard.press("Escape")
    pg.wait_for_timeout(300)
    pg.evaluate("window.scrollTo(0, document.body.scrollHeight)")
    pg.wait_for_timeout(1500)
    print("mobile offscreen   :", ok(pg.evaluate("[...document.querySelectorAll('.filmwin .clip')].every(v=>v.paused)")))
    pg.close()
    br.close()
