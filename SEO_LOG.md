# Image2Base64 SEO Log

Last updated: 2026-08-21 14:15 CST

## 2026-08-21 — jpg/jpeg merge + compliance pages

- done: Canonical encode URL = `/jpg-to-base64`. `/jpeg-to-base64` and `/base64-to-jpeg` → **301**. Sitemap drops jpeg encode; adds `/contact`, `/editorial-policy`.
- done: Deploy path clarified — custom domain is **Workers** service `image2base64` (`worker.js` redirects + `dist/` assets). Pages project is preview-only until DNS is fully moved.
- done: Sephiria also got `/contact/` + `/editorial-policy/` (rebuild + Pages deploy).
- wait: **2026-08-26** GSC indexing review before adding more pages.

## Operating Rules

- Record every SEO, backlink, directory, and content-distribution action here.
- For `png to base64`, prefer linking to `https://image2base64.com/png-to-base64`, not the homepage.
- Do not pay for directory listings unless explicitly approved and the page is indexed, public, and likely to keep a dofollow link.
- Track each item as `done`, `submitted`, `blocked`, `skipped`, or `next`.

## Target Pages

- Primary SEO URL: `https://image2base64.com/png-to-base64`
- Homepage: `https://image2base64.com/`

## Current Submission Profile

- Product: `Image2Base64`
- Title: `PNG to Base64 Converter`
- Tagline: `Free private PNG to Base64 converter that runs in your browser.`
- Short description: `Free private PNG to Base64 converter that runs in your browser. No upload, no sign-up, transparency preserved.`
- Category: `Developer Tools / Development`
- Tags: `developer tools`, `image converter`, `png to base64`, `base64`, `data uri`, `html`, `css`, `privacy`, `no upload`
- Contact name: `Jerome Leto`
- Business email: `jeromell@be-winner.com`

## Activity

### 2026-08-21 (afternoon)

- done: About + Privacy pages (`/about`, `/privacy`), root `ads.txt` placeholder, footer links on all converter pages, sitemap entries.
- deploy: git `316128c` + new Cloudflare Pages project `image2base64` (account jiamu970214); custom domains `image2base64.com` / `www` attached (API status may still show CNAME pending; live `/privacy` `/about` `/ads.txt` already 200 with new content).
- next: GSC Request indexing for `/jpeg-to-base64`, `/about`, `/privacy`; 2026-09-02 backlink review unchanged.

### 2026-08-21

- submitted: `hilmanski/freeStuffDev` PR #2051 for Image2Base64 (`https://github.com/hilmanski/freeStuffDev/pull/2051`).
  - Source: filtered `flaqai/backlink_skills` Free-backlink-list (743 → V2 quality). freestuff.dev is a developer free-tool directory (GitHub-gated, no reciprocal / paid ranking offer).
  - Entry: `src/content/tools/image2base64.md`; tags `converter-online`, `encoder`, `decoder`, `devtools`; thumbnail `https://image2base64.com/icon-192.png`.
  - Excluded this pass: AI directories, generic `submit.php` directories, Uneed (sells DR backlinks), kgohil/awesome-online-tools (almost all `tools-online.app`), WebCatalog desktop product page.
  - Same-day follow-through (playbook 2–4/day, not a one-site cap): alternative.me + sitelike.org.
- submitted: alternative.me Image2Base64 → **Pending Approval** (`https://alternative.me/account/submissions`).
  - Account: display name `Jerome Leto`, email `jeromell@be-winner.com` (still Unverified; no password stored — use forgot password). Category Web > Tools; type Online / SaaS; monetization Free; platform Browser; GitHub `https://github.com/Jeromelll/image2base64`. Icon uploaded from live `icon-192.png`.
  - First Submit saved Draft because Pricing URL was leftover `https://`; cleared and resubmitted.
  - Public listing URL not live yet.
- submitted: sitelike.org — searched first, no existing listing, then add-site. **Live:** `https://www.sitelike.org/similar/image2base64.com/`.
  - Title from site meta: `Image2Base64 - Free Image to Base64 Converter (No Upload)`. Similar: base64.guru, base64-image.de, codebeautify.org. Anchor: brand / product, not `png to base64`.
- checked: `zhaoolee/OnlineToolsBook` PR #23 still OPEN. `Bakumon/awesome-online-tools` PR #63 now 404 — drop. `iRajatDas/awesome-image-tools` PR #5 merged 2026-08-07 (was missing from the outreach table).

