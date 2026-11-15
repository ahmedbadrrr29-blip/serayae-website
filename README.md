<p align="center">
  <a href="https://serayae.me">
    <img src="logo-mark.svg" width="72" alt="Serayae" />
  </a>
</p>

<h1 align="center">Serayae — Built For Each Other.</h1>

<p align="center">
  <a href="https://serayae.me"><strong>serayae.me</strong></a> · Chronic-Health Companion & Family Safety Network
</p>

---

This repository hosts the public story site, waitlist, store legal disclosures, and public tokenized tracking/invite pages live at **[serayae.me](https://serayae.me)**.

## Stack & Responsibilities

- **Static Site**: Hand-written HTML/CSS/JS, zero framework build step, native scroll.
- **Hosting**: GitHub Pages behind Cloudflare (DNS, HTTPS, edge caching).
- **Waitlist**: [Supabase](https://supabase.com) (waitlist table only — **note**: all mobile app & health catalog data lives in `serayae-backend` Prisma/PostgreSQL on Heroku per `ADR-0006`, never in Supabase) + [Resend](https://resend.com).
- **Tokenized Public Routes**:
  - `track/`: Zero-login 24-hour revocable live tracking page for active SOS and Go Safely sessions (`POST /api/guardian/link` on `serayae-backend`).
  - `invite/`: Family Circle & Guardian invitation landing page.
- **Store & Legal Pages**:
  - `privacy.html`: Privacy Policy (including GDPR Art. 9 special-category health data disclosures).
  - `terms.html`: Terms of Service.
  - `delete-account.html`: Store-mandated account and data deletion instructions.

## Structure

```text
index.html          Public story + founder letter + waitlist
privacy.html        Privacy policy
terms.html          Terms of service
delete-account.html Account deletion (App Store & Google Play requirement)
invite/             Guardian & Circle invitation landing page
track/              Zero-login 24h revocable live tracking page
404.html            Not-found page
css/ js/ media/     Styles, scripts & real media assets
```

## Developer Onboarding

Use Node 22 for repository checks:

```sh
npm ci
npm run check:api-origin
python3 -m http.server 8080
```

## Repository Map

- **[Serayae-app](https://github.com/ahmedbadrrr29-blip/Serayae-app)**: Primary iOS & Android mobile app (Expo SDK 54, React Native 0.81.5 — `Home`, `Care`, `Protect`, `Circle`).
- **[serayae-backend](https://github.com/ahmedbadrrr29-blip/serayae-backend)**: Primary API, Prisma/PostgreSQL database, health catalog, and SOS dispatch outbox on Heroku (`serayae-api`).
- **[serayae-admin](https://github.com/ahmedbadrrr29-blip/serayae-admin)**: Internal operations & identity verification console on Heroku (`serayae-admin`).
- **[serayae-api-docs](https://github.com/ahmedbadrrr29-blip/serayae-api-docs)**: Partner `/v1` API documentation (`api-docs.serayae.me`).
- **[serayae-guardian](https://github.com/ahmedbadrrr29-blip/serayae-guardian)**: *Deprecated standalone guardian web portal* (superseded by in-app Circle & `serayae.me/track/` tokenized links).

© 2026 Serayae · [team@serayae.me](mailto:team@serayae.me)
