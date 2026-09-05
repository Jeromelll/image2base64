# Image2Base64 SEO 日志

## 2026-09-05 — 全站转换页新增可选「via Image2Base64」署名链接（外链钩子①上线）

- 来源：即刻 indie hacker 对标（@唐唐同学）手法迁移——「晒成绩+送好处」二合一结构，给社区分享者一个自愿带署名的理由（outreach.md §六）。
- 改动：9 个转换页（index / image-to-base64 / data-uri-generator / png / jpg / jpeg / gif / webp / svg-to-base64）HTML `<img>` 片段输出框下新增 `credit-toggle` 勾选（**默认关**）；勾选后片段追加 `<small><a href="https://image2base64.com/">via Image2Base64</a></small>`；切换即时重建片段（`lastDataUri` 缓存，不重读文件）；`track("credit", on|off)` 埋点与 copy 事件口径一致。
- app.js：`buildHtmlSnippet()` 收口 HTML 片段生成；全部守卫式，无该控件的页面零影响。
- 本地验证：playwright headless 实测 png 页完整转换流——默认无署名 / 勾选带链接 / 取消还原 / 控件可见，4 断言全过；提交版 blob（git archive HEAD 提取）复测同过。
- 部署：`wrangler deploy` Version `9d269ddb`（2026-09-05 13:52 CST）。线上已验证：首页 + png / image / webp / jpg 四工具页 canonical URL 均含 credit-toggle；check_seo_consistency `fail=0`（2 warn 为已知 jpg/jpeg 合并）。
- 坑（复用价值）：① 工具页 URL 307 到无 `.html` canonical，curl 不带 `-L` 拿到空 body，grep 0 ≠ 未上线；② 本仓库存在多会话并发写（同日 SEO Agent 平移 sample chips），提交前须 `git diff` 逐块核对——本次首次提交曾卷入并发快照，已用 `git hash-object -w` + `git update-index --cacheinfo` 拆出纯净提交，对方 WIP 原样保留在工作区。
- 预期：社区分享者自愿带署名链 → 长尾真实外链；观察 D1 `credit` 事件 on/off 比例 + GSC Links 是否新增非 dev.to 域。

## 2026-09-05 — ④a 平移到 /base64-to-png（关键词优先级 ②，decode 方向）

- 背景：竞对 gap 分析（SEO Agent 域名概况两竞对 + 官方口径核词）确认 `base64 to png`（官方 480/月、KD 32.4 全族最低、前十有 DR 0-4 新站在赢）是 19 词盘点里的 ② 号优先词；页面已存在，动作为补强。
- 改动：decode 版补强——① 输入区新增样例 Base64 chips（"No Base64 handy? Try a sample:"），canvas 现场绘制 → `toDataURL("image/png")` → 填入输入框 → 自动触发解码，零网络请求零静态资源；② 结果区 muted 文案升级为 4 格指标（Source type / Dimensions / PNG size / Base64 input）；③ 新增体积对比提示条（N chars → X KB，binary ≈25% lighter 教育语义）。
- app.js：绘制逻辑提为模块级 `drawSampleScene(ctx, kind)`（encoder/decoder 共用）；`showResult` 加可选 `extra` 参数回填指标（全守卫，其他 12 个 decode 相关页零影响）；decoder 新增 `makeSampleDataUri` + chips 绑定（含 track("sample") 埋点，与 encode 页口径一致）。
- 本地验证：headless Chrome 实测 base64-to-png 两枚样例——PNG 检测、480×320/160×160、16.1KB/5.9KB、blob 下载链接、无报错；png encode 页回归通过（重构等价）。
- 部署：`wrangler deploy` Version `d9c828a6`。线上已验证：页 200 + chips/指标 4 处命中、app.js 含 drawSampleScene；check_seo_consistency `fail=0`（2 warn 为已知 jpg/jpeg 合并）。
- 月度闸门自动化已建（WorkBuddy，每月 5 号 10:00，首跑 2026-10-05）：D1 事件环比 + GSC 闸门判定（png to base64 点击 0→>0 则继续平移 ③ base64-to-image；仍 0 且曝光不增则停补强转外链），报告落 ~/webcafe/marketing/gsc-monthly-review-YYYY-MM.md。
- 竞对 gap 分析结论（SEO Agent，官方口径，回写 se-gefei-agent-QA-competitor-gap-2026-09-05.md）：最大机会是开「decode 还原文件」新品类——base64 to pdf 1600/月/KD45.7（前十有 DR 0 弱占位）+ base64 to text 1000/53.1 + pdf to base64 390/47.2，base64.guru 靠此品类吃下大块 ETV 且无强站正面占坑；次优先是把 image-to-base64 页的 title/H2/intro 补齐 image as base64 / base64 image encoder 等变体说法（1900+880/月，不新建页）。

