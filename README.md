# AI Temple World

A browser-first, multilingual 3D temple-world prototype.

## Current prototype
- Procedurally built 3D temple grounds and traditional-style halls using Three.js.
- Third-person avatar with saved local character appearance.
- Keyboard movement (WASD / arrow keys), mouse camera orbit, and mobile virtual joystick.
- Basic gestures and activities: join palms, bow, meditate, offer incense, ring the bell, and release a lotus lamp.
- Four interface languages: Simplified Chinese, Japanese, Korean, and Thai.
- Character profile is stored locally in the current browser.

## Run locally
Open `index.html` through a local static web server. Three.js is loaded from jsDelivr.

## Roadmap
1. Improve character rigging, animations, temple art, mobile controls, and accessibility.
2. Add interaction points, persistent activity records, and richer ritual sequences.
3. Add accounts and real-time multiplayer presence using Cloudflare Workers and Durable Objects.
4. Add multilingual chat/translation and an AI abbot after the shared world is stable.

## Important
This is the first playable 3D prototype. Real multiplayer synchronization, accounts, server-side persistence, AI abbot, and production-grade character animation are not implemented yet.