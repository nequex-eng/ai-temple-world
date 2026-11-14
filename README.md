# AI Temple World · 云上禅境

A browser-first, multilingual 3D sanctuary built with Three.js and Cloudflare Workers.

## Live services
- Frontend: https://ai-temple-world.pages.dev
- Realtime API: https://temple-world-api.nequex.workers.dev
- Repository: https://github.com/nequex-eng/ai-temple-world

## Current experience
- Procedural 3D temple grounds with traditional halls, courtyard paths, stone lanterns, bell pavilion, Bodhi tree and lotus pond.
- Third-person monk avatar with customizable name, robe, skin tone and monk/pilgrim outfit.
- Desktop WASD movement, mouse orbit and wheel zoom; mobile virtual joystick.
- Live room using a SQLite-backed Cloudflare Durable Object and WebSockets. Visitors see other online avatars, movement, gestures and chat in real time.
- Chinese, Japanese, Korean and Thai interface languages.
- Persistent guest profile, daily activity log, daily visits and public wish wall backed by D1.
- PWA manifest, app icon and offline shell caching.

## Architecture
- Cloudflare Pages hosts the frontend.
- worker/index.js is the API Worker.
- TempleRoom is a SQLite-backed Durable Object that owns the shared room and WebSocket fan-out.
- D1 database temple_world stores guest profiles, activity events, daily visits and prayers.
- No payment gate, donation gate, merit leaderboard, or claims that rituals change a person's fate.

## Local development
Serve this repository with any static HTTP server. The 3D renderer imports Three.js from jsDelivr. Set the API base URL in src/network.js when using another Worker environment.

## Current boundaries
- Guest identity is browser/device based; there is no email/social login or cross-device account recovery.
- Chat currently displays each message in its original language. Automatic translation requires a translation model or service with explicit billing/privacy approval.
- The AI abbot is not activated yet; it needs an approved MiniMax API key configured as a Worker secret.
- Avatar rigging, advanced animation capture, voice, moderation tooling, admin console, and production load testing remain to be completed.
- This is a live prototype and should be tested on multiple devices before public promotion.

## Deployment
The static site deploys to Pages project ai-temple-world. The API Worker is temple-world-api, with D1 binding DB and Durable Object binding TEMPLE_ROOMS.