## 2026-09-04 — ④a 补强平移到 /png-to-base64（关键词优先级 ① 页面）

- 背景：哥飞 SEO Agent `keyword_volume`（Google Ads 规划师官方口径 US）两轮 19 词盘点：`png to base64` 720/KD 41.8 为全站第 1 优先内容词（DR9 弱站已进前十，SERP 有缝）；`base64 to png` 480/KD 32.4 次之；`base64 to image` 2,900/KD 51.4 第三。页面均已存在（EMD 全家桶），故动作为**补强现有页**而非新建。
- 改动：把 9/3 draft ④a（jpg 页体验补强，commit `5c17fc4`）平移到 png-to-base64.html——dropzone 样例图 chips（"No PNG handy?"）、结果区新增 **Base64 size** 与 **Dimensions** 两格（4→6）、**膨胀率实算提示条**（按 file.type 推导格式标签，PNG 页显示 PNG/.png）。
- app.js 参数化：`makeSampleJpeg` → `makeSampleImage(kind, mime, ext, done)`，mime/ext 由页面 `data-accept` 推导（png 页 canvas 输出真 PNG）；overhead 文案格式标签由 `file.type` 推导，**jpg 页输出与改动前逐字一致**（已回归验证）。改动全部守卫式，其余 12 个工具页零影响；webp 页未来可低成本跟进（canvas 支持 webp 编码），svg/gif 页不适用。
- 本地验证：headless Chrome 实测 png 页两枚样例 chip——type=image/png、dims/b64size 回填、`data:image/png;base64,` 前缀、无报错；jpg 页回归通过（"JPG" 文案不变）。
- 部署：`wrangler deploy` Version `5fe41dc4`。线上已验证：png 页 200 + chips 3 处命中、app.js 含 makeSampleImage；check_seo_consistency `fail=0`（2 warn 为已知 jpg/jpeg 合并）。
- 坑（复用价值）：① 同一文件多个 Edit 并行执行会互相覆盖（写回竞态），必须串行——本次 png 页 HTML 与 app.js 各被吞 1 处、复核 grep 时才抓回；② 本机 BSD grep 不支持 `\|`，一律用 `grep -E`，两次假阴性均由此起。
- 预期：拉 png 页交互深度/停留时长（样例图让无素材访客完成完整转换）→ 支撑 `png to base64` 排名；成功指标 = GSC 该词点击 0→>0、page D1 事件中 png 页 sample/convert 事件上升。
- 后续（按关键词优先级）：② `base64 to png`（480/32.4，decode 方向需另写解码逻辑，等 png 页 GSC 一个月数据再定投入）；③ `base64 to image` 页补强同款（2,900/51.4，converter 长尾 +276% 并入）。

## 2026-09-04 — 全站 footer Guides 栏补齐（对比页获得站点级入口）

- 上一条 FAQ/对比页部署仅给首页/faq 加了 Guides 栏；本条把其余 20 页（全部 14 工具页 + about/privacy/contact/editorial + image-to-base64/data-uri-generator/base64-favicon）footer 统一加上 Guides 导航，指向两个对比页——两个新页由此获得全站每页 1 条入口。
- 坑（记录在案）：批量插入脚本把 Guides nav 插进了 About nav 的闭合 `</nav>` 之前（feedback-link 与 `</nav>` 之间的锚点定位错误）= nav 嵌套，HTML 语义不合法。已用幂等修复脚本（先正则移除 Guides 块 → 重插到 About nav 闭合之后、footer-inner `</div>` 之前）修正，并用栈式解析校验 24 页全部为兄弟 nav。
- 部署：`wrangler deploy` Version `3e53faf3`（2026-09-04 11:16 CST）。
- 线上已验证：png-to-base64 / about / privacy / base64-to-svg / image-to-base64 均含新页链接。check_seo_consistency `ok=68 warn=2 fail=0`。
- 后续：新增「资源/指南类」页面时 footer Guides 栏需同步（本 repo 无模板，靠脚本批量，先跑幂等脚本再人工抽查）。
- 附：本 repo 存在多客户端并发操作（另一会话同时追加了 SEO_LOG 目录提交轮条目）；操作前先 `git pull`/检查 `git status`，避免旧索引覆盖。

## 2026-09-04 — /data-uri-generator + /base64-favicon 免费目录/清单提交轮（7 笔）

