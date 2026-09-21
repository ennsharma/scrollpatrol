# Scrollsafe

![Scrollsafe](public/brand/scrollsafe-wordmark.png)

**A little less internet.** An open-source Chrome extension that mutes posts by meaning, with Jev.

Describe what you don't want to see: “engagement bait asking me to comment for a link,” “startup funding announcements,” or “arguments about return-to-office policies.” Matching posts collapse into a small strip. **Show post** brings them back.

## Try it

1. Install Node.js 22+ and run `npm ci && npm run build`.
2. Open `chrome://extensions`, enable **Developer mode**, select **Load unpacked**, and choose `dist/`.
3. Open Scrollsafe from the extensions menu. Add your own [TypeSafe API key](https://console.typesafe.ai) and one or more mute rules. **Save & test** makes a small Jev request and reports whether a valid response came back, with latency and the check time.
4. Open or reload a supported feed. The popup lets you pause filtering, disable individual sites, and adjust the match threshold.

The source is free and MIT licensed. Jev is a hosted API, not an included local model; your API usage is billed by TypeSafe. This is an unpacked alpha, not a Chrome Web Store release.

## Preview

![Scrollsafe popup](popup-preview.png)

## Connection checks and mute history

Open **Your Jev connection** to retest a saved key. A saved key is not shown as connected until a live test succeeds. The test checks authentication and the response format, not real-world classification accuracy; it uses a tiny sample post and incurs normal API usage.

**Recently muted** is a collapsed debugging panel with the latest 50 muted posts: excerpt, original post link when available, matching rule, score, site, and timestamp. It records posts actually collapsed by the content script, including cached decisions. It is a historical log, so entries remain after you reveal a post or disable filtering. Repeated posts are deduplicated. **Clear history** removes the local log. No log is uploaded.

## First sites

- **LinkedIn:** feed post text at `/feed/`.
- **Reddit:** modern `shreddit-post` feeds and old Reddit link listings.
- **Hacker News:** story titles, with their score/comment metadata hidden together.

Comments, private messages, image-only content, video/audio and full linked articles are outside this version. Fixture tests cover known markup; live logged-in Reddit and LinkedIn compatibility still needs verification. Site markup can change.

## Privacy and behavior

No analytics, account, backend, or remote executable code. Your key and rules stay in Chrome local storage (not sync). Only the extension's trusted contexts can read that storage. The service worker sends up to 6,000 characters of nearby post text and your rules directly to `api.typesafe.ai` for classification. Do not use it on feeds whose text you do not want to send to TypeSafe; their data policies apply. The extension never sends cookies or collects general browsing history. It stores up to 50 muted-post excerpts (240 characters each), links, matching rules, scores, and timestamps locally until cleared or replaced by newer entries.

Classification runs sequentially as posts approach the viewport. Up to 1,000 decisions are cached in service-worker memory; they expire when the worker stops or settings change. A page reload may therefore generate more API usage. Each post evaluates at most 10 rules in one API request. Feed classification does not run until a key and a rule are configured. Connection tests only require a saved key. Posts stay visible during evaluation and on failure. API HTTP failures trigger a one-minute cooldown. There is no hard dollar spending cap in the extension; use provider limits if needed.

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

## Brand assets

Approved wordmark and square icon originals live in `public/brand/`. Chrome uses 16, 32, 48, and 128 pixel PNG versions in `public/icons/`. The repository remains `ennsharma/scrollpatrol`; the extension display name is Scrollsafe.
