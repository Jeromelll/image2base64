(function (root) {
  "use strict";

  async function compressToTarget(bitmap, targetBytes, createCanvas) {
    if (!Number.isFinite(targetBytes) || targetBytes <= 0) throw new RangeError("Target size must be a positive byte count.");
    var canvas = createCanvas();
    var context = canvas.getContext("2d", { alpha: false });
    if (!context) throw new Error("This browser could not create an image canvas.");

    async function encode(width, height, quality) {
      canvas.width = width;
      canvas.height = height;
      context.fillStyle = "#fff";
      context.fillRect(0, 0, width, height);
      context.drawImage(bitmap, 0, 0, width, height);
      return new Promise(function (resolve, reject) {
        canvas.toBlob(function (blob) {
          if (!blob || blob.type !== "image/jpeg") return reject(new Error("This browser could not encode a JPEG."));
          resolve(blob);
        }, "image/jpeg", quality);
      });
    }

    var width = bitmap.width;
    var height = bitmap.height;
    var previousWidth = 0;
    var previousHeight = 0;
    for (var scale = 1; scale >= 1 / 1024; scale *= 0.8) {
      var w = Math.max(1, Math.round(width * scale));
      var h = Math.max(1, Math.round(height * scale));
      if (w === previousWidth && h === previousHeight) break;
      previousWidth = w;
      previousHeight = h;
      var lowBlob = await encode(w, h, 0.1);
      if (lowBlob.size > targetBytes) continue;

      var best = lowBlob;
      var low = 0.1;
      var high = 0.92;
      for (var i = 0; i < 10; i++) {
        var quality = (low + high) / 2;
        var candidate = await encode(w, h, quality);
        if (candidate.size <= targetBytes) {
          best = candidate;
          low = quality;
        } else {
          high = quality;
        }
      }
      if (best.size <= targetBytes) return { blob: best, width: w, height: h };
    }
    throw new Error("This image could not be reduced to " + Math.ceil(targetBytes / 1000) + " KB. Try a larger target size.");
  }

  if (typeof module !== "undefined" && module.exports) module.exports = { compressToTarget: compressToTarget };
  if (!root.document) return;

  var $ = function (id) { return root.document.getElementById(id); };
  var fileInput = $("file");
  var drop = $("drop");
  var pick = $("pick");
  var target = $("target");
  var compress = $("compress");
  var error = $("error");
  var status = $("status");
  var results = $("results");
  var selectedFile = null;
  var previewUrl = "";
  var busy = false;

  function track(name) {
    try {
      var body = JSON.stringify({ e: name, p: location.pathname });
      if (navigator.sendBeacon) navigator.sendBeacon("/api/evt", new Blob([body], { type: "application/json" }));
      else fetch("/api/evt", { method: "POST", body: body, keepalive: true }).catch(function () {});
    } catch (_) { /* analytics must never interrupt compression */ }
  }

  function formatSize(bytes) {
    return bytes < 1000 ? bytes + " bytes" : (bytes / 1000).toFixed(1) + " KB";
  }
  function clearPreview() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    previewUrl = "";
  }
  function choose(file) {
    if (busy) return;
    error.hidden = true;
    results.hidden = true;
    status.textContent = "";
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      selectedFile = null;
      compress.disabled = true;
      error.textContent = "Choose a JPEG, PNG, or WebP image.";
      error.hidden = false;
      track("error");
      return;
    }
    if (file.size > 15 * 1024 * 1024) {
      selectedFile = null;
      compress.disabled = true;
      error.textContent = "This file is over the 15 MB limit. Choose a smaller image.";
      error.hidden = false;
      track("error");
      return;
    }
    clearPreview();
    selectedFile = file;
    compress.disabled = false;
    status.textContent = "Selected: " + (file.name || "image") + " (" + formatSize(file.size) + ")";
  }
  async function run() {
    if (!selectedFile || busy) return;
    var kb = Number(target.value);
    if (!Number.isInteger(kb) || kb < 1 || kb > 10240) {
      error.textContent = "Enter a whole number from 1 to 10,240 KB.";
      error.hidden = false;
      track("error");
      target.focus();
      return;
    }
    error.hidden = true;
    results.hidden = true;
    clearPreview();
    status.textContent = "Compressing in your browser…";
    busy = true;
    pick.disabled = true;
    fileInput.disabled = true;
    target.disabled = true;
    $("retry").disabled = true;
    compress.disabled = true;
    var bitmap;
    try {
      bitmap = await createImageBitmap(selectedFile);
      if (bitmap.width * bitmap.height > 40000000) throw new Error("This image is over the 40-megapixel limit. Choose a smaller image.");
      var targetBytes = kb * 1000;
      var output = await compressToTarget(bitmap, targetBytes, function () { return document.createElement("canvas"); });
      if (output.blob.size > targetBytes) throw new Error("The result was larger than the requested size. Please retry with a larger target.");
      clearPreview();
      previewUrl = URL.createObjectURL(output.blob);
      $("preview").src = previewUrl;
      $("original-size").textContent = formatSize(selectedFile.size);
      $("output-size").textContent = formatSize(output.blob.size) + " (" + output.blob.size.toLocaleString() + " bytes)";
      $("dimensions").textContent = output.width + " × " + output.height + " px";
      $("target-size").textContent = kb + " KB (" + targetBytes.toLocaleString() + " bytes)";
      $("download").href = previewUrl;
      $("download").download = (selectedFile.name || "image").replace(/\.[^.]*$/, "") + "-compressed.jpg";
      results.hidden = false;
      status.textContent = "Done. The JPEG is within your target size.";
      track("compress");
    } catch (e) {
      error.textContent = e && e.message ? e.message : "The image could not be compressed. Choose another image or try again.";
      error.hidden = false;
      status.textContent = "Compression did not finish. You can change the target and retry.";
      track("error");
    } finally {
      if (bitmap) bitmap.close();
      busy = false;
      pick.disabled = false;
      fileInput.disabled = false;
      target.disabled = false;
      $("retry").disabled = false;
      compress.disabled = !selectedFile;
    }
  }

  pick.addEventListener("click", function () { fileInput.click(); });
  fileInput.addEventListener("change", function () { choose(fileInput.files[0]); });
  compress.addEventListener("click", run);
  $("retry").addEventListener("click", run);
  $("download").addEventListener("click", function () { track("download"); });
  ["dragenter", "dragover"].forEach(function (name) { drop.addEventListener(name, function (e) { e.preventDefault(); drop.classList.add("is-drag"); }); });
  ["dragleave", "drop"].forEach(function (name) { drop.addEventListener(name, function (e) { e.preventDefault(); drop.classList.remove("is-drag"); }); });
  drop.addEventListener("drop", function (e) { choose(e.dataTransfer.files[0]); });
  drop.addEventListener("click", function (e) { if (e.target === drop || e.target.closest("h2,p,.dz-icon")) fileInput.click(); });
  root.addEventListener("beforeunload", clearPreview);
})(typeof window !== "undefined" ? window : globalThis);
