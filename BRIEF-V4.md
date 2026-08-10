# SERAYAE V4 — Pre-Launch Pass (mobile overhaul + launch punch list)

Evolve /home/user/workspace/serayae-site (git repo). Existing identity/palette/chapter laws unchanged (see serayae-BRIEF.md in workspace root if needed). Six workstreams:

## 1. MOBILE OVERHAUL (founder tested on a real phone — screenshot showed breakage)
Observed bugs at ~390px:
- The hero ember CTA scrolls UNDER the fixed ops bar and collides with the nav CTA (two "REQUEST EARLY ACCESS" stacked, ember band bleeding behind the bar). The nav scrim doesn't cover the ember button passing beneath. Fix properly: on mobile the ops bar must be a solid Night bar (opaque, with bottom hairline border ivory-10), not a gradient scrim — no content ever visibly collides with it.
- Mobile hero is far too long: headline → subhead → 2 large full-width CTAs → 3 signal windows stacked full-width → 2 field notes → 2 easter-egg artifact icons → SCROLL hint ≈ 3 screens before the story starts. Restructure mobile hero to ONE strong screen: headline, subhead, single primary CTA (Request Early Access full-width ember) with small text link below it for early-access anchor; then a SINGLE compact "console strip" — a horizontally scrollable row (scroll-snap, no drag) of 3 mini signal windows (sos, guardian-link, heartbeat) at ~200px wide each with the field notes as 2 small cards at the end of the same row. Artifact icons (founding-signal, first-response) move into that row as small tappable chips that open their modals. SCROLL indicator directly under the strip, within the first 1.5 screens.
- A stray lone dot appears bottom-left above the fold on mobile (likely the ember-light or a mosaic dot mis-positioned) — find and fix.
- Buttons on mobile: nav CTA smaller (11px, tighter padding); make sure the nav never wraps to 2 rows.
- Audit EVERY chapter at 375 and 390 widths after changes.

## 2. REAL WAITLIST (Supabase) + believer number
Replace the client-only waitlist logic in js/main.js with a real call:
- Endpoint: POST https://zxrnboyqvfefkclsurrb.supabase.co/rest/v1/rpc/serayae_join_waitlist
- Headers: apikey + Authorization: Bearer sb_publishable_hGiNsEyzM1SNER7gq99WbQ_2VIHAMg6 ; Content-Type: application/json
- Body: {"p_email": "<email>"} → returns a plain integer = believer position (idempotent for repeat emails).
- Success state becomes an induction: "You're in. Early believer #N." + line "When the light answers, you'll be the first to know." Style #N in mono, ember. Keep localStorage/memory cache of {email, n} to re-show state.
- Failure (network/4xx): honest error in the form's voice: "The signal didn't go through. Try again." — form stays usable. Timeout 8s.
- Loading state on submit button (dot pulses, label "Sending signal…"). Keep CTA whitelist otherwise.
- Add beneath form: "We store your email to send launch updates. Nothing else." (small, ivory-45).

## 3. SOCIAL PREVIEW LAYER
- Generate /home/user/workspace/serayae-site/og-image.png 1200×630: Night #0E0C0A ground with subtle warm ember glow bottom-right, the official s_ mark (use logo-mark.svg geometry, ivory) top-left area at ~180px wide, display-type "Built For Each Other." large in ivory (use the site's display font rendered via Playwright screenshot of a small HTML file — most reliable), small mono "SERAYAE · HUMAN RESPONSE INFRASTRUCTURE" caption. Check it looks right by reading the PNG.
- Full head meta: title "SERAYAE — Built For Each Other.", meta description ("For thousands of years, a light in the distance meant one thing: someone was there. SERAYAE is building Human Response Infrastructure."), og:title/og:description/og:image (og-image.png relative-safe: use absolute-from-root path /og-image.png), og:type website, twitter:card summary_large_image, twitter:title/description/image, theme-color #0E0C0A. Note in report: og:image URL must be swapped to the final domain absolute URL at launch.

## 4. CUT "WATCH THE STORY"
Remove the secondary hero CTA entirely (desktop + mobile). The scroll is the story. Rebalance hero action row (primary CTA + nothing, or primary + quiet "↓ The story" scroll cue text only, not a button).

## 5. PERFORMANCE
- Preload the two font files actually used above the fold (or the CSS if from a font CDN, use <link rel="preconnect"> + font-display: swap verification).
- defer all non-critical JS; GSAP CDN with defer; ensure canvas init stays lazy (IntersectionObserver).
- Lighthouse-style sanity: run Playwright with CPU/network throttling if available, else just verify no render-blocking beyond CSS and that DOMContentLoaded < ~1.5s locally, report findings.

## 6. ACCESSIBILITY
- Focus trap inside both modals (Tab cycles within, Esc closes, focus returns to opener).
- Decorative mono window captions + morse strip: aria-hidden="true".
- Verify form input has a visible label or aria-label; error uses role=alert (exists); believer confirmation gets aria-live=polite.
- Keyboard-only pass: every interactive element reachable and visibly focused (ember outline).

## QA + deploy
Playwright QA at 390×844 AND 375×667 AND 1280×800: every chapter + waitlist success state (mock the fetch in the QA run OR use test+qa@serayae.dev then note it; better: intercept via page.route to fake the RPC so no junk rows). Screenshots to /home/user/workspace/serayae-v4-qa/. Verify: no nav collisions at any scroll position on mobile (screenshot mid-scroll positions), hero fits ~1.2 screens on mobile, modals focus-trap, form loading/success/error states. Commit milestones. Do NOT ship BRIEF-V4.md: move it to /home/user/workspace/serayae-BRIEF-V4.md before deploying. Then deploy_website project_path=/home/user/workspace/serayae-site site_name "SERAYAE — Built For Each Other" entry_point index.html.
