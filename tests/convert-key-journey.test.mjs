// Key journey: choose an image, see the result, copy it, then decode and download.
// Runs in a 390×844 viewport and activates the controls with the keyboard.
import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { launchSite } from "./page-browser.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const pngPath = join(here, "fixtures", "tiny.png");
const pngBase64 = readFileSync(pngPath).toString("base64");

let site;

before(async () => {
  site = await launchSite(root);
});

after(async () => {
  if (site) await site.close();
});

function layoutSnapshot() {
  const doc = document.documentElement;
  const out = document.querySelector("#out-datauri") || document.querySelector("#b64-input");
  const copy = document.querySelector('[data-copy="#out-datauri"]');
  const pick = document.querySelector("#pick");
  const copyRect = copy ? copy.getBoundingClientRect() : null;
  const pickRect = pick ? pick.getBoundingClientRect() : null;
  return {
    scrollWidth: doc.scrollWidth,
    clientWidth: doc.clientWidth,
    fontSize: out ? getComputedStyle(out).fontSize : "",
    copyRight: copyRect ? copyRect.right : 0,
    copyHeight: copyRect ? copyRect.height : 0,
    pickHeight: pickRect ? pickRect.height : 0,
  };
}

test("mobile keyboard journey from image input to copy and download", { timeout: 90000 }, async () => {
  const encoder = await site.open("/", { mobile: true });
  try {
    const beforeLayout = await encoder.evaluate(layoutSnapshot);
    assert.ok(
      beforeLayout.scrollWidth <= beforeLayout.clientWidth + 1,
      "homepage scrolls sideways at 390px before input (" + beforeLayout.scrollWidth + " > " + beforeLayout.clientWidth + ")"
    );
    assert.equal(beforeLayout.fontSize, "16px", "output text is under 16px, so an iOS keyboard focus would zoom the page");
    assert.ok(beforeLayout.pickHeight >= 44, "Choose image is shorter than the 44px mobile target (" + beforeLayout.pickHeight + "px)");

    await encoder.armFileChooser();
    const chooserPromise = encoder.waitFileChooser();
    const focused = await encoder.focus("#pick");
    assert.equal(focused, "pick", "Enter was not aimed at Choose image");
    await encoder.pressEnter();
    let chooser;
    try {
      chooser = await chooserPromise;
    } catch (error) {
      throw new Error("Enter on Choose image did not open the file picker: " + error.message);
    }
    assert.ok(chooser.backendNodeId, "file picker opened without an input node");
    await encoder.chooseFiles(chooser.backendNodeId, [pngPath]);

    const encoded = await encoder.waitFor(() => {
      const out = document.querySelector("#out-datauri");
      const results = document.querySelector("#results");
      const err = document.querySelector("#enc-error");
      if (err && !err.hidden && err.textContent) return { error: err.textContent };
      if (results && !results.hidden && out && out.value.indexOf(",") > 0) {
        return { dataUri: out.value, raw: out.value.slice(out.value.indexOf(",") + 1) };
      }
      return null;
    }, "keyboard file choice did not produce a data URI");
    assert.equal(encoded.error || "", "", "encoder error after keyboard file choice: " + (encoded.error || ""));
    assert.equal(encoded.raw, pngBase64, "keyboard-selected PNG bytes were not preserved");

    const afterLayout = await encoder.evaluate(layoutSnapshot);
    assert.ok(
      afterLayout.scrollWidth <= afterLayout.clientWidth + 1,
      "result page scrolls sideways at 390px (" + afterLayout.scrollWidth + " > " + afterLayout.clientWidth + ")"
    );
    assert.ok(
      afterLayout.copyRight <= afterLayout.clientWidth + 1,
      "Copy button extends past the 390px viewport (" + afterLayout.copyRight + " > " + afterLayout.clientWidth + ")"
    );
    assert.ok(afterLayout.copyHeight >= 40, "Copy button is shorter than the 40px mobile target (" + afterLayout.copyHeight + "px)");

    await encoder.evaluate(() => {
      window.__copyClick = null;
      document.querySelector('[data-copy="#out-datauri"]').addEventListener("click", (event) => {
        window.__copyClick = { trusted: event.isTrusted, detail: event.detail };
      });
    });
    await encoder.focus('[data-copy="#out-datauri"]');
    await encoder.pressEnter();
    const copied = await encoder.waitFor(
      () => document.querySelector('[data-copy="#out-datauri"]').textContent === "Copied!" ? "Copied!" : null,
      "Enter on Copy did not report Copied!"
    );
    assert.equal(copied, "Copied!", "keyboard copy label");
    const click = await encoder.evaluate(() => window.__copyClick);
    assert.equal(click && click.trusted, true, "Copy did not receive a trusted keyboard click");
    assert.equal(click && click.detail, 0, "Copy click was a mouse click (detail " + (click && click.detail) + "), not the keyboard");
    const clip = await encoder.evaluate(() => navigator.clipboard.readText());
    assert.equal(clip, encoded.dataUri, "keyboard copy did not put the data URI on the clipboard");

    const decoder = await site.open("/base64-to-image.html", { mobile: true });
    try {
      const inputSize = await decoder.evaluate(() => getComputedStyle(document.querySelector("#b64-input")).fontSize);
      assert.equal(inputSize, "16px", "decoder input is under 16px, so the mobile keyboard would zoom the page");
      await decoder.focus("#b64-input");
      await decoder.insertText(encoded.dataUri);
      const typed = await decoder.evaluate(() => document.querySelector("#b64-input").value);
      assert.equal(typed, encoded.dataUri, "keyboard input did not fill the decoder");

      await decoder.evaluate(() => {
        window.__decodeClick = null;
        document.querySelector("#decode").addEventListener("click", (event) => {
          window.__decodeClick = { trusted: event.isTrusted, detail: event.detail };
        });
      });
      await decoder.focus("#decode");
      await decoder.pressEnter();
      const decoded = await decoder.waitFor(() => {
        const err = document.querySelector("#dec-error");
        const results = document.querySelector("#dec-results");
        const img = document.querySelector("#decoded-img");
        const link = document.querySelector("#download");
        if (err && !err.hidden && err.textContent) return { error: err.textContent };
        if (results && !results.hidden && img && img.complete && img.naturalWidth > 0 && link && link.href.indexOf("blob:") === 0) {
          return { width: img.naturalWidth, download: link.getAttribute("download") || "" };
        }
        return null;
      }, "Enter on Decode did not show a preview");
      assert.equal(decoded.error || "", "", "decoder error after keyboard input: " + (decoded.error || ""));
      assert.ok(decoded.width > 0, "decoded preview has no width");
      assert.equal(decoded.download, "decoded.png", "download control is not named decoded.png");
      const decodeClick = await decoder.evaluate(() => window.__decodeClick);
      assert.equal(decodeClick && decodeClick.trusted, true, "Decode did not receive a trusted keyboard click");
      assert.equal(decodeClick && decodeClick.detail, 0, "Decode was not activated from the keyboard");
      const downloaded = await decoder.evaluate(async () => {
        const response = await fetch(document.querySelector("#download").href);
        const buf = new Uint8Array(await response.arrayBuffer());
        let binary = "";
        for (let i = 0; i < buf.length; i += 0x8000) {
          binary += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000));
        }
        return btoa(binary);
      });
      assert.equal(downloaded, pngBase64, "download link bytes differ from the image that was encoded");

      const decLayout = await decoder.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
      }));
      assert.ok(
        decLayout.scrollWidth <= decLayout.clientWidth + 1,
        "decoder scrolls sideways at 390px (" + decLayout.scrollWidth + " > " + decLayout.clientWidth + ")"
      );

      await decoder.evaluate(() => {
        window.__downloadClick = null;
        document.querySelector("#download").addEventListener("click", (event) => {
          window.__downloadClick = { trusted: event.isTrusted, detail: event.detail };
        });
      });
      await decoder.focus("#download");
      await decoder.pressEnter();
      const downloadClick = await decoder.waitFor(
        () => window.__downloadClick,
        "Enter on Download did not activate the link"
      );
      assert.equal(downloadClick.trusted, true, "Download did not receive a trusted keyboard click");
      assert.equal(downloadClick.detail, 0, "Download was not activated from the keyboard");
    } finally {
      await decoder.close();
    }
  } finally {
    await encoder.close();
  }
});