- 范围：只投「接受独立工具页」的渠道 + GitHub awesome-list 类；主站已提交过的渠道（PH/TAAFT/AlternativeTo/SaaSHub/alternative.me/sitelike.org）不重复；付费与需登录渠道跳过（与 7/2 轮结论一致）。无社交帖类动作。
- **Startup Stash（Typeform，2 笔 submitted）**：Data URI Generator + Base64 Favicon Generator 分别走 `/add-listing/`（原 `/submit` 已 404，入口改名 add-listing）。Development 类目、logo 可选未传、广告 interest=No。确认页 "Thank you for applying to get listed on StartupStash"。Email jeromell@be-winner.com。
- **Launching Next（2 笔 submitted）**：同表单两连投，确认页 `/thanks/?i=148606`（Data URI）与 `/thanks/?i=148607`（Favicon）。type=A side project、营销预算=$0、newsletter_optin 已取消勾选。$99 加急付费档未购买。
- **GitHub awesome-list（3 个 PR，均为查重后新提交）**：
  - `hilmanski/freeStuffDev` **PR #2071**：新增 `src/content/tools/data-uri-generator.md` + `base64-favicon.md`（格式照 PR#2051）。主站条目 PR#2051 仍 OPEN。
  - `iRajatDas/awesome-image-tools` **PR #31**：readme Developer tools 区 Image2Base64 行后插 2 行（🔒 标记一致）。主站条目 PR#5 已 merged。
  - `zhaoolee/OnlineToolsBook` **PR #24**：新增 T046《Data URI 生成器》/ T047《Base64 Favicon 生成器》（fork 默认分支是 master；编号避开 OPEN 的 PR#23=T045）。
  - 查重：gh search 三 repo + 全网均无 data-uri-generator / base64-favicon 相关既有 PR/issue。
- **跳过**：Microlaunch（Cloudflare 人机质询）；Uneed/DevHunt/TinyLaunch/PitchWall/Fazier 等需登录（历史 blocked）；We Are Founders/Jike/Verified Tools 付费或免费=nofollow；Tier 3 AI 目录类目不符。
- **过程坑（复用价值）**：① 浏览器 daemon 被并行任务抢 tab（页面被导航到 saashub/microlaunch），`--session dirsub0904` 独立会话隔离后解决；② Launching Next 的 radio 组（funding/marketing_budget）点击被样式层拦截，JS 直接 set checked+dispatch change 可靠（普通 HTML form，提交时读取 DOM checked）；③ newsletter_optin 记得取消默认勾选；④ 真正的提交控件是 `input[type=submit][value="Submit Startup"]`，snapshot 的 button ref 点击无效。
- **待办**：Startup Stash / Launching Next 均为人工审核制，留意 jeromell@be-winner.com 的收录通知邮件（约 1-2 周）；三个 GitHub PR 等维护者合并；通过后跑 backlink verification（T+8 天起，参照 8/29 cadence）。
- tracker 已同步：`/Users/jerome/Research/image2base64/SEO/directory-submissions-tracker.csv` 追加 13 行（7 submitted + 6 skipped/说明）。

## 2026-09-04 — FAQ 吃 PAA 长尾 + 两个对比内容页（SEETO 冷邮件诊断 → 顺手做的 SEO 动作）

- 触发：SEETO AI 冷邮件给 image2base64.com 免费打分（73/100），其「加 FAQ / 加对比内容」建议与本阶段「关键词拓展」优先级重合。站点实际已有 FAQ（index 5 问 + faq.html 11 问，均带 FAQPage schema），故只补缺口，不为诊断买单。
- FAQ 增量（吃 PAA 型问题词，非新功能）：faq.html 11→16 问，新增 JS 写法 / data URI vs raw Base64 / Base64 是否拖慢网站 / SVG 是否该 Base64（专业观点：通常不该）/ 如何自行验证不上传（Network tab + 飞行模式方法）。index.html #faq 区块 +2（works offline / file size limit），details 与 FAQPage JSON-LD 同步。
- 新页 1：`online-vs-local-base64-converter.html`——三类转换器（server-based 上传 / in-browser / 桌面 CLI）对比表 + 「判定是否上传」三方法 + 选型判据 + 4 组 FAQ schema。用「online ≠ upload」的澄清立口碑。
- 新页 2：`image-to-base64-alternatives.html`——诚实列出 base64.guru / base64encode.org / base64-image.de / Online-Convert / cryptii（各 1-2 行定位 + 官方链接 nofollow，不替竞品断言内部行为，指向可自验方法）+ 「典型 server-based vs 本站」对比表 + 4 组 FAQ schema + fairness 段（反 self-serving 失衡）。
- 内链：新页互链；首页 #guide Privacy 段后 + 首页/faq 页 footer 新增 Guides 栏（两新页入口）；faq.html 正文「Choosing a tool」段内链。其余 21 页 footer 未动（本次范围控制，全站 Guides 栏后续轮换补齐）。
- styles.css 新增 .cmp 对比表系列类（纯追加，不动现有）。
- 部署：`wrangler deploy` Version `534fe64a`（2026-09-04 11:08 CST，6 文件：两新页 + index + faq + styles + sitemap）。
- 线上已验证：两新页 200、title/canonical 正确；sitemap 含 2 新条目（priority 0.6）；index 含 footer+guide 内链与新 FAQ；faq 含 5 新问。check_seo_consistency `ok=68 warn=2 fail=0`（2 warn 仍为已知 jpg/jpeg 合并）。
- 预期：吃 data uri vs base64 / svg base64 / base64 javascript 等概念词 + alternatives/comparison 交易词；对比页兼作外链落点（引用「如何判断工具是否上传」的方法类内容）。
- 坑：BSD grep 不支持 `\|`（用 grep -E）；rsync 后核对 dist 用 grep -c 单模式。



