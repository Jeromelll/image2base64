import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const {
  classifyImageFile,
  assembleDataUri,
  buildEncodedSnippets,
  decodeImageBase64,
  decodeImageInput,
  detectImageMime,
  rejectUnexpectedImageMime,
} = require("../app.js");

// 1×1 synthetic PNG. Not a photograph and contains no personal data.
const PNG_BASE64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
const PNG_BYTES = Buffer.from(PNG_BASE64, "base64");

function sameBytes(actual, expected) {
  assert.equal(Buffer.from(actual).toString("base64"), Buffer.from(expected).toString("base64"));
}

test("loading the converter in Node does not touch a document", () => {
  assert.equal(globalThis.document, undefined);
  assert.equal(typeof decodeImageBase64, "function");
});

test("a synthetic PNG round-trips to the known Base64 body and data URI snippets", () => {
  assert.equal(PNG_BYTES[0], 0x89);
  assert.equal(PNG_BYTES[1], 0x50);
  assert.equal(detectImageMime(PNG_BYTES), "image/png");

  const file = { name: "pixel.png", type: "image/png", size: PNG_BYTES.length };
  const classified = classifyImageFile(file, "png");
  assert.equal(classified.error, undefined);
  assert.equal(classified.warning, "");
  assert.equal(classified.mime, "image/png");

  const dataUri = "data:image/png;base64," + PNG_BASE64;
  const assembled = assembleDataUri(dataUri, classified.mime);
  assert.equal(assembled.raw, PNG_BASE64);
  assert.equal(assembled.dataUri, dataUri);

  const decoded = decodeImageBase64(assembled.dataUri);
  assert.equal(decoded.mime, "image/png");
  sameBytes(decoded.bytes, PNG_BYTES);

  const snippets = buildEncodedSnippets(assembled.dataUri, assembled.raw, classified.mime, file.type, false);
  assert.equal(snippets.html, '<img src="' + dataUri + '" alt="" />');
  assert.equal(snippets.css, "background-image: url(" + dataUri + ");");
  assert.equal(snippets.link, '<link rel="icon" type="image/png" href="' + dataUri + '" />');
  assert.equal(snippets.vision, JSON.stringify({
    requests: [{ image: { content: PNG_BASE64 }, features: [{ type: "LABEL_DETECTION", maxResults: 3 }] }],
  }));
  assert.equal(JSON.parse(snippets.vision).requests[0].image.content, PNG_BASE64);
  assert.doesNotMatch(snippets.html, /via Image2Base64/);

  const credited = buildEncodedSnippets(assembled.dataUri, assembled.raw, classified.mime, file.type, true);
  assert.match(credited.html, /<img src="data:image\/png;base64,/);
  assert.match(credited.html, /href="https:\/\/image2base64\.com\/">via Image2Base64/);
});

test("whitespace, charset, and URL-safe alphabets decode to the same bytes", () => {
  const wrapped = PNG_BASE64.replace(/(.{10})/g, "$1\n");
  const fromWhitespace = decodeImageInput("\n" + wrapped + "\n");
  assert.equal(fromWhitespace.mime, "image/png");
  sameBytes(fromWhitespace.bytes, PNG_BYTES);

  const withCharset = decodeImageBase64("data:image/png;charset=utf-8;base64," + PNG_BASE64);
  assert.equal(withCharset.mime, "image/png");
  sameBytes(withCharset.bytes, PNG_BYTES);

  let flavored = null;
  for (let n = 0; n < 80 && !flavored; n++) {
    const bytes = Buffer.concat([PNG_BYTES, Buffer.from([n, 0xfb, 0xff, 0xef])]);
    const b64 = bytes.toString("base64");
    if (b64.includes("+") && b64.includes("/")) flavored = bytes;
  }
  assert.ok(flavored, "synthetic PNG fixture should exercise the URL-safe alphabet");
  const safe = flavored.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const decoded = decodeImageBase64(safe);
  assert.equal(decoded.mime, "image/png");
  sameBytes(decoded.bytes, flavored);
});

test("JPEG, GIF, WebP, and SVG signatures survive encode and decode", () => {
  const cases = [
    {
      name: "dot.jpg",
      type: "image/jpeg",
      accept: "jpeg",
      bytes: Buffer.from([0xff, 0xd8, 0xff, 0xd9]),
      mime: "image/jpeg",
    },
    {
      name: "dot.gif",
      type: "image/gif",
      accept: "gif",
      bytes: Buffer.from("GIF89a\u0001\u0000\u0001\u0000", "latin1"),
      mime: "image/gif",
    },
    {
      name: "dot.webp",
      type: "image/webp",
      accept: "webp",
      bytes: Buffer.from("RIFF\u0000\u0000\u0000\u0000WEBP", "latin1"),
      mime: "image/webp",
    },
    {
      name: "dot.svg",
      type: "image/svg+xml",
      accept: "svg",
      bytes: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"></svg>', "utf8"),
      mime: "image/svg+xml",
    },
  ];

  for (const sample of cases) {
    const classified = classifyImageFile(sample, sample.accept);
    assert.equal(classified.error, undefined, sample.name);
    assert.equal(classified.warning, "", sample.name);
    assert.equal(classified.mime, sample.type, sample.name);
    const raw = sample.bytes.toString("base64");
    const assembled = assembleDataUri("data:" + sample.type + ";base64," + raw, classified.mime);
    assert.equal(assembled.raw, raw, sample.name);
    const decoded = decodeImageBase64(assembled.dataUri);
    assert.equal(decoded.mime, sample.mime, sample.name);
    sameBytes(decoded.bytes, sample.bytes);
  }
});

test("empty browser types for HEIC, HEIF, TIFF, and BMP are rewritten before encoding", () => {
  const cases = [
    ["shot.heic", "image/heic"],
    ["shot.heif", "image/heif"],
    ["scan.tiff", "image/tiff"],
    ["scan.tif", "image/tiff"],
    ["scan.bmp", "image/bmp"],
  ];
  for (const [name, mime] of cases) {
    const classified = classifyImageFile({ name, type: "", size: 4 }, "");
    assert.equal(classified.mime, mime, name);
    assert.equal(classified.error, undefined, name);
    const assembled = assembleDataUri("data:application/octet-stream;base64,AAAA", mime);
    assert.equal(assembled.dataUri, "data:" + mime + ";base64,AAAA", name);
    assert.equal(assembled.raw, "AAAA", name);
  }
});

test("a different format warns and still converts; non-images are rejected", () => {
  const jpegOnPng = classifyImageFile({ name: "photo.jpg", type: "image/jpeg", size: 4 }, "png");
  assert.equal(jpegOnPng.error, undefined);
  assert.equal(jpegOnPng.mime, "image/jpeg");
  assert.match(jpegOnPng.warning, /Heads up: this is a image\/jpeg file, but the converter handles it the same way\./);

  const text = classifyImageFile({ name: "notes.txt", type: "text/plain", size: 5 }, "");
  assert.match(text.error, /doesn't look like an image file/);
  assert.equal(text.mime, undefined);

  const extensionOnlyGif = classifyImageFile({ name: "anim.gif", type: "", size: 6 }, "gif");
  assert.match(extensionOnlyGif.error, /doesn't look like an image file/);
});

test("empty, URL-encoded, malformed, and non-image decoder input fail with specific errors", () => {
  assert.throws(() => decodeImageInput(""), /Paste a Base64 string or data URI first\./);
  assert.throws(() => decodeImageInput("   "), /Paste a Base64 string or data URI first\./);
  assert.throws(() => decodeImageBase64("****"), /The input contains characters that are not valid Base64\./);
  assert.throws(() => decodeImageBase64("data:image/png,iVBORw0KGgo"), /URL-encoded data URIs are not supported here\./);
  assert.throws(() => decodeImageBase64("data:image/png;base64,"), /URL-encoded data URIs are not supported here\./);
  assert.throws(() => decodeImageBase64("===="), /The Base64 string is empty\./);
  assert.throws(() => decodeImageBase64("a==="), /The Base64 string is incomplete or malformed\./);
  assert.throws(
    () => decodeImageBase64(Buffer.from("hello").toString("base64")),
    /This Base64 data does not appear to contain a supported image\./
  );
  assert.throws(
    () => decodeImageBase64("data:text/plain;base64," + Buffer.from("hello").toString("base64")),
    /This Base64 data does not appear to contain a supported image\./
  );

  const declaredOnly = decodeImageBase64("data:image/png;base64," + Buffer.from("hello").toString("base64"));
  assert.equal(declaredOnly.mime, "image/png");
  assert.equal(Buffer.from(declaredOnly.bytes).toString("utf8"), "hello");

  assert.throws(
    () => rejectUnexpectedImageMime("image/jpeg", "image/png"),
    /This page accepts PNG data\. The pasted image is JPG\./
  );
  assert.doesNotThrow(() => rejectUnexpectedImageMime("image/png", "image/png"));
  assert.doesNotThrow(() => rejectUnexpectedImageMime("image/jpeg", ""));
});

test("converter pages still wire the file input, decoder, and app.js", () => {
  const pages = {
    "index.html": ['id="drop"', 'src="app.js"', "<h1>"],
    "png-to-base64.html": ['id="drop"', 'data-accept="png"', 'src="app.js"'],
    "jpg-to-base64.html": ['id="drop"', 'data-accept="jpeg"', 'src="app.js"'],
    "gif-to-base64.html": ['data-accept="gif"', 'src="app.js"'],
    "webp-to-base64.html": ['data-accept="webp"', 'src="app.js"'],
    "svg-to-base64.html": ['data-accept="svg"', 'src="app.js"'],
    "base64-to-image.html": ['id="b64-input"', 'id="decode"', 'src="app.js"'],
  };
  for (const [file, markers] of Object.entries(pages)) {
    const html = fs.readFileSync(new URL("../" + file, import.meta.url), "utf8");
    for (const marker of markers) assert.ok(html.includes(marker), file + " missing " + marker);
  }
  const css = fs.readFileSync(new URL("../styles.css", import.meta.url), "utf8");
  assert.match(css, /\.dropzone\{/);
});
