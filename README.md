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

© 2026 SERAYAE · [team@serayae.me](mailto:team@serayae.me)