- 选题依据：GSC 9/3 导出（28 天）显示 12 个格式词页全部收录、均有曝光但 0 点击、排名 10–90 位——瓶颈是域名权重不是页面数；故新页只选**现有查询空间之外的相邻意图**，不开新格式词变体。两个词都离主产品最近（同一个编码引擎、同一批用户）。
- 新页 1：`data-uri-generator.html`，主词 `data uri generator`，辅词 base64 to data uri / data uri css。encoder 全量复用（data URI + HTML + CSS 三个输出）。
- 新页 2：`base64-favicon.html`，主词 `base64 favicon`，辅词 favicon data uri / inline favicon。`app.js` encoder 新增可选 `#out-link` 输出（3 行）：生成完整 `<link rel="icon" type="…" href="data:…">` 标签，其他页无此 id 不受影响。
- 内链接线（root+dist 共 38 处改动）：两新页 footer + sib-card 进全站 14 个工具页与首页；新页互链 + 回链全网格；sitemap 加 2 条（data-uri-generator 0.9、base64-favicon 0.8）。合规页（about/faq/privacy/contact/editorial）本就无工具导航，未动。
- 部署：`wrangler deploy`（wrangler 4.128 装在 ~/.workbuddy/binaries/node/workspace，NODE_PATH 调用）Version `55a50762`（2026-09-03 17:55 CST）。
- 线上已验证：两新页 200、title/canonical 正确；sitemap.xml 含 2 新条目（cf 边缘缓存短暂返回旧版，数分钟后已刷新）；`.html` raw 307 → clean。check_seo_consistency `ok=62 warn=2 fail=0`（2 warn 仍为已知 jpg/jpeg 合并）。
- 坑：批量接线脚本第一版把「卡片是否已插」的判重条件与 footer 插入共用同一个 href 检查，footer 先插导致卡片全部漏插；已修正为独立判重标记后重跑。批量 sed/python 改动后必须 grep -c 复核两类锚点。
- 预期：吃 data uri / inline favicon 两个未覆盖查询空间；成功指标同前——非品牌点击 0→>0。

## 2026-09-03 — 隐私优先行为分析上线（D1 事件库）

- 目的：回答「用户在网站上具体干了什么」→ 反推找需求与页面调整。
- 架构：Worker `POST /api/evt` 接收事件写入 D1（`image2base64-events`，表 `events`）；app.js 埋点 page_view（带 referrer）/ convert（mime+体积档）/ copy（哪个输出框）/ decode / download / error（编码或解码报错原因）/ sample（点了样例图）。Worker 侧自动补 country（request.cf）与 device（UA 派生）。
- 隐私口径：无 cookie、无 IP 存储、无文件内容/文件名、无个人标识，first-party 自有管道——贴合 "No upload" 品牌，已同步更新 privacy.html「What we may collect」。
- 关键坑：**Workers 静态资产请求默认不经过 Worker 代码**（asset router 直接命中），服务端记 page_view 不可行 → page_view 由 app.js boot 时上报。另 Analytics Engine 绑定需控制台手动开通（error 10089），故选 D1（CLI 全流程可建可查）。
- 端到端已验证：真实浏览器 page_view / sample / convert / copy 全部落库；/api/evt 204；测试数据已清理。Version `e0a18ed0`（行为分析部署）。
- 查询方式：`npx wrangler@4 d1 execute image2base64-events --remote --command "SELECT ..."`（见 image2base64-deploy 技能的查询样例）。