### 2026-08-17

- done: P0 — `www.image2base64.com` fixed (was 502 / NXDOMAIN).
  - Cloudflare zone (manual, by Jerome): added `www` DNS record (CNAME → `image2base64.com`, proxied) + Redirect Rule `www → apex` (Dynamic, `concat("https://image2base64.com", http.request.uri.path)`, 301).
  - First attempt used Static mode with `${http.request.uri.path}` in the target URL — Static does not expand expressions, so Location came back as the literal `https://image2base64.com${http.request.uri.path}/`. Rebuilt as Dynamic with `concat(...)` — correct.
  - Verified (direct, bypassing local VPN proxy): `https://www.image2base64.com/` → 301 → `https://image2base64.com/`; `https://www.image2base64.com/png-to-base64` → 301 → `https://image2base64.com/png-to-base64` (path preserved); apex still 200.
  - Note: local `dig`/`curl` on this Mac are routed through a VPN/proxy (fake-ip 198.18.x.x, proxy 502) — verify with `curl --noproxy '*' --resolve www.image2base64.com:443:104.21.73.32` or DOH `https://1.1.1.1/dns-query?name=www.image2base64.com`.
  - Impact: the 120 branded clicks/month on the `www.image2base64.com` query (GSC, position 1.00) now land on the live site instead of a dead 502.
- done: P0 — 9 ranking-but-zero-click sub-page titles/meta rewritten (deployed via commit `610cd00`).
  - Pages: png-to-base64, webp-to-base64, base64-to-png, base64-to-jpg, base64-to-jpeg (301→jpg), base64-to-svg, gif-to-base64, base64-to-webp, base64-to-gif. Differentiator injected: "No Upload / 100% client-side". `/base64-to-jpeg` is a 301 to `/base64-to-jpg` (existing `_redirects`), so jpg page covers jpg+jpeg intent.
- done: P0 — brand query entity boost on homepage (deployed via commit `610cd00`).
  - `<title>` now leads with "Image2Base64"; added Organization JSON-LD with `sameAs` → `https://github.com/Jeromelll/image2base64` (real public repo). Target: brand query `image2base64` (position 8.91, 11 impressions, 0 clicks) being outranked by GitHub/npm/competitors.
- done: P1 — `SoftwareApplication` JSON-LD added to all 13 pages (deployed via commit `9173e34`).
  - Every page now carries exactly one `SoftwareApplication` block: `operatingSystem` "Web", `applicationCategory` "UtilitiesApplication", `applicationSubCategory` "ImageConverter", `offers` price "0" (truthful — the tool is free), plus a `featureList` ("100% client-side", "No upload", "Copy as data URI", drag & drop / paste-preview per direction).
  - No `aggregateRating` added — we have no real ratings, and fabricating them risks a manual action.
  - Homepage now has 4 blocks (WebSite + Organization + FAQPage + SoftwareApplication); each sub-page has 2 (FAQPage + SoftwareApplication). All JSON validated.
  - Rationale (from 2026-08-16 GSC analysis): Search appearance report was empty despite FAQPage; this is the structured-data boost for a free web utility and targets the 9 ranking-but-zero-click pages' CTR problem.
- done: P1 — mobile UX fixes for 375px (deployed via commit `fd3017a`).
  - `@media(max-width:640px)` block moved after desktop rules (was overridden on mobile).
  - `.hero h1` mobile `font-size: 1.32rem` (prevents truncation at 375px width; settled after 1.5/1.7/1.55/1.4rem A/B testing).
  - `.meta` stacks to single column; `.copy` / `.btn` get min-height 40/44px touch targets.
  - Target: mobile is the clear under-performer (GSC: 6 clicks / 87 impressions on mobile vs 148 / 1,875 desktop).
