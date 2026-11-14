# AI Temple World · 云上禅境

A browser-first, multilingual 3D sanctuary built with Three.js and Cloudflare Workers.

## Live services
- Website: https://ai-temple-world.pages.dev
- API: https://temple-world-api.nequex.workers.dev
- Source: https://github.com/nequex-eng/ai-temple-world

## Visitor experience
- Explorable 3D temple grounds with traditional halls, courtyard paths, stone lanterns, a bell pavilion, Bodhi tree and lotus pond.
- Walk into temple halls through the main doorways; wall boundaries and the lotus pond are respected by movement checks.
- Customizable monk avatar: name, robe color, skin tone and monk/pilgrim outfit.
- Desktop: WASD or arrow keys, Shift to run, drag to orbit, mouse wheel to zoom.
- Mobile: virtual joystick and running toggle.
- Actions: greet, join palms, bow, meditate, offer incense, sweep, ring the bell and release a lotus lamp.
- Four interface languages: Chinese, Japanese, Korean and Thai.
- Shared live room: online visitors can see other avatars, movement, gestures and realtime chat.
- Cloud-saved guest profile, daily visits, activity records and a public wish wall.
- Guest-data deletion control removes the associated profile, activities, prayers and visit records.
- PWA manifest, icon and offline shell caching.

## Cloudflare architecture
- Pages project: `ai-temple-world`
- Worker: `temple-world-api`
- Durable Object: `TempleRoom`, SQLite-backed, serving the shared WebSocket room.
- D1 database: `temple_world`; tables include profiles, activities, daily visits and prayers.
- Worker bindings: D1 `DB`, Durable Object namespace `TEMPLE_ROOMS`.
- Worker health endpoint checks D1 access and the realtime-room binding.
- GitHub Actions validates JavaScript syntax and frontend DOM references on pushes.

## Privacy and community principles
- Guest identity is browser/device based; there is no email/social login or cross-device account recovery.
- Chat is relayed in realtime and is not stored as a message history.
- Profiles, activity events and wishes are stored on Cloudflare D1; visitors can delete the data associated with their guest ID from the profile dialog.
- Do not post private, identifying or sensitive information on the public wish wall.
- No payment gate, donation gate, merit leaderboard, or claims that rituals change a person's fate.

## Current boundaries
- Chat displays each message in its original language. Automatic translation is not enabled yet.
- The AI abbot is not enabled yet. A MiniMax key exists on a separate Worker, but public use from this site would consume that account's API quota. It will only be connected after explicit approval of the public-use quota/rate limits.
- Guest identity is device-based; no cross-device recovery.
- Advanced rigged character animation, moderation tooling, admin console, voice, and production load testing remain to be completed.
- This is an initial public beta and should be tested on multiple devices before promotion.

## Local development
Serve the repository with any static HTTP server. The 3D renderer imports Three.js from jsDelivr. Set the API base URL in `src/network.js` when using a different Worker environment.

## Deployment
Static assets deploy to Pages project `ai-temple-world`. The API Worker is `temple-world-api`, with D1 binding `DB` and Durable Object binding `TEMPLE_ROOMS`.