## 2026-09-03 — Loop Engineering：/faq FAQ 内容页 + 全站 Feedback 入口

- 动机：飞哥 4:2:4 框架（找需求:开发:运营）中的运营项——用户问题反哺 SEO 长尾词（Loop Engineering），一鱼两吃。
- 新页：`faq.html`（11 问 FAQ，FAQPage JSON-LD 吃 rich results），canonical `https://image2base64.com/faq`，sitemap priority 0.7。
- 反馈入口：全站 19 页 footer About 栏新增 FAQ + Feedback（mailto）链接；`app.js` 末尾新增 feedback-link 邮件主题自动带上 `document.title`——用户从哪个工具页发反馈一目了然，客服问题直接映射到对应工具页的 FAQ 补充。
- 部署：`rsync ./ dist/`（含排除 `诊断_*`）+ `npx wrangler@4 deploy` Version `8dcd21a6`（2026-09-03 晚）。**git push 不会上线**；GitHub 上的 Workers Builds check 长期 failure 但与本站部署无关，勿被误导等部署。
- 线上已验证：`/faq` 200 含 FAQPage schema；工具页 footer 含 FAQ/Feedback 链接；sitemap.xml 200 含 /faq；app.js 含 subject 自动填充。check_seo_consistency `ok=56 warn=2 fail=0`。
- 后续：收到的真实用户问题按「对应工具页就近补充 FAQ 区 + 本页收录」双轨消化。



- 战略依据：9/2 战略转向（外链→慢变量、内容/排名→首要杠杆）后 action B 第一个产物；head 词 `image to base64`（~2400/mo）原只由首页兼任，按哥飞「一词一页」原则为它建独立页。
- 页面：`image-to-base64.html`（V2.0 三合一精品页），canonical `https://image2base64.com/image-to-base64`，含 SoftwareApplication JSON-LD + FAQ 区；`worker.js` clean URL 自动解析，无需加路由。
- 内链：13 个格式页 sib-card 26 处（root+dist）+ 全站 footer nav「Image to Base64」28 处（root+dist 统一改指，含首页；首页由此获得指向新页的第 1 条链接）+ 新页自身 footer = 线上每格式页 2 处、首页 1 处指向新页。
- sitemap：`priority 0.9` 条目，位于首页之后第 2 位。
- 部署：`wrangler deploy` Version `9336f57e`（2026-09-02 晚，第二次部署含 footer/sitemap 修复）。
- 线上已验证：`/image-to-base64` 200；`.html` raw 307（Workers 自动转 clean）；`/jpeg-to-base64` 301 规则不变；sitemap.xml 200 含新页；check_seo_consistency `ok=53 warn=2 fail=0`（2 warn 为已知 jpg/jpeg 合并）。
- 预期：吃 `image to base64` head 词，辅助非品牌点击 0→>0（成功指标见 outreach.md 战略转向节）。

## 2026-09-01 — Product Hunt 定时发布 + TAAFT 免费路径

## 2026-09-02 — Product Hunt 发布日 X 推广

### Product Hunt（发布日）
- **主帖 posted（15:12 CST）**：`https://x.com/jiamujiamu/status/2095046137145430150`
  - 内容："🖼️ Made a tiny tool: Image2Base64 — converts images to Base64 entirely in your browser. No uploads, no server, no account. Your images never leave your device. Free forever. 👉 https://image2base64.com #BuildInPublic #DeveloperTools"
  - 技术：Draft.js execCommand insertText 方案写入，JS click 发布按钮验证成功
- **第二条 posted（15:44 CST，automation id: eb4db7f6）**：`https://x.com/jiamujiamu/status/2095056140820480331`
  - 内容："The privacy angle is underrated for dev tools. Every "free" image converter uploads your file to their server. Image2Base64 doesn't. 100% client-side, zero data collection. Link in bio 👆"
  - 技术：Draft.js execCommand insertText 写入（注意 X compose 是双语版，需要先清空再插入），JS click enabled post button（index 0）发布成功
- PH Pre-Launch Dashboard：产品 Sub-launch，无 Pre-Launch Dashboard，X 追踪链接不可获取
  - 根因：Image to Base64 Converter 是 Code Beautify 下的 Sub-launch（子项），PH Pre-Launch Dashboard（含 X/LinkedIn 带追踪参数的分享链接）仅对独立产品开放
  - 验证：Sub-launch `/posts/image-to-base64-converter` → `code-beautify?launch=` 重定向；`/shoutouts` → 主页占位；产品页 Share 按钮 → 图片画廊，无追踪模态框
  - 建议：下次发布新产品时作为独立产品提交以获取 Pre-Launch Dashboard
