<p align="center">
  <a href="https://serayae.me">
    <img src="logo-mark.svg" width="72" alt="SERAYAE" />
  </a>
</p>

<h1 align="center">SERAYAE — Built For Each Other.</h1>

<p align="center">
  <a href="https://serayae.me"><strong>serayae.me</strong></a> · Human Response Infrastructure
</p>

---

For thousands of years, a light in the distance meant one thing: **someone was there.**

Every safety app promises the same things — alert sent, location shared, contacts notified. Everything works, except the part that matters: nobody knows if someone is actually coming. SERAYAE is the infrastructure for that missing part — the human response.

This repository is the public story site and waitlist, live at [serayae.me](https://serayae.me).

## Stack

- **Static site** — hand-written HTML/CSS/JS, no framework, no build step. Native scroll only.
- **Hosting** — GitHub Pages behind Cloudflare (DNS, HTTPS, edge cache, privacy-first analytics)
- **Waitlist** — [Supabase](https://supabase.com) (Postgres, believer numbering) + [Resend](https://resend.com) (welcome emails via database trigger)
- **Type** — Boska (display) · Satoshi (body) · JetBrains Mono (console)
- **Palette** — Night `#0E0C0A` · Ivory `#F5F2EC` · Ink `#1D242E` · Ember `#BD3103`

## Principles

- Every photo and clip is real footage — zero AI-generated imagery
- Ember is never decorative: it marks the words and moments that matter
- No parallax, no scroll-jacking, no per-frame JavaScript
- Global from day one: visitor-local clock, international emergency numbers, GDPR/UK GDPR-aware privacy

## Structure

```
index.html          the story (7 chapters + founder letter + waitlist)
privacy.html        privacy policy
terms.html          terms of service
delete-account.html account deletion (store requirement)
404.html            the lantern page
css/ js/ media/     styles, behavior, real footage & photos
```

## Developer onboarding

Use Node 22 for repository checks. There is no application build step: HTML, CSS and JavaScript are published as static files.

```sh
npm ci
npm run check:api-origin
python3 -m http.server 8080
```

Open http://localhost:8080. The invite/track pages contain the production API origin; do not redeem real invitations, submit forms or exercise emergency links during local review. Use synthetic data and an isolated test backend for end-to-end testing.

## Repository map

- [Mobile](https://github.com/ahmedbadrrr29-blip/Serayae-app): installed application and store releases.
- [Backend](https://github.com/ahmedbadrrr29-blip/serayae-backend): API, authorization, records and notification delivery.
- [Admin](https://github.com/ahmedbadrrr29-blip/serayae-admin): internal operations.
- [Guardian](https://github.com/ahmedbadrrr29-blip/serayae-guardian): authorized guardian portal.
- [API docs](https://github.com/ahmedbadrrr29-blip/serayae-api-docs): partner documentation.

The website's waitlist integration is separate from backend support tickets and SOS delivery. Verify each provider separately; a healthy web page does not establish email or emergency delivery.

## Sensitive pages and release checks

- invite/ and track/: guardian invitation and tokenized tracking flows. Never add user-controlled API-host overrides; tracking tokens must not be redirected to an arbitrary host.
- privacy.html, terms.html and delete-account.html: store-facing disclosures. Keep them aligned with the actual retention, deletion, permissions and provider behavior. Do not claim a legal review merely because these pages exist.
- .github/scripts/check-api-origin.js: parser-based API-host consistency guard.

PRs target main. Before release check API-origin validation, mobile layout, English/Arabic content where provided, deep links, deletion/support links and live deployment status. Use synthetic screenshots, not personal phone numbers or real incidents. Confirm GitHub Pages and Cloudflare deployment/cache settings before claiming a change is live.

Consumer subscriptions are Free/Plus; paid sales remain gated until native billing tests pass. Do not restore old Basic/Shield/Family sales copy, insurance benefits, guaranteed response, or claims of offline delivery unsupported by the actual product.

© 2026 SERAYAE · [team@serayae.me](mailto:team@serayae.me)
