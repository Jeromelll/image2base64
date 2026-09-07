/**
 * Production Worker for image2base64.com (Workers + static assets).
 * Pages _redirects is not applied here — keep redirects in this file.
 *
 * Privacy-first analytics via D1 (DB binding):
 *  - POST /api/evt accepts small same-origin page-view and interaction events from app.js.
 *  No cookies, no IP storage, no PII, no file contents.
 */
const REDIRECTS = new Map([
  ["/jpeg-to-base64", "/jpg-to-base64"],
  ["/jpeg-to-base64/", "/jpg-to-base64"],
  ["/base64-to-jpeg", "/base64-to-jpg"],
  ["/base64-to-jpeg/", "/base64-to-jpg"],
]);

const BLOCKED_PREFIXES = ["/.git", "/.claude", "/.wrangler", "/node_modules"];
const BLOCKED_EXACT = new Set([
  "/wrangler.toml",
  "/worker.js",
  "/.gitignore",
  "/package.json",
  "/package-lock.json",
]);

// Only these client event names are accepted.
const EVENT_NAMES = new Set(["page_view", "convert", "copy", "decode", "download", "error", "sample", "compress", "calc", "credit", "extract"]);

function deviceType(ua) {
  if (!ua) return "unknown";
  if (/iPad|Tablet/i.test(ua)) return "tablet";
  if (/Mobi|Android|iPhone/i.test(ua)) return "mobile";
  return "desktop";
}

function clip(v, n) {
  return String(v == null ? "" : v).slice(0, n);
}

async function logEvent(env, name, page, x1, x2, country, device, referrer) {
  try {
    if (!env.DB) return;
    await env.DB.prepare(
      "INSERT INTO events (name, page, x1, x2, country, device, referrer) VALUES (?, ?, ?, ?, ?, ?, ?)"
    )
      .bind(clip(name, 24), clip(page, 120), clip(x1, 60), clip(x2, 60), clip(country, 4), clip(device, 10), clip(referrer, 180))
      .run();
  } catch (e) {
    // analytics must never break the site
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    if (BLOCKED_EXACT.has(path) || BLOCKED_PREFIXES.some((p) => path === p || path.startsWith(p + "/"))) {
      return new Response("Not Found", { status: 404 });
    }

    // Interaction events from app.js: { e: name, p: page, x1, x2 }
    if (request.method === "POST" && path === "/api/evt") {
      let d = {};
      try {
        d = await request.json();
      } catch (e) {}
      const name = clip(d.e, 24);
      if (EVENT_NAMES.has(name)) {
        await logEvent(
          env,
          name,
          clip(d.p, 120),
          clip(d.x1, 60),
          clip(d.x2, 60),
          request.cf && request.cf.country,
          deviceType(request.headers.get("user-agent")),
          request.headers.get("referer")
        );
      }
      return new Response(null, { status: 204 });
    }

    const dest = REDIRECTS.get(path);
    if (dest) {
      const target = new URL(dest, url.origin);
      target.search = url.search;
      return Response.redirect(target, 301);
    }

    return env.ASSETS.fetch(request);
  },
};