- **第三条 posted（17:00 CST）**：`https://x.com/jiamujiamu/status/2095074957088932189`
  - 内容："Helped ship Image2Base64 on @ProductHunt today — converts images to Base64 entirely in-browser. No uploads, no server, no account. 100% private.\nhttps://www.producthunt.com/products/code-beautify/launches/image-to-base64-converter\n#BuildInPublic #DeveloperTools"
  - 意义：直接给 PH 产品页引流量（PH 排名信号 = 独立访客 IP 数）
- **状态：posted**（主帖已发，第二条已发，第三条含 PH 链接已发）

### TAAFT（theresanaiforthat.com）免费路径
- Main info：Name `Image to Base64 Converter`（25/40）/ Tagline `Free private PNG to Base64 converter in your browser`（52/60）/ Link `https://image2base64.com` / Description 186/500。
- Launch tags：**Developer Tools + Design Tools**（PH 无 "Tech" 这个 tag，实际是分类导航项，误以为可选；2 个 tag 达标）。
- Makers：王佳木（当前登录 PH 账号，solo maker，`I worked on this product`）。
- Extras：Pricing = **Free** + **Bootstrapped** 勾选（YC/VC 均否）。
- Images：Thumbnail 1 张 + Gallery 1 张（2 张达标）。「Paste a URL」走原生 prompt 对话框，bsk 自动 accept 空值，og-image 没加成功 → 不强求第 3 张。
- 未做（Strongly Recommended，非必须）：Shoutouts / 首评 / Video / Loom / 更多 Makers —— 发布日可用 Pre-Launch Dashboard 补。
- 发布日行动：PH 的 X / LinkedIn "Copy Link" 在 Pre-Launch Dashboard 右侧，带投票追踪参数，发社交帖时用它。
- 踩坑记录：PH 提交表单真实入口是 `/posts/new?ref=header`（直接 `/posts/new` 被重定向到指南页）；tag 下拉点击后 ref 失效需重新 snapshot；「Tech」是分类不是 tag。

### TAAFT（theresanaiforthat.com）免费路径
- **状态：submitted（2026-09-01）**。官方账号确认为 **@theresanaiforit**（非 @thereisanaiforthat，后者不存在）。
- 免费机制：TAAFT 每月在 X 开一次免费抽选线程（"We'll randomly choose one AI tool to list on TAAFT for FREE!"），评论区一句话推广工具，月末随机抽 1 个免费收录 + newsletter（2.5M 订阅）提及。付费档 $49（Website only）/ $347（Maximum Exposure）。
- **免费抽选线程**：`https://x.com/theresanaiforit/status/2093802183917535502`（8/30 发布，9 月场次）。
- **已提交回复**：`https://x.com/jiamujiamu/status/2094753725512585619`（2026-09-01 13:30 CST 发布）。
  - 内容："Free private PNG to Base64 converter that runs 100% in your browser — no uploads, no account. Convert, copy & download instantly: https://image2base64.com"（154 字符）。
- **技术踩坑（重要）**：X 网页版回复框是 Draft.js 受控编辑器，`bsk fill`/`bsk press` 均无法写入（fill 走 DOM 属性不触发状态同步；press 逐字符 ok 但内容不进）。唯一有效解法 = `document.execCommand('insertText', false, msg)`：先 focus → selectAllChildren + execCommand('delete') 清空 → insertText 写入 → 发布按钮 tweetButtonInline disabled 变 false。插入后页面重渲染，旧 ref 失效需重新 snapshot 再 click。回复列表懒加载，需滚动/展开才渲染，验证回复用 DOM 查 `article` 含站点 URL 最可靠。
- next：9 月底关注抽选结果；未抽中可等下月线程再投一次（免费路径可重复）。

### 行动三：联系渠道
- **done**。`/contact.html`（邮箱 `jeromell@be-winner.com`）已存在并部署线上。各工具页互链已含 contact。

# Image2Base64 SEO Log

Last updated: 2026-09-02 CST

## 2026-08-29 — backlink verification cadence (Wang Yan post)

