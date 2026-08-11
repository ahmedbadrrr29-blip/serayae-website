# SERAYAE V7 — The Dawn Flip

Founder decision: make the site LIGHTER. Flip to an Ivory-first ground (like heyclicky's light ground where density/humor/photography pop), with Night reserved for the emotional core so darkness regains its power. This is a tonal restructure of /home/user/workspace/serayae-site (git repo) — NOT a rebuild. Keep all content, chapters, copy, artifacts, features, film, radio, waitlist, legal pages.

## New tonal structure (hard cuts between grounds, like the current ch4 paper flip)
- Chapter 01 The Promise — IVORY ground (#F5F2EC), Ink text (#1D242E). Hero headline in Ink. The one ember light and ember CTA pop hard on ivory.
- Chapter 02 The Roads Changed — IVORY. Road lines/nodes become ink-toned on ivory (dark lines on paper — like a hand-drawn map coming alive; still no literal map).
- Chapter 03 The Gap — NIGHT (#0E0C0A). The page DROPS into darkness at the emotional center. Freeze + the only red stays exactly as is. This drop is the new dramatic device.
- Chapter 04 The Category — IVORY paper document (already built; now blends with the ground — give it a subtle ink top/bottom hairline frame to keep its document identity).
- Chapter 05 The Network — NIGHT. Canvas keeps its dark world.
- Chapter 06 The Product — IVORY. Product rows in ink; row glyphs ink+ember.
- Chapter 07 Built For Each Other + waitlist + footer — NIGHT warming to the warm-dark finale (keep existing warmth arc from ch5 through end; it now starts at the ch5 night drop).

## Element translations for ivory sections
- Ops bar: default = the existing `.nav.daylight` styles (ivory bar, ink icons/links, ember CTA). Over NIGHT chapters it flips to the current dark bar (invert the existing ScrollTrigger logic that today handles only ch4; now trigger dark-mode over ch3, ch5, ch7→footer).
- Signal windows/console panes: KEEP Ink-dark panes — dark windows on ivory ground is exactly Clicky's contrast (their dark video windows on light grey). Their inner content stays as is.
- Field notes: on ivory ground give notes a slightly warmer paper tone + stronger shadow so they read as physical objects.
- Photo cards: ivory-border polaroids need a visible soft shadow + 1px ink-10 border to separate from the ivory ground.
- Hero dot-grid: add Clicky's wallpaper device — radial-gradient ink dots (rgba(29,36,46,0.13) 1px, 26px grid) on ivory sections only (pure CSS background on those sections; zero scroll cost — NO Lenis, NO parallax, native scroll only. Performance was rejected before; add NOTHING that runs per-scroll-frame beyond existing GSAP triggers).
- Grain overlay: keep but reduce opacity on ivory (ink-tinted grain at very low alpha).
- Ember rules unchanged: ember = response/CTA/the light; red = ch3 freeze only. Ivory sections use Ink for structure, never grey-blue.
- The persistent ember-light element: on ivory it reads as a warm glowing dot with soft bloom — verify visibility on light ground (add slight warm halo ring if needed).
- Voices grid (between ch6 ivory and ch7 night): move to NIGHT side styling as the entry into the finale, or keep on ivory — builder's call by eye, but the transition must be a clean hard cut.
- Typography colors: all existing ivory-XX text tokens need ivory-section equivalents (ink at matching alphas). Suggest CSS approach: add `.day` class to ivory sections and scope overrides, reusing the ledger-ch pattern already in style.css.

## Transitions between grounds
Hard cuts at section boundaries (no gradients). At each NIGHT entry, first visible element should re-anchor the eye: ch3's night begins with the dispatch console; ch5's with the network copy; ch7's with the mark.

## What must not change
Copy, chapter order, CTA whitelist, s_ logo + ch7 join animation, film player, YouTube radio, SOS easter egg, modals, draggables, Supabase waitlist, legal pages (already ivory — they now match the site), performance (native scroll, no new per-frame work), reduced-motion paths, mobile behavior patterns.

## QA
Playwright at 1280 and 390: every chapter boundary (screenshot each ivory→night and night→ivory cut), ops bar flipping correctly at every boundary in BOTH scroll directions, hero on ivory with dot-grid + dark windows + polaroids, ch3 freeze intact in night, contrast AA for ink-on-ivory text tones, no horizontal overflow, cache-busted assets (bump ?v=9 to ?v=10). Fix all issues. Commit milestones. Move BRIEF-V7.md out of the project dir before deploying. Then deploy_website project_path=/home/user/workspace/serayae-site, site_name "SERAYAE — Built For Each Other", entry_point index.html.
