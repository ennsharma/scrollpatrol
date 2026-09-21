# Scrollsafe privacy policy

Effective September 21, 2026. Scrollsafe is an open-source browser extension maintained by Nikhil Sharma.

## Purpose and data processing

Scrollsafe filters supported social feeds according to rules you enter. When you configure a TypeSafe API key and rules and leave filtering enabled, it sends nearby feed post text, available author names/usernames, community names, visible metadata, loaded subtitles, and your rules to TypeSafe (`api.typesafe.ai`) for classification. Feed content can contain personal or sensitive information. The extension does not access private messages, visit profiles, or fetch linked articles.

If you separately enable optional deeper video filtering, up to two resized video frames are sent to Google's Gemini API (`generativelanguage.googleapis.com`) for a description and on-screen text. That description is sent to TypeSafe for rule matching. This feature is off by default. Scrollsafe does not record audio, access your microphone, or capture whole-page screenshots. Connection tests send a generated sample post or image to the selected provider.

Your API key authenticates requests directly to its respective provider over HTTPS. Keys are stored locally in Chrome, not Chrome Sync, and are restricted to trusted extension contexts. They are not sent to the maintainer. Provider usage is charged to your provider account. Provider processing, retention, and use depend on their applicable terms and account configuration; consult [TypeSafe](https://typesafe.ai) and [Google's Gemini API terms](https://ai.google.dev/gemini-api/terms) before enabling processing of feed content.

## Local storage and retention

Rules, settings, keys, connection status, and visual usage counters are stored locally. The latest 50 muted posts retain short excerpts, post links, authors, communities, matching rules, scores, and timestamps until cleared or replaced. Visual descriptions are cached for up to seven days, with a maximum of 200 entries; expired entries are not reused and are removed when the cache is rewritten. Video frames are not persisted by the extension. Up to 1,000 classification decisions are cached in service-worker memory until it stops or settings change. Feed diagnostics live in the current tab's memory.

You can remove keys, clear muted history and frame descriptions, disable individual sites, or pause filtering in the popup. Removing a key does not clear other stored data. Uninstalling removes the extension's local storage. These actions cannot retract data already sent to providers.

## Sharing and use

Scrollsafe has no maintainer-operated processing backend, analytics, advertising, or sale of user data. Data is processed only to provide the filtering and connection-check features described here. It is not used by the extension for advertising, creditworthiness, or unrelated profiling. Scrollsafe does not collect general browsing history, cookies, or private messages. Post links are retained locally for revealing the source of a mute. Network providers may receive standard connection information, such as your IP address.

## Contact and updates

Questions or deletion guidance: [open an issue](https://github.com/ennsharma/scrollpatrol/issues) or contact [the maintainer](https://github.com/ennsharma). Do not include API keys or private feed content in public issues. Policy changes will be published here with an updated effective date.