- takeaway: do not kill a channel at T+1; Ahrefs median first_seen ~8 days. Our I2B64 path is already directory / GitHub / DEV.to, not lifestyle comment spam.
- live check (page still there, not Ahrefs): sitelike.org listing 200; DEV.to article 200; `hilmanski/freeStuffDev#2051` still OPEN (submitted 8/21); `zhaoolee/OnlineToolsBook#23` still OPEN (submitted 8/11); `iRajatDas/awesome-image-tools#5` merged 2026-08-07. Hashnode returned 403 from this machine — do not mark dead.
- next: 2026-09-02 maintenance card only reviews the submitted batch. No new comment-blog campaign. No new format pages.
- cadence note: `~/webcafe/sites/外链核验_王焱20260828对照.md`

## 2026-08-25 — live GSC pull after login

- done: Exported Performance (Web, Last 3 months, chart 2026-06-27→08-22) and Coverage from sc-domain:image2base64.com. Files: `~/Downloads/image2base64.com-Performance-on-Search-2026-08-25.zip`, `~/Downloads/image2base64.com-Coverage-2026-08-25.zip`.
- totals: 191 clicks / 2,980 impressions / 6.4% CTR / pos 61.4. Last 28 days: 140 / 1.9K / 7.4% / 70.3.
- brand query `https://www.image2base64.com/`: 151 / 212 / 71.23% / pos 1 (79% of clicks). Non-brand still 0 clicks.
- http:// homepage still 0 / 71 / 27.39 (frozen since 7/21). Coverage: Alternate canonical **0**; Not indexed = Page with redirect × 2; Indexed 15. HTTPS non-HTTPS URLs = 0. Index-layer merge is done; Performance row is window leftover.
- decode pages unchanged vs 8/16 (best `/base64-to-jpg` 0/42/6.31). `/jpg-to-base64` still 5 clicks / 269 / pos 13.66.
- diagnosis updated: `诊断_GSC复盘_20260825.md` section 0.

## 2026-08-25 — 4-week GSC retrospective vs 2026-07-21 baseline

- checked: Deep compare of on-disk GSC exports (no newer file after 2026-08-16). Diagnosis: `诊断_GSC复盘_20260825.md`.
- Baseline 2026-07-21 Chart (to 2026-07-18): 3 clicks / 743 impressions / CTR 0.40%. Verified by summing Chart.csv.
- Latest 2026-08-16 (to 2026-08-14, Last 3 months): 155 clicks / 1963 impressions. Slice 2026-07-18→08-14 = 152 / 1234. Slice 2026-07-21→08-14 = 144 / 1157.
- 6 decode pages (absent from 7/21 Pages): all present by 7/27. Best ranks at 8/16: `/base64-to-jpg` pos 6.31 / 42 impr / 0 clicks; `/base64-to-jpeg` 8.30 / 37 / 0; `/base64-to-svg` 10.50 / 26 / 0. Ranking loop worked; CTR did not.
- http:// homepage still listed 0 / 71 / pos 27.39 on 7/21, 7/27, 8/11, 8/16 — frozen leftover in the 3-month window. Live `http://` 301s to https. No new http impressions after the baseline. Treat as merged for new traffic.
- Query gaps: no format-page demand (ico/bmp/avif/tiff ≤3). Intent leftovers are viewer/data-uri/js/php (2–6 impr) — thicken existing pages, do not add URLs.
- next: 2026-08-26 GSC check only (title rewrite + www 301 effects). No new pages. 2026-09-02 backlink review unchanged.

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

## 2026-08-29 · AdSense 提审前合规补齐
- Privacy: Advertising 章节补第三方（含 Google）Cookie/web beacon 广告披露 + Google Ads Settings / aboutads.info 退出链接，Last updated → 2026-08-29。git `d135e38`。
- **部署通道确认**：image2base64.com 线上走 **Worker（worker.js + ./dist 静态资产）**，Pages 项目（image2base64-1ya.pages.dev）未挂自定义域。改站后必须：同步 dist 副本 → `cd repo && npx wrangler deploy`。只 push git 不上线。
- 线上已验证：/privacy 新文案 200；/jpeg-to-base64 301→/jpg-to-base64 正常；/ads.txt 200。

