# NopeScope

**A little less internet.** An open-source Chrome extension that mutes posts by meaning, with Jev. Working name; repository: semantic-mute.

Describe what you don't want to see: “engagement bait asking me to comment for a link,” “startup funding announcements,” or “arguments about return-to-office policies.” Matching posts collapse into a small strip. **Show post** brings them back.

## Try it

1. Install Node.js 22+ and run `npm ci && npm run build`.
2. Open `chrome://extensions`, enable **Developer mode**, select **Load unpacked**, and choose `dist/`.
3. Open NopeScope from the extensions menu. Add your own [TypeSafe API key](https://console.typesafe.ai) and one or more mute rules.
4. Open or reload a supported feed. The popup lets you pause filtering, disable individual sites, and adjust the match threshold.

The source is free and MIT licensed. Jev is a hosted API, not an included local model; your API usage is billed by TypeSafe. This is an unpacked alpha, not a Chrome Web Store release.

## Preview

![NopeScope popup](popup-preview.png)

## First sites

- **LinkedIn:** feed post text at `/feed/`.
- **Reddit:** modern `shreddit-post` feeds and old Reddit link listings.
- **Hacker News:** story titles, with their score/comment metadata hidden together.

Comments, private messages, image-only content, video/audio and full linked articles are outside this version. Fixture tests cover known markup; live logged-in Reddit and LinkedIn compatibility still needs verification. Site markup can change.

## Privacy and behavior

No analytics, account, backend, or remote executable code. Your key and rules stay in Chrome local storage (not sync). Only the extension's trusted contexts can read that storage. The service worker sends up to 6,000 characters of nearby post text and your rules directly to `api.typesafe.ai` for classification. Do not use it on feeds whose text you do not want to send to TypeSafe; their data policies apply. The extension never sends cookies or collects browsing history.

Classification runs sequentially as posts approach the viewport. Up to 1,000 decisions are cached in service-worker memory; they expire when the worker stops or settings change. A page reload may therefore generate more API usage. Each post evaluates at most 10 rules in one API request. No API requests run until a key and a rule are configured. Posts stay visible during evaluation and on failure. API HTTP failures trigger a one-minute cooldown. There is no hard dollar spending cap in the extension; use provider limits if needed.

The default match threshold is 85%. This is a model score, not a guarantee. Posts are untrusted input and the classifier is instructed to ignore instructions inside them; adversarial posts can still cause misclassification. Every mute is reversible. Pausing, changing rules, or disabling a site restores hidden posts and reevaluates the feed.

## Develop

```sh
npm ci
npm run typecheck
npm run build
npm test
npx playwright install chromium
node scripts/smoke.mjs
```

`src/adapters.ts` contains the site selectors. `src/core.ts` builds typed Jev questions and validates responses. The content script handles feed updates; the service worker owns the key and API requests. Build output contains all code locally, compatible with Manifest V3's script policy.

API contract: [TypeSafe API reference](https://docs.typesafe.ai/api).

## Before publishing

Test authenticated feeds across supported layouts, evaluate false positives with real rules, add store icons/screenshots, and complete the Chrome Web Store privacy disclosure. No live Jev accuracy/cost benchmark has been run yet.
