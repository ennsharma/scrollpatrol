# Chrome Web Store submission

Status: prepared locally; not uploaded or submitted for review.

## Listing fields

Name: Scrollsafe — Semantic mute

Summary: Mute posts and short videos by meaning using their text and creator details.

Category: Productivity (choose the closest available subcategory)

Language: English

Homepage: https://github.com/ennsharma/scrollpatrol

Support: https://github.com/ennsharma/scrollpatrol/issues

Privacy policy: https://github.com/ennsharma/scrollpatrol/blob/main/PRIVACY.md

## Detailed description

A little less internet.

Scrollsafe lets you describe what you're tired of seeing, then collapses matching feed posts. Try “engagement bait asking me to comment for a link” or “startup fundraising announcements.” Reveal anything with Show post, pause filtering, or turn individual sites off.

• Filter by meaning, including available author and community details.
• Supports LinkedIn feeds, Reddit, and Hacker News.
• Beta desktop support for YouTube Shorts, TikTok feeds, and Instagram Reels.
• Uses loaded subtitles when available. Optional Gemini analysis adds up to two sampled video frames; no audio recording.
• Inspect recent mutes and feed diagnostics to understand decisions.
• Free, MIT-licensed source code. Bring your own TypeSafe API key; provider usage is billed separately. Optional frame analysis also requires your own Gemini key.

Privacy: relevant feed text, metadata, subtitles, and your rules are sent directly to TypeSafe for classification. Optional frame analysis sends images to Google and descriptions to TypeSafe. Keys and settings are stored locally. No maintainer backend or analytics.

Filtering is probabilistic and may make mistakes. Videos may play before evaluation finishes. Sampled frames and subtitles do not cover the whole video. Site layouts can change. The visual-analysis allowance is a local request estimate, not a provider-enforced billing cap; it does not cap TypeSafe usage.

## Privacy tab

Single purpose: Hide or cover social feed posts and short videos that match the user's natural-language mute rules.

storage: Store user-entered keys, rules, site preferences, connection status, muted-post history, cached visual descriptions, and visual-analysis allowance counters locally.

api.typesafe.ai: Send relevant post text, author/community metadata, available subtitles, optional visual descriptions, and mute rules to Jev for semantic classification using the user's API key.

generativelanguage.googleapis.com: When separately enabled, send up to two resized frames to Gemini for descriptions and on-screen text. Also used for the explicit generated-image connection test.

Supported site access: Content scripts read feed cards and loaded subtitles, observe newly loaded cards and SPA navigation, and collapse/cover matches. YouTube, Instagram, TikTok, and LinkedIn require origin-wide script injection to detect navigation into supported feeds without a page reload. The extension limits filtering to supported surfaces. Reddit and Hacker News scripts operate on story/feed listings.

Remote code: No. All executable extension code is bundled locally. APIs return classification scores or descriptive data, never executable scripts.

Data disclosures to review against the dashboard's current definitions:
- Website content: post text, metadata, loaded subtitles, sampled frames, visual descriptions.
- Personally identifiable information: author display names and usernames can appear in processed feed content.
- Authentication information: user-entered provider API keys, stored locally and sent only to their respective provider.
- Web history: supported post links are stored in local mute history; no general browsing-history API or collection. Disclose the narrow URL handling if the dashboard includes stored visited-page URLs in this category.

Do not select “does not collect or use user data.” Data sent directly to AI providers still needs disclosure. Review the three limited-use certifications against PRIVACY.md before certifying them.

## Reviewer instructions

1. Install the extension. Open the popup and configure a working TypeSafe key with Save & test. Add “Startup fundraising announcements.” A paid/provider-funded key is required; no credentials are embedded in the package.
2. Visit a supported feed. Matching posts collapse and Show post restores them. Recently muted records matches. Feed diagnostics reports detection and scores.
3. Change rules while the feed is open; existing and newly loaded cards are reevaluated. Pause restores hidden content.
4. Optional: add a Gemini key under Deeper video filtering, Save & test image access, enable Analyze frames when needed, and open a supported short-video feed. Availability depends on visible metadata and browser frame access.
5. Before submission, provide working restricted reviewer credentials through the dashboard's private test-instructions field if reviewers cannot otherwise access the paid API. Never commit these credentials or include them in listing screenshots.

## Upload checklist

- Upload release/scrollsafe-0.1.0.zip (manifest at ZIP root).
- Icon: public/icons/icon-128.png.
- Screenshot: store/assets/screenshot-1280x800.png.
- Small promotional image: store/assets/promo-440x280.png.
- Fill listing and privacy fields above; set distribution as desired.
- Complete developer registration, account contact verification, and any requested identity or trader declarations personally.
- Supply reviewer access and run a live provider sanity check before submitting for review.

Official guidance: https://developer.chrome.com/docs/webstore/publish and https://developer.chrome.com/docs/webstore/images
