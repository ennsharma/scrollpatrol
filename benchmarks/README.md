# Scrollpatrol experiments

These are evidence and measurement tools, not launch copy. Start with [the initial report](REPORT-2026-09-22.md). The first run made 98 live Jev requests: 93 direct API requests and five through the actual extension. No Gemini requests or private feed content were used.

## Reproduce

Use Node.js 22+ from the repository root. `npm ci` first. Set `TYPESAFE_API_KEY` in your environment or an ignored `.env.benchmark` file. Never pass a key as a command argument or commit it.

```sh
node benchmarks/run.mjs           # validate/build the plan; no API calls
node benchmarks/run.mjs --live    # at most 93 calls; incurs provider charges
npm run build
node benchmarks/browser.mjs       # at most five live calls; requires Playwright Chromium
```

The runner imports the real production request builder and response validation through esbuild, uses the production 15-second timeout and default 0.85 threshold, and records scores, latency, returned model version, reported tokens, and request hashes. No automatic retries. It stops on authentication/rate-limit errors or three consecutive other failures. A request-count limit is not a dollar budget. Output is incremental under ignored `benchmarks/results/`; only the reviewed synthetic first-run results are checked in under `published/`.

`jev-latest` is a moving alias. The recorded run resolved to `jev-1.13.0`; future runs may differ. Original production code commit, dataset, runner, and bundled prompt hashes are in the manifest. No prompt or labels were adjusted after inspecting first-run scores. Latency is measured with a monotonic clock through response JSON parsing and includes network time, not just inference. No warm-up calls were discarded. Direct API requests are sequential without extension caching.

`cases.mjs` contains 36 short synthetic examples with assistant-authored labels, frozen before the first run. This is a diagnostic challenge set, not a representative or independently labeled test set. Text-only uses the same targets as full context, intentionally testing the cost of removing evidence. Removing context also removes site and media-type information; it is not an isolated author-field ablation. The keyword baseline searches post text using six fixed, simple regexes; it is deliberately basic and has no metadata support. Do not claim broad superiority over keyword-based tools from this comparison.

The report includes threshold sweeps without new API calls; these are exploratory reuse of the same scores, not independent validation. Three preselected cases are repeated twice. Rule-count scaling uses one short fixed post, five rounds each at 1/5/10 rules in fixed order. Sample size and ordering prevent strong performance comparisons.

The browser experiment routes a synthetic HN-shaped page through the real extension with live Jev. It measures card insertion to `display:none`, later DOM additions, cache behavior across reload in the same worker lifetime, and reveal. It does not validate current live HN markup, authenticated LinkedIn/Reddit extraction, or video performance. Browser fetch timings stop at HTTP response headers; use the direct API timings for parsed-response latency comparisons.

## Next: an independently labeled real-feed sample

For a defensible real-world accuracy number, use this protocol before another model run:

1. Pick three rules you genuinely use. Write down what counts as a match, including ambiguous cases, and freeze the wording.
2. Take 100 consecutive posts from one specified feed/session without choosing examples based on model results. Record the site, timestamp, visible text and relevant metadata. Restrict any shared dataset to public content; keep private posts and personal data out of git.
3. Label each post/rule pair **mute**, **keep**, or **uncertain**, before revealing any scores. Ideally have a second person independently label a subset and report agreement. Keep uncertain cases separate, reporting their count.
4. Preserve missing-author/community fields as missing. Measure extraction coverage and extraction mistakes separately from model classification; compare what the page showed with what was sent.
5. Evaluate at the existing 0.85 threshold. Report post-level outcomes (any rule matches), per-rule precision/recall, false-positive count, API errors, latency, and provider-reported token cost. Show denominators. Do not treat correlated posts/rules as independent samples for confidence claims.
6. If adjusting the prompt/threshold, use a separate development sample, then collect a fresh untouched test session. Publish failure examples, not just highlights.

Separately, repeat timing at different times/networks and on longer posts before extrapolating latency/cost to daily usage. Evaluate frame analysis with human-labeled clips as a separate feature; this benchmark supports no claims about video understanding or Gemini accuracy.
