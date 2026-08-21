/**
 * Production Worker for image2base64.com (Workers + static assets).
 * Pages _redirects is not applied here — keep redirects in this file.
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

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    if (BLOCKED_EXACT.has(path) || BLOCKED_PREFIXES.some((p) => path === p || path.startsWith(p + "/"))) {
      return new Response("Not Found", { status: 404 });
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