## 2026-09-05 · Launchstag 收录提交（Jerome 指派，转来 claim 邮件后执行）
- submitted: Launchstag claim `e8f57bf2-39e4-4b29-bdb1-b3f48a835280`（平台已自动预收录 Image to Base64 Converter，claim 认领制）。
- 验证邮箱口径：先试 `jeromell@be-winner.com`（站点联系邮箱）→ 验证码邮件 45 分钟未同步进 Apple Mail（AppleScript 又被 TCC 卡），**弃用**；改用枢纽 Gmail `jiamu970214@gmail.com` 收码完成验证（服务器 Gmail API 现成通道）。**listing 账号归属 = 枢纽 Gmail**。
- 表单内容：Name `Jerome`；Product name 平台预填 `Image to Base64 Converter`；URL 平台预填 `https://image2base64.com/`（首页）；Tagline 改写为 `Free image to Base64 converter — PNG, JPG, GIF, WebP, SVG. No upload, 100% in-browser.`（86/100，原 AI 预填只提 PNG，与首页主词不符）；Description 360 字符（100% in-browser / no upload / 多格式双向卖点）；分类 3/4：Developer Tools + Design + SEO；Pricing `Free`；Launch date 2026-09-29（免费排队槽，提交后系统显示排期 **2026-10-04**）。
- Logo：上传 `icon-512.png`（33KB）。IAB 文件选择器不支持，走 Computer Use + 原生 Open 面板（期间授了一次 ZCode Computer Use 屏幕控制 TCC 权限）。
- **徽章（Free 方案 dofollow 条件）**：`badge-light.svg` 198×62 加进首页 footer 版权行上方（`index.html` + dist 同步 + `npx wrangler deploy`，commit `a56b5e1`）；线上验证首页 HTML 含 launchstag 徽章后点 Verify → **✓ Badge verified，listing 排期 2026-10-04 上线**。
- Listing 页：`https://launchstag.com/p/image-to-base64-converter`（已 200，标题正确）。
- 备注：付费档（Premium $15 首页 7 天 / Growth $29）未购买，按免费排队走。Premium 免徽章 + 提前排期，若 10/4 前想要更早上线再议。

## 2026-09-05（下午）— GSC 挂载实测 + Agent 首次 GSC 读数
- bsk 后台实测：seo.web.cafe「GSC 数据」面板里 image2base64.com **早已挂载**（6/27~8/31，66 天，点击 147 / 曝光 2,072）；「连接 GSC 只读授权」通道**站点未开放**（"授权通道暂未开通"）→ 数据通道 = 手动上传月度 xlsx
- 验证提问跑通（13 积分）：Agent gsc_report 完整读数。关键结论：
  - 点击 100% 来自品牌词（https://www.image2base64.com/ 查询 183/254），7→8 月 +90.9% 为外部引流假涨，非品牌 SEO 流量 = 0
  - **P0 = 刚补强的两页**：/base64-to-png 19.5 位（480/KD32.4，前十全是 DR2~9 弱站）、/png-to-base64 22.5 位（720/41.8）——推一把就进前十
  - /base64-to-jpg 6.3 位 0 点击待查 query 明细；http 旧版 71 曝光 = 301 正常的历史残留
  - 监控口径改为「非品牌词曝光 + 平均位置」
- 月度自动化 prompt 已按实测修订（GSC 走库内上传数据 + 数据窗口未覆盖时报告"X 月未上传"，不冒充闸门判定）
- 操作清单更新：`~/webcafe/marketing/manual-ops-checklist-2026-09-05.md`

## 2026-09-05（晚）— P0 修复批：全站内链 404 Bug + base64-to-png 扩写
- **P0 内链 Bug（curl 实锤后修复）**：全站 24 页 ~570 处「More tools/正文」内链缺前导 `/`（如 href="png-to-base64"），浏览器解析成子路径 404（/base64-to-png/png-to-base64 实测 404）。perl 批量改为根相对 href="/xxx"；styles.css 与 mailto 保持相对不动
- **base64-to-png 正文 560→1226 词**：按 Agent 体检提纲补 How-to 3 步 / Base64 vs data URI（含 iVBOR、/9j/ 签名、33% 膨胀）/ 格式对比（内链 /base64-to-jpg、/base64-to-webp、/base64-to-image、/png-to-base64）/ JS·Python·C#·PowerShell 四段解码代码（对应 Google 相关搜索）/ FAQ 3→6 条（HTML details + FAQPage JSON-LD 同步）
- **description 换精确词打头**："Free base64 to PNG converter: decode a base64 string or data URI into a transparent PNG..."（词命中 67%→100%）
- **png-to-base64 Title 61→59 字符**（and→&）
- 部署 Version `3a4b39d7-7b77-4dc3-a2bd-a59681d7f826`；上线验证：base64-to-png 3×根相对链+新 desc+代码块、png title、svg 页根相对链、check_seo fail=0（2 jpg/jpeg warn 属预期）
- 依据：哥飞 SEO Agent 两页体检（onpage_audit 75/98 分 + SERP 解密），报告存 ~/webcafe/marketing/onpage-audit-p0-pages-2026-09-05.md
- 后续观察：1~2 周看 GSC 曝光，base64-to-png 平均位 19.5 → 15 位内 = 方向对；10/5 自动化复核
