# image-to-base64 — 出海工具站 #1

纯前端常青开发者工具站。主词 **`image to base64`**，照哥飞 Web.Cafe 选词三道闸选定，纯客户端（`FileReader.readAsDataURL`），可 Cloudflare Pages 免费部署。模板复用自 `../ai-photo-prompts/`（结构沿用，配色/内容/工具逻辑全部改造为开发者工具）。

## 选定主词 + 选词依据（过三道闸）

**主词：`image to base64`**

| 闸门 | 结论 | 依据 |
|---|---|---|
| ① autocomplete 真实搜索意图 | ✅ 通过 | `suggestqueries.google.com/complete/search?client=firefox&hl=en&gl=us&q=image+to+base64` 返回密集长尾：`image to base64 converter / online / string / encode / decode / url / html / converter online free`；兄弟词 `png to base64`、`jpg/convert image to base64` 同样饱满；反向词 `base64 to image` 亦有真实需求。说明是真有人搜，不是「词存在」而已。 |
| ② SERP 竞争度可打 | ✅ 通过 | WebSearch `image to base64 converter online` 首页全是中小开发者工具站（base64-image.de、base64.guru、jam.dev、codebeautify、browserling、base64encode.net、imageonline.co、onlinepngtools）——**碎片化、无巨头垄断、无精确匹配专站军团焊死**。这正是哥飞说的「可打」信号；靠长尾页（png/jpg/base64-to-image）切入有空间。 |
| ③ 纯前端可做 | ✅ 通过 | 核心转换 = 浏览器 `FileReader.readAsDataURL(file)` 直接得到 data URI，零后端、零付费 API。反向解码也只是把字符串塞进 `<img src>`。完全静态，Cloudflare Pages 免费托管。 |

避开的红海/后端词（按任务铁律）：`image to pdf/jpg/png/word/excel`（iLovePDF/CloudConvert 焊死）、`image to video/cartoon/sketch/3d/prompt`（需后端 AI）。

## 文件清单

```
image-to-base64/
  index.html             主词工具页：image to base64（编码器，主入口 = 首页）
  png-to-base64.html     兄弟长尾页：PNG to Base64（编码器变体，保留透明度文案）
  jpg-to-base64.html     兄弟长尾页：JPG to Base64（编码器变体）
  svg-to-base64.html     兄弟长尾页：SVG to Base64（编码器变体，含 base64 vs URL-encode 说明）
  webp-to-base64.html    兄弟长尾页：WebP to Base64（编码器变体）
  base64-to-image.html   兄弟长尾页：Base64 to Image（反向解码器 + 下载）
  styles.css             全站共用样式（开发者工具风：slate + indigo）
  app.js                 全站共用脚本；按页面元素自动挂载编码器/解码器，纯客户端无网络请求
  robots.txt             允许全量抓取 + 指向 sitemap
  sitemap.xml            4 个页面，域名占位 example.com
  README.md              本文件
```

四页互相内链（首页 ↔ 三个兄弟页，footer + “More tools” 区块），构成 `image to base64` 词簇，一词一页。

## 工具能力（已客户端实测可用）

- 拖拽 / 点击选择 / 剪贴板粘贴 图片 → 即时输出 **data URI** + **raw base64**（可开关前缀）+ 现成 **HTML `<img>`** 和 **CSS `background-image`** 片段，逐个一键复制。
- 显示文件名、MIME 类型、文件大小、base64 字符数；带棋盘格背景的预览框。
- `base64-to-image.html`：粘贴字符串/data URI → 预览 + 下载为文件（缺前缀默认按 PNG 解）。
- SEO 正文（What is base64 / 何时该内联 / 体积 +33% 提醒 / 隐私 / 代码示例 / FAQ）**写死在静态 HTML**，关 JS 也在，爬虫可抓；每页带 FAQPage JSON-LD。

## 正式域名

**`image2base64.com`**（2026-06-28 于 Cloudflare Registrar 注册，含主词，DNS 已托管 Cloudflare）。全站 canonical / og:url / robots / sitemap 已写死此域名。

## 上线待办（部署 Cloudflare Pages）

1. ✅ **定关键词域名** — `image2base64.com` 已注册。
2. ✅ **全局替换占位域名** — `example.com` → `image2base64.com` 已完成。
3. **Cloudflare Pages 连 GitHub 自动部署**：把本目录推到一个 GitHub repo → Cloudflare Pages 新建项目连该 repo，build command 留空、输出目录设为站点根（纯静态），保存即自动部署；再到 Pages 项目的 Custom domains 绑 `image2base64.com`（同账号 DNS 一键加 CNAME）。后续 push 自动更新。
4. **收录 & 数据**：加统计（Cloudflare Web Analytics，无 cookie 免费）→ Google Search Console 验证域名 → 提交 `sitemap.xml` → 手动请求收录首页 → 铺几条外链（dev 社区 / 工具目录站 / Reddit 相关帖）加速抓取。
5. **AdSense / 变现**：流量起来后申请 AdSense，广告位已在 HTML 预留 `<!-- AD-SLOT -->` 注释处。
6. **扩长尾页**：✅ 已加 `svg-to-base64.html`、`webp-to-base64.html`（2026-06-28）。后续可继续照同模式加 `gif-to-base64`、`base64 to png/jpg`、`ico-to-base64` 等，复用 `app.js`（已页面无关），每页一词、互相内链，加完记得补进 `sitemap.xml`。

## 本地自测

```
cd image-to-base64
python3 -m http.server 8000   # 然后浏览器开 http://localhost:8000
```
验证点：拖图/选图能出 base64、各 Copy 按钮生效、解码页能还原并下载、关掉 JS 后正文/FAQ 仍在（SEO 可爬）、控制台无报错。
