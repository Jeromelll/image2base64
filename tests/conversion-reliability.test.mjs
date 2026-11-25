// Functional checks for the live converter pages.
// Ideas reused from the unmerged PR #11 smoke (round-trip bytes and specific
// decoder errors) live here on purpose: main has no tests/image-convert.test.mjs,
// and this file does not take that name or export PR #11's conversion module.
import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { launchSite } from "./page-browser.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const fixtureDir = join(dirname(fileURLToPath(import.meta.url)), "fixtures");

function fixture(name) {
  const bytes = readFileSync(join(fixtureDir, name));
  return bytes.toString("base64");
}

const SAMPLES = [
  { file: "tiny.png", name: "tiny.png", type: "image/png", mime: "image/png", ext: "png" },
  { file: "tiny.jpg", name: "tiny.jpg", type: "image/jpeg", mime: "image/jpeg", ext: "jpg" },
  { file: "tiny.gif", name: "tiny.gif", type: "image/gif", mime: "image/gif", ext: "gif" },
  { file: "tiny.webp", name: "tiny.webp", type: "image/webp", mime: "image/webp", ext: "webp" },
  { file: "tiny.svg", name: "tiny.svg", type: "image/svg+xml", mime: "image/svg+xml", ext: "svg" },
].map((sample) => ({ ...sample, base64: fixture(sample.file) }));

let site;

before(async () => {
  site = await launchSite(root);
});

after(async () => {
  if (site) await site.close();
});

function readEncodeState() {
  const err = document.querySelector("#enc-error");
  const out = document.querySelector("#out-datauri");
  const results = document.querySelector("#results");
  const error = err && !err.hidden ? err.textContent : "";
  const ready = !!(results && !results.hidden && out && out.value.indexOf("data:") === 0);
  // A format mismatch shows its note before FileReader finishes. Keep waiting
  // for the result instead of treating that note as a final failure.
  if (!ready && (!error || error.indexOf("Heads up:") === 0)) return null;
  const value = out ? out.value : "";
  const comma = value.indexOf(",");
  const semi = value.indexOf(";");
  return {
    error,
    ready,
    dataUri: value,
    raw: comma >= 0 ? value.slice(comma + 1) : "",
    mime: semi > 5 ? value.slice(5, semi) : "",
    name: (document.querySelector("#m-name") || {}).textContent || "",
    type: (document.querySelector("#m-type") || {}).textContent || "",
  };
}

function readDecodeState() {
  const err = document.querySelector("#dec-error");
  const results = document.querySelector("#dec-results");
  const img = document.querySelector("#decoded-img");
  const link = document.querySelector("#download");
  const error = err && !err.hidden ? err.textContent : "";
  const ready = !!(results && !results.hidden && img && img.complete && img.naturalWidth > 0 && link && link.href.indexOf("blob:") === 0);
  if (!ready && !error) return null;
  return {
    error,
    ready,
    width: img ? img.naturalWidth : 0,
    height: img ? img.naturalHeight : 0,
    download: link ? (link.getAttribute("download") || "") : "",
  };
}

async function chooseImage(page, spec) {
  return page.evaluate((item) => {
    let parts;
    if (item.huge) parts = [new Uint8Array(15 * 1024 * 1024 + 1)];
    else if (item.empty) parts = [];
    else {
      const binary = atob(item.base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      parts = [bytes];
    }
    const file = new File(parts, item.name, { type: item.type || "" });
    const transfer = new DataTransfer();
    transfer.items.add(file);
    if (item.via === "drop") {
      document.querySelector("#drop").dispatchEvent(new DragEvent("drop", { bubbles: true, cancelable: true, dataTransfer: transfer }));
    } else {
      const input = document.querySelector("#file");
      input.files = transfer.files;
      input.dispatchEvent(new Event("change", { bubbles: true }));
    }
    return { type: file.type, size: file.size };
  }, spec);
}

async function encode(page, spec) {
  const reported = await chooseImage(page, spec);
  const state = await page.waitFor(readEncodeState, spec.name + " produced neither a data URI nor an error");
  return { reported, state };
}

test("PNG, JPEG, GIF, WebP, and SVG round-trip through encode and decode", { timeout: 120000 }, async () => {
  for (const sample of SAMPLES) {
    const encoder = await site.open("/");
    try {
      const { reported, state } = await encode(encoder, sample);
      assert.equal(reported.type, sample.type, sample.file + " browser File.type was rewritten before the page saw it");
      assert.equal(state.error, "", sample.file + " encoder showed an error: " + state.error);
      assert.equal(state.ready, true, sample.file + " encoder did not reveal a result");
      assert.equal(state.mime, sample.mime, sample.file + " data URI MIME is wrong");
      assert.equal(state.raw, sample.base64, sample.file + " Base64 body is not the original file bytes");
      assert.equal(state.type, sample.mime, sample.file + " result type label is wrong");

      const decoder = await site.open("/base64-to-image.html");
      try {
        await decoder.evaluate((uri) => {
          document.querySelector("#b64-input").value = uri;
          document.querySelector("#decode").click();
        }, state.dataUri);
        const decoded = await decoder.waitFor(readDecodeState, sample.file + " decoder did not preview the image or show an error");
        assert.equal(decoded.error, "", sample.file + " decoder error: " + decoded.error);
        assert.equal(decoded.ready, true, sample.file + " decoder did not show a preview");
        assert.ok(decoded.width > 0 && decoded.height > 0, sample.file + " preview has no dimensions");
        assert.equal(decoded.download, "decoded." + sample.ext, sample.file + " download filename is wrong");
        const downloaded = await decoder.evaluate(async () => {
          const response = await fetch(document.querySelector("#download").href);
          const buf = new Uint8Array(await response.arrayBuffer());
          let binary = "";
          for (let i = 0; i < buf.length; i += 0x8000) {
            binary += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000));
          }
          return btoa(binary);
        });
        assert.equal(downloaded, sample.base64, sample.file + " downloaded bytes differ from the original file");
      } finally {
        await decoder.close();
      }
    } finally {
      await encoder.close();
    }
  }
});

