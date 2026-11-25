// Headless Chrome driver for the static site. Uses the system Chrome and
// Node's WebSocket so `node --test` needs no extra packages.
import { createServer } from "node:http";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { extname, join, normalize, sep } from "node:path";
import { spawn } from "node:child_process";

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".xml": "application/xml",
  ".txt": "text/plain; charset=utf-8",
  ".webmanifest": "application/manifest+json",
};

function chromeBin() {
  const candidates = [
    process.env.CHROME_PATH,
    "/usr/local/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
    "/usr/bin/google-chrome",
  ].filter(Boolean);
  const found = candidates.find((path) => existsSync(path));
  if (!found) throw new Error("Chrome not found. Set CHROME_PATH.");
  return found;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function messageText(data) {
  if (typeof data === "string") return data;
  if (data instanceof ArrayBuffer) return Buffer.from(data).toString("utf8");
  if (ArrayBuffer.isView(data)) return Buffer.from(data.buffer, data.byteOffset, data.byteLength).toString("utf8");
  if (data && typeof data.text === "function") return data.text();
  return String(data);
}

function connectWs(url) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    const timer = setTimeout(() => reject(new Error("WebSocket timed out: " + url)), 10000);
    ws.addEventListener("open", () => {
      clearTimeout(timer);
      resolve(ws);
    });
    ws.addEventListener("error", () => {
      clearTimeout(timer);
      reject(new Error("WebSocket failed: " + url));
    });
  });
}

class Cdp {
  constructor(ws) {
    this.ws = ws;
    this.next = 0;
    this.pending = new Map();
    this.listeners = [];
    ws.addEventListener("message", (event) => {
      messageText(event.data).then((text) => {
        const msg = JSON.parse(text);
        if (msg.id && this.pending.has(msg.id)) {
          const { resolve, reject } = this.pending.get(msg.id);
          this.pending.delete(msg.id);
          if (msg.error) reject(new Error(msg.error.message || JSON.stringify(msg.error)));
          else resolve(msg.result || {});
        } else if (msg.method) {
          for (const listener of this.listeners) listener(msg);
        }
      }).catch((error) => {
        for (const { reject } of this.pending.values()) reject(error);
        this.pending.clear();
      });
    });
    ws.addEventListener("close", () => {
      for (const { reject } of this.pending.values()) reject(new Error("Chrome socket closed"));
      this.pending.clear();
    });
  }

  send(method, params = {}) {
    const id = ++this.next;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  waitForEvent(method, timeout = 10000) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.listeners = this.listeners.filter((item) => item !== onEvent);
        reject(new Error("timed out waiting for " + method));
      }, timeout);
      const onEvent = (msg) => {
        if (msg.method !== method) return;
        clearTimeout(timer);
        this.listeners = this.listeners.filter((item) => item !== onEvent);
        resolve(msg.params || {});
      };
      this.listeners.push(onEvent);
    });
  }

  close() {
    this.ws.close();
  }
}

function startServer(root) {
  const rootPrefix = root.endsWith(sep) ? root : root + sep;
  const server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url || "/", "http://127.0.0.1");
      let pathname = decodeURIComponent(url.pathname);
      if (pathname === "/") pathname = "/index.html";
      const file = normalize(join(root, pathname));
      if (file !== root && !file.startsWith(rootPrefix)) {
        res.writeHead(403);
        res.end("Forbidden");
        return;
      }
      const body = await readFile(file);
      res.writeHead(200, { "content-type": TYPES[extname(file)] || "application/octet-stream" });
      res.end(body);
    } catch {
      res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
      res.end("Not Found");
    }
  });
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve(server));
  });
}

async function waitForDevtools(profile, chrome) {
  const file = join(profile, "DevToolsActivePort");
  const started = Date.now();
  while (Date.now() - started < 15000) {
    if (chrome.exitCode != null) {
      throw new Error("Chrome exited early: " + (chrome.stderrText || ""));
    }
    try {
      const text = await readFile(file, "utf8");
      const port = Number(text.split("\n")[0]);
      if (port) return port;
    } catch { /* port file appears after startup */ }
    await sleep(50);
  }
  throw new Error("Chrome did not open a DevTools port. " + (chrome.stderrText || ""));
}

class Page {
  constructor(cdp, origin, targetId, browser) {
    this.cdp = cdp;
    this.origin = origin;
    this.targetId = targetId;
    this.browser = browser;
    this.mobile = false;
  }

  async goto(pathname) {
    const loaded = this.cdp.waitForEvent("Page.domContentEventFired", 15000);
    const nav = await this.cdp.send("Page.navigate", { url: this.origin + pathname });
    if (nav.errorText) throw new Error(pathname + " " + nav.errorText);
    await loaded;
    if (this.mobile) await this.setMobile();
    await this.waitFor(
      () => document.readyState !== "loading",
      "page stayed in the loading state: " + pathname
    );
  }