- done: P1 — new `/jpeg-to-base64` page (deployed via commit `fd3017a`).
  - Cloned from `/jpg-to-base64`, rewritten for JPEG intent: title "JPEG to Base64 Converter — Free Online JPEG Encoder", canonical self-reference, H1/copy/FAQ JSON-LD updated.
  - All 14 pages (13 existing + new) interlink to `jpeg-to-base64` in sibling grid + footer; sitemap.xml now has 15 entries.
  - Live-verified (direct, bypassing local VPN proxy): HTTP 200, correct title, canonical self-referencing, 2 JSON-LD blocks (FAQPage + SoftwareApplication), sitemap entry present, homepage links x2.
  - Rationale: `base64-to-jpeg` was a 301 to `/base64-to-jpg`, so JPEG intent on the encode side had no dedicated page; `/jpg-to-base64` already gets 5 clicks/232 impressions, so a jpeg variant captures `jpeg to base64` queries without cannibalizing jpg.

### 2026-08-16

- checked: Google milestone email + GSC Performance export (`image2base64.com-Performance-on-Search-2026-08-16.xlsx`).
  - Milestone: 150 clicks from Google Search in the past 28 days (email dated 2026-08-14).
  - Export window: last 3 months; Chart slice 2026-07-18 → 2026-08-14 ≈ 152 clicks / 1,234 impressions, matching the email.
  - Query split: branded query ` https://www.image2base64.com/` alone drove 120 clicks / 173 impressions (position 1.00). All non-branded queries combined drove **0 clicks** across 909 impressions.
  - Page split: homepage 153 clicks / 1,242 impressions (avg position 61.31, inflated by branded #1); `/jpg-to-base64` 5 clicks / 232 impressions (position 15.50, CTR 2.16%); `/base64-to-image` 2 clicks / 318 impressions (position 51.76). Several pages rank page 1–2 but get 0 clicks:
    - `/base64-to-jpg`: position 6.31, 42 impressions, 0 clicks
    - `/base64-to-jpeg`: position 8.30, 37 impressions, 0 clicks
    - `/base64-to-svg`: position 10.50, 26 impressions, 0 clicks
    - `/png-to-base64`: position 21.80, 160 impressions, 0 clicks
    - `/webp-to-base64`: position 15.01, 87 impressions, 0 clicks
  - Device split: Desktop 148 clicks / 1,875 impressions (CTR 7.89%); Mobile 6 clicks / 87 impressions (CTR 6.90%); Tablet 1/1. Mobile remains a clear under-performer.
  - Country split: Indonesia 22 clicks, United States 17, India 16, Brazil 12, Mexico 11, Philippines 9 — branded/direct navigation dominates.
- checked: `www.image2base64.com` DNS and HTTP response.
  - `dig www.image2base64.com +short` returns NXDOMAIN; `curl -I https://www.image2base64.com/` returns `HTTP/1.1 502 Bad Gateway`.
  - Impact: Google reports 120 branded clicks on a `www.image2base64.com` query; any user clicking a www result (or typing www) hits a dead end.
  - Decision: **P0 fix** — add `www` DNS record and redirect to apex `https://image2base64.com/`. Cloudflare Pages custom domain or a CNAME → Pages project + redirect rule are the two viable paths.
- checked: sitemap coverage.
  - `/sitemap.xml` already includes all 12 current URLs (7 forward converters + `/base64-to-image` + 4 reverse decode pages + `/base64-to-gif`). No missing pages.
- checked: new page query signals.
  - `ico to base64` / `bmp to base64` / `tiff to base64` impressions ≤ 3; not worth a new page yet.
  - `base64 decode image` / `base64 image decoder` cluster has modest impressions (12–19) but positions 66–82; existing reverse-decode pages already cover this intent.
- decision: next work priority.
  1. P0 — fix www subdomain (DNS + 301 to apex).
  2. P0 — rewrite titles and meta descriptions for pages with impressions but 0 CTR, especially `/png-to-base64`, `/base64-to-jpg`, `/base64-to-jpeg`, `/base64-to-svg`, `/webp-to-base64`. Add stronger differentiation (client-side / no upload / copy-ready snippets).
  3. P1 — mobile CTR quick wins: shorten above-the-fold dropzone copy, enlarge tap targets, verify result fields are usable on 375px width.
  4. P1 — continue waiting on 2026-08-11/12 backlink outreach (zhaoolee/OnlineToolsBook PR #23, toolpod.dev, quicktoolhub.io) per the scheduled 2026-09-02 review; do not restart outreach before then.
  5. P2 — monitor GSC for `ico`/`tiff`/`avif` signal growth before expanding format matrix.

### 2026-07-10

- done: Reworked the dedicated `/png-to-base64` page for the `png to base64` and `png to base 64` query variants.
  - Commit/deploy: `9e44538` on `main`; live at `https://image2base64.com/png-to-base64`.
  - Scope: Title, meta description, Open Graph copy, H1/H2, opening copy, 1,387-word rendered guide, six matching FAQ/FAQPage entries, and natural coverage of the spaced query variant.
  - Media fix: added descriptive alt text plus explicit `width`/`height` to every live tool preview image; shared CSS now preserves the preview within a fixed 120 x 120 box.
  - Validation: local metadata/JSON-LD/internal-link/image checks passed; desktop headless render loaded the page and shared assets successfully.
  - `seo.web.cafe` result for `png to base 64`: 98/100 (A), topic focus 100%, content 24/24, images 8/8, structured data 10/10, technical 17/17.
  - Audit note: the first clean-URL check hit the old 11 KB/462-word CDN copy. A versioned read (`?audit=9e44538`) fetched the new 19 KB/1,387-word page. Its only warnings were the intentionally self-canonical query parameter and 50% URL-token coverage because the canonical slug correctly uses the standard `base64` spelling; do not create a duplicate `/png-to-base-64` URL just to chase that point.
- submitted: AlternativeTo application listing for `https://image2base64.com`.
  - Account: `Jeromelll`; submitted name: `Image2Base64.com`.
  - AlternativeTo item ID: `70d5db0c-0f1a-4ab1-bc7f-6f8a1ec88a18`.
  - Included the site icon, homepage screenshot, `image-converter` / `image-to-base64` tags, Online platform, and verified feature tags.
  - Result: the form was accepted and redirected to the alternatives step. The public slug currently returns AlternativeTo's intentional removed/404 page while the listing awaits moderation.
  - Alternatives submitted: `Base64 Image Encoder` and `Online Base64 Decode and Encode`.
  - `Base64-Image.net` and `Base64 Guru` were not present in AlternativeTo's existing-app search, so no competitor listings were created for them.
- checked: Cloudflare Web Analytics status for `image2base64.com`.
  - Checked at 2026-07-10 morning CST, prompted by an open-source-tools post that suggested self-hosting Plausible; decision was to use Cloudflare Web Analytics instead.
  - Result: already enabled — site created in Web Analytics ~2026-06-28 with Automatic setup (edge-injected beacon), recording data (2 page views / 2 visits in the last 24h at check time).
  - Verified end-to-end in a real browser session: `static.cloudflareinsights.com/beacon.min.js` loads and `/cdn-cgi/rum` fires on the homepage. Note: the injected script is NOT visible via curl (edge injection skips non-browser clients), so do not conclude it is broken from curl alone.
  - Decision: no action needed; do not self-host Plausible/Umami for this site. Revisit heavier analytics only if traffic materially grows.

### 2026-07-06

- skipped: no further speculative keyword/page expansion for now.
  - Reason: `image to base64` / `png to base64` are old evergreen utility terms with entrenched competitors, backlink history, and Google trust; better UI alone is not enough to create a cheap ranking edge.
  - Decision: treat the site as a low-maintenance asset, not the main SEO bet. Continue only technical indexing checks and GSC-led improvements; do not spend time polishing or expanding pages without clear query evidence.

### 2026-07-05

- checked: GSC email `[WNC-20237597]` "New reasons prevent pages from being indexed".
  - Checked at 2026-07-05 19:09 CST after the 2026-07-04 00:27 email.
  - Reported reason: `Alternate page with proper canonical tag`.
  - Public checks: canonical sitemap URLs return HTTP 200 with self-canonical tags; `http://image2base64.com/` 301s to `https://image2base64.com/`; `.html` and trailing-slash variants 307 to the canonical extensionless URLs.
  - Internal-link check: no `.html`, `http://image2base64.com`, or `www.image2base64.com` page links found in site HTML/JS/CSS/sitemap.
  - Decision: no code change needed. This matches the known alternate canonical duplicate for non-canonical variants, not a broken canonical on the target pages.
- checked: Google Search Console recent performance and indexing state.
  - Source: GSC Performance -> Search results, property `sc-domain:image2base64.com`, 3 months view.
  - Checked at 2026-07-05 12:36 CST; GSC Performance showed last update 3 hours earlier.
  - Totals: 0 clicks, 129 impressions, 0% CTR, average position 42.8.
  - Query table: 55 rows. Top signals were `image to base64` (13 impressions), `png to base64` (10), `image2base64` (7), `jpg base64` (4), `base64 encoding image` (4), `jpg to base64` (3), `images to base64` (3), `image to base 64` (3), `base64 encoder image` (3), and `svg to base64` (3).
  - Page split: `http://image2base64.com/` had 71 impressions and is listed as an alternate canonical page; `https://image2base64.com/` had 59 impressions; `https://image2base64.com/webp-to-base64` had 1 impression.
  - Indexing: sitemap submitted successfully and last read on 2026-07-03 with 7 discovered pages. GSC Page indexing report last updated 2026-06-30: 1 indexed URL (`https://image2base64.com/`), 1 alternate canonical URL (`http://image2base64.com/`), and 5 `Discovered - currently not indexed` URLs: `/base64-to-image`, `/jpg-to-base64`, `/png-to-base64`, `/svg-to-base64`, `/webp-to-base64`.
  - HTTPS report: last updated 2026-07-04; 0 non-HTTPS URLs, 2 HTTPS URLs, no critical issues.
  - Public checks: `http://image2base64.com/` returns 301 to HTTPS; all 7 sitemap URLs returned HTTP 200.
  - Decision: do not create a new long-tail page yet. The first optimization is to get discovered converter pages crawled/indexed; no clear new query cluster warrants a new page.
- submitted: GSC URL Inspection -> Request indexing for the five converter URLs in the `Discovered - currently not indexed` set.
  - Submitted at 2026-07-05 16:24 CST.
  - URLs submitted: `https://image2base64.com/png-to-base64`, `https://image2base64.com/base64-to-image`, `https://image2base64.com/jpg-to-base64`, `https://image2base64.com/svg-to-base64`, and `https://image2base64.com/webp-to-base64`.
  - Result: Google confirmed each URL was added to the priority crawl queue.
  - Note: live URL Inspection already showed `https://image2base64.com/webp-to-base64` as `URL is on Google` / `Page is indexed`; the indexing request was still accepted.

### 2026-07-03

- checked: Google Search Console query signal for the next long-tail page decision.
  - Source: GSC Performance -> Search results, property `sc-domain:image2base64.com`, 3 months view.
  - Checked at 2026-07-03 21:01 CST; GSC showed last update 3.5 hours earlier.
  - Totals: 0 clicks, 107 impressions, 0% CTR, average position 39.3.
  - Query table: 45 rows. Top signals were `png to base64` (10 impressions), `image to base64` (8), `image2base64` (7), `base64 encoding image` (4), `jpg base64` (3), `jpg to base64` (3), `images to base64` (3), and `svg to base64` (2).
  - Decision: do not create a new long-tail page yet. No clear `base64 to png`, `base64 to jpg`, or `ico to base64` query signal appeared; `base64 png` had only 2 impressions and ambiguous intent.
  - Result: no page, sitemap, or internal-link changes from this check.
- drafted: DEV.to article `When (and when not) to inline images as Base64`.
  - Local draft: `/Users/jerome/webcafe/marketing/devto-when-and-when-not-inline-images-as-base64.md`
  - Intended original: DEV.to.
  - Natural target links: `https://image2base64.com/png-to-base64` and `https://image2base64.com/`.
  - Hashnode cross-post: wait for the live DEV.to URL, then set Hashnode canonical to that DEV.to URL before publishing.
- blocked: DEV.to / Hashnode publishing.
  - Reason: no DEV.to or Hashnode API key, CLI, or local publishing credential was available in the shell environment.
  - Chrome check: `https://dev.to/new` opens the DEV.to login/register page, not an authenticated editor.
  - Result: no public URL created; do not count this as a live external link yet.
- saved draft: DEV.to article filled and saved after login.
  - Draft preview: `https://dev.to/jeromell/when-and-when-not-to-inline-images-as-base64-4bic-temp-slug-7065321?preview=2bb40f5a2c03f533ea805e1d96ff4af1f35789d56d1de227ebaad114bd880c73275bb290fcfacc1080d399746343f2696e1fa44d5eba93dc8822ee01`
  - Tags: `javascript`, `webdev`, `html`, `css`
  - Status: awaiting explicit publish confirmation; preview URL is not a public backlink.
- done: DEV.to article published.
  - Live URL: `https://dev.to/jeromell/when-and-when-not-to-inline-images-as-base64-2abo`
  - Natural target links: `https://image2base64.com/png-to-base64` and `https://image2base64.com/`
  - Tags: `javascript`, `webdev`, `html`, `css`
- checked: local DEV.to draft and live article status.
  - Local draft remains publish-ready at `/Users/jerome/webcafe/marketing/devto-when-and-when-not-inline-images-as-base64.md`.
  - Live DEV.to URL returned HTTP 200 at 2026-07-03 13:14 CST.
  - No DEV.to or Hashnode login/publish action was attempted in this pass.
- blocked: Hashnode cross-post.
  - Reason: Chrome is not signed in to Hashnode; `https://hashnode.com/new` did not open an editor and the page shows `Sign in`.
  - Next: after signing in, cross-post the DEV.to article and set canonical to `https://dev.to/jeromell/when-and-when-not-to-inline-images-as-base64-2abo`.
- done: Hashnode cross-post published.
  - Live URL: `https://image2base64.hashnode.dev/when-and-when-not-to-inline-images-as-base64`
  - Canonical URL: `https://dev.to/jeromell/when-and-when-not-to-inline-images-as-base64-2abo`
  - Natural target links verified in article: `https://image2base64.com/png-to-base64` and `https://image2base64.com/`
  - Tags: `css`, `javascript`, `html`, `webdev`

### 2026-07-02

- done: Added homepage internal links to `/png-to-base64` in `index.html`.
  - First-screen trust line links to the dedicated PNG converter.
  - Guide paragraph links PNG-only users to the dedicated PNG converter.
- submitted: Startup Stash listing form.
  - URL submitted: `https://image2base64.com/png-to-base64`
  - Category: `Development`
  - Logo upload skipped because it was optional.
  - Video skipped because no product video is available.
  - Advertising interest: `No`
  - Result: Typeform thank-you page confirmed.
- blocked: Uneed.
  - Product preview succeeded with `https://image2base64.com/png-to-base64`.
  - Blocked at login: `https://www.uneed.best/login?redirectTo=/submit-a-tool`
- blocked: DevHunt.
  - `/account/tools/new` requires GitHub or Google login.
- skipped: Jike `产品发布会`.
  - Reason: requires payment; weak external-link value for current SEO stage.
- noted: SaaSHub was already submitted/indexed by user before this log.
- skipped for now: Product Hunt and AlternativeTo.
  - Reason: account age / waiting period.
- skipped for now: GitHub awesome lists.
  - Reason: likely low acceptance fit.
- submitted: Launching Next free submission.
  - URL submitted: `https://image2base64.com/png-to-base64`
  - Headline: `Private PNG to Base64 converter`
  - Type: side project
  - Marketing budget: `$0`
  - Newsletter opt-in unchecked.
  - Result: form POST cleared the form but did not show a distinct thank-you / upgrade page; track email or later indexation before resubmitting.
- blocked: TinyLaunch.
  - Reason: submit flow requires account login.
- blocked: PitchWall / BetaPage free plan.
  - Reason: free plan exists, but submission requires OAuth login; free plan has 30-day waiting period.
- blocked: Fazier.
  - Reason: launch submission requires sign-in / join.
- blocked: neeed.directory.
  - Reason: submit flow requires Google/email login.
- blocked: Stack Directory.
  - Reason: submit flow requires Google login.
- blocked: Startup Buffer.
  - Reason: Cloudflare security verification.
- blocked: SaaSworthy.
  - Reason: Cloudflare security verification.
- blocked: Dofollow.Tools.
  - Reason: basic fields can be filled, but required logo upload failed in Chrome automation.
- skipped: Verified Tools free plan.
  - Reason: free plan gives a nofollow listing unless a badge is embedded on the site; paid plans are required for direct dofollow.
- skipped: We Are Founders.
  - Reason: submission currently requires payment (`$29` observed).
- skipped: LaunchLlama / Launched.
  - Reason: certificate errors; do not bypass browser security warnings for directory submissions.

## Next

- No active backlink / directory-submission follow-up for Uneed, DevHunt, TinyLaunch, PitchWall, or Dofollow.Tools.
  - Canceled by Jerome on 2026-07-03; user will handle any future backlink work manually.
  - Keep the 2026-07-02 entries above as history only, not as Codex todo items.