test("empty files, non-images, and files over 15 MB show specific errors", { timeout: 60000 }, async () => {
  const page = await site.open("/");
  try {
    const empty = await encode(page, { empty: true, name: "empty.png", type: "image/png" });
    assert.equal(empty.state.ready, false, "an empty file must not produce a data URI");
    assert.equal(empty.state.error, "This file is empty. Choose an image that contains data.", "empty-file error copy");

    const illegal = await encode(page, { base64: btoa("hello"), name: "notes.txt", type: "text/plain" });
    assert.equal(illegal.state.ready, false, "a text file must not produce a data URI");
    assert.equal(
      illegal.state.error,
      "That doesn't look like an image file. Please choose a PNG, JPG, GIF, WebP, SVG, TIFF, BMP or HEIC.",
      "non-image error copy"
    );

    const huge = await encode(page, { huge: true, name: "big.png", type: "image/png" });
    assert.equal(huge.reported.size, 15 * 1024 * 1024 + 1, "oversize fixture was not actually over 15 MB");
    assert.equal(huge.state.ready, false, "a file over 15 MB must not be encoded");
    assert.equal(huge.state.error, "This file is over the 15 MB limit. Choose a smaller image.", "oversize error copy");
  } finally {
    await page.close();
  }
});

test("missing and non-standard image types still encode the claimed formats", { timeout: 60000 }, async () => {
  const page = await site.open("/");
  try {
    const png = SAMPLES[0];
    const octet = await encode(page, { ...png, name: "pixel.png", type: "application/octet-stream" });
    assert.equal(octet.reported.type, "application/octet-stream", "test did not keep the empty-ish PNG MIME");
    assert.equal(octet.state.error, "", "octet-stream PNG was rejected: " + octet.state.error);
    assert.equal(octet.state.mime, "image/png", "octet-stream PNG data URI MIME");
    assert.equal(octet.state.raw, png.base64, "octet-stream PNG bytes changed");

    const jpeg = SAMPLES[1];
    const jpg = await encode(page, { ...jpeg, name: "photo.jpg", type: "image/jpg" });
    assert.equal(jpg.reported.type, "image/jpg", "test did not keep the non-standard JPEG MIME");
    assert.equal(jpg.state.mime, "image/jpeg", "image/jpg was not normalized to image/jpeg");
    assert.equal(jpg.state.raw, jpeg.base64, "image/jpg bytes changed");

    const svg = SAMPLES[4];
    const xml = await encode(page, { ...svg, name: "icon.svg", type: "text/xml" });
    assert.equal(xml.reported.type, "text/xml", "test did not keep the SVG text/xml MIME");
    assert.equal(xml.state.error, "", "text/xml SVG was rejected: " + xml.state.error);
    assert.equal(xml.state.mime, "image/svg+xml", "text/xml SVG data URI MIME");
    assert.equal(xml.state.raw, svg.base64, "text/xml SVG bytes changed");

    const heic = await encode(page, { ...png, name: "shot.heic", type: "" });
    assert.equal(heic.state.error, "", "empty-type HEIC was rejected: " + heic.state.error);
    assert.equal(heic.state.mime, "image/heic", "empty-type HEIC lost its extension fallback");
  } finally {
    await page.close();
  }
});

test("a different format on the PNG page warns and still converts", { timeout: 60000 }, async () => {
  const page = await site.open("/png-to-base64.html");
  try {
    const jpeg = SAMPLES[1];
    const state = (await encode(page, { ...jpeg, via: "drop" })).state;
    assert.equal(state.ready, true, "JPEG on the PNG page should still convert");
    assert.equal(state.mime, "image/jpeg", "JPEG on the PNG page changed MIME");
    assert.equal(state.raw, jpeg.base64, "JPEG on the PNG page changed bytes");
    assert.equal(
      state.error,
      "Heads up: this is a image/jpeg file, but the converter handles it the same way.",
      "format-page type note"
    );
  } finally {
    await page.close();
  }
});

