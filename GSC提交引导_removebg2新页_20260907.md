# GSC 手动提交引导 — remove.bg 事件 2 新页（2026-09-07）

> 背景：今日上线 remove.bg 关停事件 2 个内容页（wrangler Version `a0936ca3`，线上已验证 200 + canonical 自指 + sitemap 含 2 新 URL）。AI 无法替你做 GSC 提交（需要你的 Google 登录态），以下 2 分钟手动流程。时效页收录速度直接决定能否吃到 12/1 关停峰值，建议今天完成。

## 第一步：URL 检查逐个加速收录（2 个 URL，约 1.5 分钟）

对下面每个 URL 重复同一操作：

```
https://image2base64.com/remove-bg-alternatives
https://image2base64.com/remove-bg-shutting-down
```

1. GSC 顶部搜索框粘贴 URL → 回车，等检查完成（10-20 秒）
2. 显示「网址不在 Google 上」= 正常（新页）
3. 点 **「请求编入索引（REQUEST INDEXING）」** → 等约 1 分钟 → 「已请求编入索引」即可
4. 换下一个 URL 重复

**注意**：
- URL 检查每日配额约 10-12 次，2 个完全够用（若今天已提交过 3 个选词新页，合计 5 次仍在配额内）
- sitemap.xml 已含 30 个 URL（含本次 2 新页），Google 会按周期重抓，无需重复提交 sitemap

## 部署事实（已由 AI 核验，无需重查）

| 项 | 状态 |
|---|---|
| 2 页线上 200 + canonical 自指 | ✅ curl -L 已核 |
| sitemap 30 locs 含 2 个新 URL | ✅ 线上已抓到 |
| 全站 30 旧页 footer Guides 栏含 2 新链接 | ✅ 抽查已核 |
| check_seo_consistency | ✅ ok=92 warn=2 fail=0 |

## 监控建议（本次为事件驱动，不同于日常选词页）

- **每周**看两页在 `remove.bg alternative` / `remove.bg shutting down` 等词的 impressions 变化（GSC → 效果 → 查询）
- **11 月下旬**：AI 会按 SEO_LOG 排期更新两页为倒计时口径
- **12 月 1 日当周**：每日看 GSC，品牌替代词峰值就在那几天
