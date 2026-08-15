# Deep-link association files

- `apple-app-site-association` — iOS Universal Links for com.serayae.app.
  **TODO before it validates:** replace `TEAMID` with the Apple Team ID
  (Apple Developer → Membership). Serve as JSON at
  https://serayae.me/.well-known/apple-app-site-association
- `assetlinks.json` — Android App Links for com.serayae.app.
  **TODO before it validates:** replace the placeholder with the SHA-256
  cert fingerprint from Play Console → Setup → App signing (use the
  *App signing key* certificate, not the upload key), or from EAS
  credentials for internal builds.

Until both placeholders are filled, links to serayae.me open in the browser
instead of the app — nothing breaks, association simply doesn't activate.