test("decoder rejects empty, illegal, and non-image input with specific copy", { timeout: 60000 }, async () => {
  const page = await site.open("/base64-to-image.html");
  try {
    const cases = [
      ["", "Paste a Base64 string or data URI first."],
      ["   \n  ", "Paste a Base64 string or data URI first."],
      ["****", "The input contains characters that are not valid Base64."],
      ["data:image/png," + encodeURIComponent("<svg></svg>"), "Use a Base64 data URI. URL-encoded data URIs are not supported here."],
      [btoa("hello"), "This Base64 data does not appear to contain a supported image."],
    ];
    for (const [value, expected] of cases) {
      await page.evaluate((input) => {
        document.querySelector("#b64-input").value = input;
        document.querySelector("#decode").click();
      }, value);
      const state = await page.waitFor(readDecodeState, "decoder stayed silent for " + JSON.stringify(value.slice(0, 40)));
      assert.equal(state.ready, false, "invalid input must not show a download: " + expected);
      assert.equal(state.error, expected, "decoder error copy for " + JSON.stringify(value.slice(0, 40)));
    }
  } finally {
    await page.close();
  }
});

test("copy writes the data URI, and a denied clipboard downloads it instead", { timeout: 60000 }, async () => {
  const page = await site.open("/");
  try {
    const png = SAMPLES[0];
    const encoded = await encode(page, png);
    assert.equal(encoded.state.raw, png.base64, "copy fixture did not encode");

    await page.evaluate(() => {
      window.__downloads = [];
      const original = HTMLAnchorElement.prototype.click;
      HTMLAnchorElement.prototype.click = function () {
        if (this.download) window.__downloads.push({ name: this.download, href: this.href });
        return original.apply(this, arguments);
      };
    });
    await page.evaluate(() => document.querySelector('[data-copy="#out-datauri"]').click());
    const copied = await page.waitFor(
      () => document.querySelector('[data-copy="#out-datauri"]').textContent === "Copied!" ? "Copied!" : null,
      "clipboard copy did not report Copied!"
    );
    assert.equal(copied, "Copied!", "copy success label");
    const clip = await page.evaluate(() => navigator.clipboard.readText());
    assert.equal(clip, encoded.state.dataUri, "clipboard does not match the data URI");
    const downloads = await page.evaluate(() => window.__downloads.length);
    assert.equal(downloads, 0, "a successful copy must not also download a file");

    await page.evaluate(() => {
      navigator.clipboard.writeText = () => Promise.reject(new DOMException("denied", "NotAllowedError"));
      document.execCommand = () => false;
      document.querySelector('[data-copy="#out-datauri"]').click();
    });
    const saved = await page.waitFor(() => {
      const label = document.querySelector('[data-copy="#out-datauri"]').textContent;
      const item = window.__downloads[0];
      if (label !== "Downloaded" || !item) return null;
      return item;
    }, "clipboard denial did not fall back to a download");
    assert.equal(saved.name, "data-uri.txt", "copy fallback filename");
    const body = await page.evaluate(async (href) => (await fetch(href)).text(), saved.href);
    assert.equal(body, encoded.state.dataUri, "downloaded fallback is not the data URI");
    const label = await page.evaluate(() => document.querySelector('[data-copy="#out-datauri"]').textContent);
    assert.notEqual(label, "Copied!", "a failed clipboard must not claim Copied!");
  } finally {
    await page.close();
  }
});

test("homepage privacy, offline, and size copy match what the converter does", { timeout: 60000 }, async () => {
  const page = await site.open("/");
  try {
    const faq = await page.evaluate(() => {
      const items = {};
      document.querySelectorAll("#faq details").forEach((details) => {
        const summary = details.querySelector("summary");
        const answer = details.querySelector("p");
        if (summary && answer) items[summary.textContent.trim()] = answer.textContent.replace(/\s+/g, " ").trim();
      });
      return {
        items,
        hint: (document.querySelector("#drop p") || {}).textContent || "",
      };
    });
    const privacy = faq.items["Is this converter safe and private?"];
    const offline = faq.items["Does this converter work offline?"];
    const size = faq.items["Is there a file size limit?"];
    assert.ok(privacy, "privacy FAQ is missing");
    assert.match(privacy, /image file is not uploaded/, "privacy FAQ must say the image is not uploaded");
    assert.match(privacy, /cookieless usage event/, "privacy FAQ must mention the usage event the page actually sends");
    assert.doesNotMatch(privacy, /there is no network request/, "privacy FAQ must not claim conversion makes no network request");
    assert.ok(offline, "offline FAQ is missing");
    assert.match(offline, /without a connection/, "offline FAQ must say encoding still works offline");
    assert.match(offline, /usage event may fail to send/, "offline FAQ must admit the usage event can fail offline");
    assert.doesNotMatch(offline, /there is no server call/, "offline FAQ must not claim there is no server call");
    assert.ok(size, "size FAQ is missing");
    assert.match(size, /15\s*MB/, "size FAQ must state the 15 MB refusal");
    assert.match(size, /5\s*MB/, "size FAQ must keep the 5 MB comfort guidance");
    assert.doesNotMatch(size, /No hard limit/, "size FAQ must not say there is no hard limit");
    assert.match(faq.hint, /15\s*MB/, "dropzone hint must show the 15 MB limit");
  } finally {
    await page.close();
  }
});
