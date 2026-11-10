import test from "node:test";
import assert from "node:assert/strict";
import worker from "../worker.js";

test("format aliases redirect and private files stay hidden", async () => {
  const jpeg = await worker.fetch(new Request("https://image2base64.com/jpeg-to-base64?x=1"));
  assert.equal(jpeg.status, 301);
  assert.equal(jpeg.headers.get("location"), "https://image2base64.com/jpg-to-base64?x=1");

  const slash = await worker.fetch(new Request("https://image2base64.com/base64-to-jpeg/"));
  assert.equal(slash.status, 301);
  assert.equal(slash.headers.get("location"), "https://image2base64.com/base64-to-jpg");

  const home = await worker.fetch(new Request("https://image2base64.com/image-to-base64"));
  assert.equal(home.status, 301);
  assert.equal(new URL(home.headers.get("location")).pathname, "/");

  const hidden = await worker.fetch(new Request("https://image2base64.com/.git/config"));
  assert.equal(hidden.status, 404);
  assert.equal(await hidden.text(), "Not Found");

  const config = await worker.fetch(new Request("https://image2base64.com/wrangler.toml"));
  assert.equal(config.status, 404);
  assert.equal(await config.text(), "Not Found");
});

test("unknown analytics events return 204 and do not write", async () => {
  const env = { DB: { prepare() { throw new Error("analytics write"); } } };
  const ignored = await worker.fetch(new Request("https://image2base64.com/api/evt", {
    method: "POST",
    headers: { "content-type": "application/json", "user-agent": "image2base64-deploy-probe" },
    body: JSON.stringify({ e: "ci-probe", p: "/ci" }),
  }), env);
  assert.equal(ignored.status, 204);
  assert.equal(await ignored.text(), "");

  const malformed = await worker.fetch(new Request("https://image2base64.com/api/evt", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "{",
  }), env);
  assert.equal(malformed.status, 204);
  assert.equal(await malformed.text(), "");
});
