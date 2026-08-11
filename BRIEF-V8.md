# SERAYAE V8 — The Living Fold ("OOHHH" pass)

Founder's bar: match/exceed heyclicky.com's hero (screenshot analysis: ~18 artifacts around the fold, SIX windows playing REAL footage of people, three window formats incl. phone-vertical, name tags, kaomoji, system icons, dock peeking at bottom). Our current dawn hero is beautiful but quiet. This pass makes the fold ALIVE.

Evolve /home/user/workspace/serayae-site (git repo; ivory dawn ground with night chapters 3/5/7; native scroll — keep it that way, NO per-frame JS, NO Lenis).

## New assets (ready, compressed)
media/clips/ — six muted 4s film loops (360KB total, h264, faststart):
- walkhome.mp4 (vertical 480h) — woman walking home, warm night street, glances back smiling
- door.mp4 (vertical 480h) — door opens, warm light spills, welcoming silhouette
- lantern.mp4 (520w) — hands strike a match, light a lantern, glow blooms
- responder.mp4 (520w) — man jogging through night street toward camera
- tea.mp4 (520w) — tea poured into gold-rimmed glass, steam, lantern light
- cat.mp4 (520w) — windowsill cat perks up alertly, rim-lit
media/stickers/ — transparent PNGs: stamp.png (vintage lantern postage stamp), moon.png (ink crescent doodle), cassette.png (retro orange cassette).

## The rebuilt hero field (desktop ≥1080px)
Replace the current scattered layout with a DENSE Clicky-grade composition (~16 artifacts) around the centered headline+CTA+film player. All draggable items keep drag. Zero overlap with headline/CTA/film controls; artifacts may slightly overlap EACH OTHER (2-4px) like a real desk.
1. SIX live film windows in SERAYAE console chrome (three lights, middle ember) with mono captions beneath, mixed formats: walkhome.mp4 vertical window (like Clicky's phone windows) captioned `she-made-it-home.mov`; door.mp4 vertical `the-door-opens.mov`; lantern.mp4 landscape `first-light.mov`; responder.mp4 landscape `on-his-way.mov`; tea.mp4 small landscape `for-the-guest.mov`; cat.mp4 small landscape `guard-duty.mov`. Muted, autoplay, loop, playsinline, preload=metadata; pause when offscreen via ONE IntersectionObserver.
2. Existing signal windows: keep only responder.trace and guardian-link.log (the live films replace the rest — move sos waveform + ledger.rec pane down into Chapter 6 as side artifacts).
3. Field notes (2, incl. Arabic) + morse strip stay.
4. Photo cards: keep 2 in hero (hands, cat polaroids), rest stay in chapters.
5. Stickers layer: stamp.png (rotated ~6°), moon.png (small, near headline top-right like their kaomoji), cassette.png near the ops bar radio side (clicking it opens the night-radio widget — wire to radioBtn click). Draggable like notes.
6. Easter-egg chips (founding-signal, first-response) stay.
7. THE SHELF (≙ Clicky's dock peeking at the bottom edge of the viewport): a thin warm-ivory shelf strip fixed to the very bottom of the HERO section only (absolute, not viewport-fixed), holding 5 small object icons with tooltip labels: lantern (click = warm ripple, reuse ops lantern behavior), ledger (opens first-response.rec), signal (opens founding-signal.txt), cassette (opens radio), envelope (scrolls to waitlist). Slight rise + glow on hover. On mobile the shelf becomes a 5-icon row under the hero strip.

## Mobile (<1080px)
Hero strip pattern stays but now leads with TWO live film windows (walkhome vertical + lantern) then notes/photos/chips in the horizontal scroll-snap strip. Shelf = compact icon row. Total added transfer mobile-first load must stay < 1MB (clips are ~60KB each — fine).

## Rules
Palette/CTA/ember/red laws unchanged. Captions mono ink on ivory. No memes. Keep performance: only the single IntersectionObserver; no scroll-linked JS. prefers-reduced-motion: films show first frame (autoplay off) with a static poster look.

## QA + deploy
Playwright 1280+390: fold screenshot must show ≥12 distinct artifacts with 6 playing videos (verify .paused === false on ≥4 in view); drag works on films/stickers; shelf icons all fire their actions; no overlap with headline/CTAs; no overflow; videos pause offscreen; reduced-motion static. Bump ?v=10 → ?v=11. Commit milestones. Move BRIEF-V8.md out of project dir. deploy_website project_path=/home/user/workspace/serayae-site site_name "SERAYAE — Built For Each Other" entry_point index.html.
