// Post-deploy probe for the public site. No credentials. Exits non-zero on failure.
const ORIGIN = (process.env.PROBE_ORIGIN || "https://image2base64.com").replace(/\/$/, "");
const ATTEMPTS = 4;
const REQUEST_TIMEOUT_MS = 10000;
const RETRY_DELAY_MS = 5000;
const TOTAL_BUDGET_MS = 90000;
const USER_AGENT = "image2base64-deploy-probe";

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function request(path, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(ORIGIN + path, {
      method: options.method || "GET",
      redirect: "manual",
      headers: { "user-agent": USER_AGENT, ...(options.headers || {}) },
      body: options.body,
      signal: controller.signal,
    });
    const body = await response.text();
    return { status: response.status, headers: response.headers, body };
  } catch (error) {
    const reason = error && error.name === "AbortError" ? "timed out" : (error && error.message) || String(error);
    throw new Error(ORIGIN + path + " " + reason);
  } finally {
    clearTimeout(timer);
  }
}

function assertIncludes(url, body, marker) {
  if (!body.includes(marker)) {
    throw new Error(url + " missing " + JSON.stringify(marker) + " snippet=" + JSON.stringify(body.slice(0, 160)));
  }
}

function assertType(url, headers, expected) {
  const type = headers.get("content-type") || "";
  if (!type.toLowerCase().includes(expected)) {
    throw new Error(url + " content-type " + JSON.stringify(type) + " does not include " + expected);
  }
}

async function assertPage(path, markers, type) {
  const res = await request(path);
  if (res.status !== 200) throw new Error(path + " status " + res.status + ", expected 200");
  assertType(path, res.headers, type);
  for (const marker of markers) assertIncludes(path, res.body, marker);
}

async function assertRedirect(path, expectedPath, expectedSearch = "") {
  const res = await request(path);
  if (res.status !== 301) throw new Error(path + " status " + res.status + ", expected 301");
  const location = res.headers.get("location") || "";
  let target;
  try {
    target = new URL(location, ORIGIN);
  } catch {
    throw new Error(path + " location " + JSON.stringify(location) + " is not a URL");
  }
  if (target.origin !== ORIGIN || target.pathname !== expectedPath || target.search !== expectedSearch) {
    throw new Error(path + " redirected to " + location + ", expected " + expectedPath + expectedSearch);
  }
}

async function runChecks() {
  await assertPage("/", ['id="drop"', 'src="app.js"', "<h1>"], "text/html");
  await assertPage("/png-to-base64", ['id="drop"', 'data-accept="png"', 'src="app.js"'], "text/html");
  await assertPage("/jpg-to-base64", ['id="drop"', 'data-accept="jpeg"', 'src="app.js"'], "text/html");
  await assertPage("/gif-to-base64", ['data-accept="gif"', 'src="app.js"'], "text/html");
  await assertPage("/webp-to-base64", ['data-accept="webp"', 'src="app.js"'], "text/html");
  await assertPage("/svg-to-base64", ['data-accept="svg"', 'src="app.js"'], "text/html");
  await assertPage("/base64-to-image", ['id="b64-input"', 'id="decode"', 'src="app.js"'], "text/html");
  await assertPage("/app.js", ["readAsDataURL", "function initEncoder"], "javascript");
  await assertPage("/styles.css", [".dropzone{"], "css");
  await assertPage("/sitemap.xml", ["https://image2base64.com/png-to-base64"], "xml");
  await assertPage("/robots.txt", ["Sitemap: https://image2base64.com/sitemap.xml"], "text/plain");

  await assertRedirect("/jpeg-to-base64?x=1", "/jpg-to-base64", "?x=1");
  await assertRedirect("/base64-to-jpeg", "/base64-to-jpg");

  const hidden = await request("/.git/config");
  if (hidden.status !== 404) throw new Error("/.git/config status " + hidden.status + ", expected 404");
  if (hidden.body !== "Not Found") {
    throw new Error("/.git/config body " + JSON.stringify(hidden.body.slice(0, 120)) + ', expected "Not Found"');
  }

  const getEvt = await request("/api/evt");
  if (getEvt.status !== 404) throw new Error("GET /api/evt status " + getEvt.status + ", expected 404");
  if (getEvt.body.includes('id="drop"')) throw new Error("GET /api/evt returned the converter page");

  const postEvt = await request("/api/evt", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ e: "ci-probe", p: "/ci" }),
  });
  if (postEvt.status !== 204) throw new Error("POST /api/evt status " + postEvt.status + ", expected 204");
  if (postEvt.body !== "") throw new Error("POST /api/evt body was not empty");

  const badEvt = await request("/api/evt", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "{",
  });
  if (badEvt.status !== 204) throw new Error("POST /api/evt malformed status " + badEvt.status + ", expected 204");
  if (badEvt.body !== "") throw new Error("POST /api/evt malformed body was not empty");
}

const started = Date.now();
let lastError = null;
for (let attempt = 1; attempt <= ATTEMPTS; attempt += 1) {
  if (Date.now() - started > TOTAL_BUDGET_MS) break;
  try {
    await runChecks();
    console.log("probe ok origin=" + ORIGIN + " attempt=" + attempt);
    process.exit(0);
  } catch (error) {
    lastError = error;
    console.error("probe attempt " + attempt + " failed: " + (error && error.message ? error.message : error));
    const remaining = TOTAL_BUDGET_MS - (Date.now() - started);
    if (attempt === ATTEMPTS || remaining < RETRY_DELAY_MS) break;
    await sleep(RETRY_DELAY_MS);
  }
}
console.error("probe failed origin=" + ORIGIN);
if (lastError) console.error(lastError && lastError.stack ? lastError.stack : lastError);
process.exit(1);