  async setMobile() {
    this.mobile = true;
    await this.cdp.send("Emulation.setDeviceMetricsOverride", {
      width: 390,
      height: 844,
      deviceScaleFactor: 2,
      mobile: true,
    });
  }

  async evaluate(fn, ...args) {
    const expression = `(() => {\nconst fn = ${fn.toString()};\nreturn fn(${args.map((arg) => JSON.stringify(arg)).join(", ")});\n})()`;
    const result = await this.cdp.send("Runtime.evaluate", {
      expression,
      awaitPromise: true,
      returnByValue: true,
    });
    if (result.exceptionDetails) {
      const exception = result.exceptionDetails.exception;
      const description = exception && (exception.description || exception.value);
      throw new Error((result.exceptionDetails.text || "page exception") + (description ? ": " + description : ""));
    }
    return result.result ? result.result.value : undefined;
  }

  async waitFor(fn, reason, timeout = 8000) {
    const started = Date.now();
    let last;
    while (Date.now() - started < timeout) {
      last = await this.evaluate(fn);
      if (last) return last;
      await sleep(40);
    }
    throw new Error((reason || "condition was not met") + "; last=" + JSON.stringify(last));
  }

  async focus(selector) {
    const active = await this.evaluate((sel) => {
      const el = document.querySelector(sel);
      if (!el) return "";
      el.focus();
      return document.activeElement === el ? (el.id || el.getAttribute("data-copy") || el.tagName) : "";
    }, selector);
    if (!active) throw new Error("keyboard focus did not land on " + selector);
    return active;
  }

  async pressEnter() {
    const key = {
      key: "Enter",
      code: "Enter",
      windowsVirtualKeyCode: 13,
      nativeVirtualKeyCode: 13,
      text: "\r",
      unmodifiedText: "\r",
    };
    await this.cdp.send("Input.dispatchKeyEvent", { type: "keyDown", ...key });
    await this.cdp.send("Input.dispatchKeyEvent", { type: "keyUp", ...key });
  }

  async insertText(text) {
    await this.cdp.send("Input.insertText", { text });
  }

  async armFileChooser() {
    await this.cdp.send("Page.setInterceptFileChooserDialog", { enabled: true });
  }

  waitFileChooser() {
    return this.cdp.waitForEvent("Page.fileChooserOpened", 5000);
  }

  async chooseFiles(backendNodeId, files) {
    await this.cdp.send("DOM.setFileInputFiles", { backendNodeId, files });
  }

  async close() {
    try { await this.browser.send("Target.closeTarget", { targetId: this.targetId }); } catch { /* already gone */ }
    this.cdp.close();
  }
}

export async function launchSite(root) {
  const server = await startServer(root);
  const address = server.address();
  const origin = "http://127.0.0.1:" + address.port;
  const profile = await mkdtemp(join(tmpdir(), "i2b64-chrome-"));
  const chrome = spawn(chromeBin(), [
    "--headless=new",
    "--disable-gpu",
    "--no-sandbox",
    "--disable-dev-shm-usage",
    "--remote-debugging-port=0",
    "--user-data-dir=" + profile,
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-extensions",
    "--disable-background-networking",
    "about:blank",
  ], { stdio: ["ignore", "ignore", "pipe"] });
  chrome.stderrText = "";
  chrome.stderr.on("data", (buf) => {
    chrome.stderrText = (chrome.stderrText + buf.toString()).slice(-4000);
  });
  const port = await waitForDevtools(profile, chrome);
  const version = await fetch("http://127.0.0.1:" + port + "/json/version").then((res) => res.json());
  const browser = new Cdp(await connectWs(version.webSocketDebuggerUrl));
  await browser.send("Browser.grantPermissions", {
    origin,
    permissions: ["clipboardReadWrite", "clipboardSanitizedWrite"],
  });

  return {
    origin,
    async open(pathname, options = {}) {
      const created = await browser.send("Target.createTarget", { url: "about:blank" });
      const list = await fetch("http://127.0.0.1:" + port + "/json/list").then((res) => res.json());
      const info = list.find((item) => item.id === created.targetId);
      if (!info || !info.webSocketDebuggerUrl) throw new Error("Chrome target has no page socket");
      const page = new Page(new Cdp(await connectWs(info.webSocketDebuggerUrl)), origin, created.targetId, browser);
      await page.cdp.send("Page.enable");
      await page.cdp.send("Runtime.enable");
      if (options.mobile) await page.setMobile();
      await page.goto(pathname);
      return page;
    },
    async close() {
      browser.close();
      if (chrome.exitCode == null) {
        chrome.kill("SIGKILL");
        await new Promise((resolve) => {
          chrome.once("exit", resolve);
          setTimeout(resolve, 2000);
        });
      }
      await new Promise((resolve) => server.close(resolve));
      for (let attempt = 0; attempt < 5; attempt++) {
        try {
          await rm(profile, { recursive: true, force: true });
          return;
        } catch {
          await sleep(100);
        }
      }
    },
  };
}
