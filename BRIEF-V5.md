# SERAYAE V5 — The Creative Leap ("we are at 10% of Clicky. Get to 100%.")

Founder verdict on the current site: not even 10% of heyclicky.com's creative design, graphics, and color. He is right about what's missing: Clicky is DENSE with real media — photos, videos, stickers, a central film. SERAYAE has zero photographic imagery and one video (unused). This pass closes that gap while keeping the brand laws.

Evolve /home/user/workspace/serayae-site (git repo). Read /home/user/workspace/heyclicky-inventory.md for the reference's device density. Palette laws unchanged (Night/Ivory/Ink/Ember, red = Ch3 freeze only; never pure black/white) — but USE the palette at full richness: deep ember glows, warm gradients in the night, ivory paper, warm photographic light. The site should feel like a night full of warm lights, not an empty dark page.

## 1. THE FILM — central hero video (≙ Clicky's hello.mov)
The real 60s launch film is at media/launch-video.mp4 (1920×1080, 2.3MB, has audio; poster at media/launch-video-poster.jpg).
- Place a LARGE central video window in the hero below the headline/CTA (like Clicky's hello.mov player): SERAYAE window chrome (three lights, middle ember), mono caption `built-for-each-other.mp4 · 60s`. Muted autoplaying loop of the film inside the window (playsinline, preload=metadata, poster), with a prominent ember play button — clicking opens a full-bleed lightbox playing WITH sound from 0:00, Esc/scrim closes. On mobile: the window is full-width, tap opens the lightbox.
- Restore the secondary hero CTA `Watch the Story` → opens the lightbox. (It was removed when no film existed. The film exists now.)
- Reduced motion: static poster, click still opens lightbox.

## 2. PHOTOGRAPHIC LAYER — generate real cinematic imagery (≙ Clicky's photos/GIFs)
Generate 8-10 cinematic images (use the image generation tooling generously) in ONE consistent art direction: warm ember/amber light sources in deep warm darkness, filmic grain, anonymous human presence, no faces in close-up, no text in images. Subjects:
1. A single lit lantern in a vast dark desert night (the founding image).
2. One lit window in a dark street at night.
3. A hand holding a phone, screen glow warming the dark.
4. A figure walking home at night, distant warm light ahead.
5. Two hands reaching toward each other, warm rim light.
6. A silhouette approaching through darkness carrying a light.
7. A doorway with warm light spilling out into the night.
8. A small tea glass / ember coals still life (Egyptian warmth).
9. (extra) A city skyline at night, one building lit warm.
10. (extra) A candle passed between two hands.
Use them as:
- Tilted PHOTO CARDS (instant-photo style: ivory border, mono ink caption like `the first light`, `someone came`, `walk home`, slight rotation, real shadow) scattered through the hero field strip and chapters 2, 5, 6, 7 — draggable on desktop like the signal windows.
- Large atmospheric bleed images: one as a full-width cinematic band between Ch4 (ivory) and Ch5 with the copy over it; one behind the waitlist finale (dark, low opacity, the lantern image).
- Compress properly: max 1600px wide, q~80 JPEG, lazy-load below the fold. Total added weight budget ≤2.5MB for all images.

## 3. COLOR & GRAPHIC RICHNESS
- Deepen the night with warm ember ambience: large soft radial glows anchored to content moments (hero light, network calls, waitlist halo) — richer and more confident than now, while text stays AA.
- The ivory Ch4 document chapter stays; add an ivory paper texture (subtle) and a wax-seal-like ember dot mark at the bottom of the ledger (the "founding document" signature).
- Chapter 6 product rows: give each row a small live glyph animation on the left (SOS pulse ring, guardian eye, responder arrow closing distance, verification check drawing, movement trace, ledger row writing, workflow steps lighting) — tiny, mono-colored, meaningful.
- Voices grid cards get subtle warm header tints cycling (ink → ink-warm → ember-dim at low alpha).
- The morse strip and mosaic get an ember shimmer pass (a light that travels through them periodically).

## 4. DENSITY PASS (≙ Clicky's clutter-with-purpose)
- Hero field: with the video window central, re-scatter: 4 signal windows + 2 photo cards + 2 field notes + the 2 easter-egg chips around it (desktop). Mobile: video window + horizontal strip (existing pattern) now including 2 photo cards.
- Add 2-3 tiny ambient artifacts in later chapters (a drifting ember spark near the network, a small `signal strength` meter in Ch3 that dies at the freeze, a `distance: closing` ticker in Ch6).

## 5. QA + deploy
Playwright at 1280 and 390: hero with video, lightbox open/close (sound only after user click — no autoplay-with-audio violations), photo cards render + drag, big-bleed images load lazily, total transfer size of first load reported (target <4.5MB including video preload=metadata), no overflow, reduced-motion path, Ch3 freeze still absolute. Commit milestones. Move BRIEF-V5.md out of the project dir to /home/user/workspace/ before deploying. Then deploy_website project_path=/home/user/workspace/serayae-site, site_name "SERAYAE — Built For Each Other", entry_point index.html. Return summary + what was generated.