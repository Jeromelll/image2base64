"use strict";
const assert = require("node:assert/strict");
const { compressToTarget } = require("../compress-image.js");

function canvasFactory() {
  const canvas = { width: 0, height: 0 };
  canvas.getContext = () => ({ fillRect() {}, drawImage() {} });
  canvas.toBlob = (done, type, quality) => {
    assert.equal(type, "image/jpeg");
    done({ type, size: Math.ceil(canvas.width * canvas.height * (0.08 + quality * 0.22)) });
  };
  return () => canvas;
}

(async () => {
  const result = await compressToTarget({ width: 1000, height: 500 }, 100000, canvasFactory());
  assert.ok(result.blob.size <= 100000, "success must fit the exact byte limit");
  assert.equal(result.width, 1000, "keep original dimensions when quality alone fits");
  const tinyTarget = await compressToTarget({ width: 1000, height: 500 }, 150, canvasFactory());
  assert.ok(tinyTarget.blob.size <= 150, "downscale until the exact byte limit is met");
  assert.ok(tinyTarget.width < 1000);
  await assert.rejects(compressToTarget({ width: 1, height: 1 }, 0, canvasFactory()), /positive byte count/);
  await assert.rejects(compressToTarget({ width: 1, height: 1 }, 1, () => {
    const canvas = canvasFactory()();
    canvas.toBlob = done => done({ type: "image/jpeg", size: 20 });
    return canvas;
  }), /could not be reduced/);
  console.log("compress-image tests passed");
})().catch(error => { console.error(error); process.exitCode = 1; });
