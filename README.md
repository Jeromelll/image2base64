# Image to Base64

Free, client-side image to Base64 tools for developers.

Live site: https://image2base64.com

## What It Does

- Convert PNG, JPG, SVG, WebP and GIF images to Base64 data URIs.
- Decode Base64 image strings back into previewable, downloadable images.
- Copy ready-to-use raw Base64, data URI, HTML `<img>` and CSS snippets.
- Run entirely in the browser with the `FileReader` API. No upload, no sign-up.

## Pages

- https://image2base64.com/
- https://image2base64.com/png-to-base64
- https://image2base64.com/jpg-to-base64 （含 `.jpeg`；`/jpeg-to-base64` 301 到此）
- https://image2base64.com/svg-to-base64
- https://image2base64.com/webp-to-base64
- https://image2base64.com/gif-to-base64
- https://image2base64.com/base64-to-image
- https://image2base64.com/about · `/privacy` · `/contact` · `/editorial-policy`

## Local Preview

```sh
python3 -m http.server 8000
```

Then open http://localhost:8000.

## Deploy（生产 = Worker `image2base64`，不是 Pages）

自定义域挂在 Workers domain `image2base64.com`。改完后：

```sh
rsync -a --delete \
  --exclude '.git' --exclude 'dist' --exclude '.claude' --exclude '.wrangler' \
  --exclude 'worker.js' --exclude 'wrangler.toml' --exclude '.assetsignore' \
  --exclude 'check_seo_consistency.py' --exclude 'SEO_LOG.md' --exclude 'README.md' \
  --exclude '_会话交接*' --exclude '诊断_*' --exclude 'GSC提交引导_*' --exclude '*.md' \
  --exclude '.gitignore' --exclude '.DS_Store' --exclude 'LICENSE' \
  ./ dist/
npx wrangler deploy
```

301 写在 `worker.js`（`/jpeg-to-base64`→`/jpg-to-base64`，`/base64-to-jpeg`→`/base64-to-jpg`）。Pages 项目仅作旁路预览。

## SEO consistency check

Deterministic scan (unique H1 / canonical / sitemap ↔ disk):

```sh
python3 check_seo_consistency.py
```

Exit `0` = no FAIL（`WARN` 例如 jpeg→jpg 合并仍算通过）。`--json` 可出机器可读报告。

## Deploy

This is a plain static site. Deploy the repository root to any static host, such as Cloudflare Pages, Netlify, Vercel or GitHub Pages.

## License

MIT
