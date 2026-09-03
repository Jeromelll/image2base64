// Base64 Tools — image ⇄ base64, 100% client-side.
// No uploads, no network calls. Wires up whichever widgets exist on the page.

(function () {
  "use strict";

  // ---------- helpers ----------
  function $(sel, root) { return (root || document).querySelector(sel); }
  function bytesToSize(bytes) {
    if (!bytes && bytes !== 0) return "";
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(2) + " MB";
  }
  function flash(btn, label) {
    var old = btn.getAttribute("data-label") || btn.textContent;
    if (!btn.getAttribute("data-label")) btn.setAttribute("data-label", old);
    btn.textContent = label || "Copied!";
    btn.classList.add("ok");
    setTimeout(function () {
      btn.textContent = btn.getAttribute("data-label");
      btn.classList.remove("ok");
    }, 1400);
  }
  function copyText(text, btn) {
    if (!text) return;
    var done = function () { flash(btn); };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done).catch(function () { fallbackCopy(text, done); });
    } else {
      fallbackCopy(text, done);
    }
  }
  function fallbackCopy(text, done) {
    var ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand("copy"); } catch (e) {}
    document.body.removeChild(ta);
    done();
  }
  // Wire any [data-copy="#targetId"] button to copy that element's value/text.
  function wireCopyButtons(root) {
    (root || document).querySelectorAll("[data-copy]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var t = $(btn.getAttribute("data-copy"));
        if (!t) return;
        var text = "value" in t ? t.value : t.textContent;
        copyText((text || "").trim(), btn);
      });
    });
  }

  // ====================================================================
  // ENCODER  (image -> base64)
  // ====================================================================
  function initEncoder() {
    var drop = $("#drop");
    if (!drop) return;

    var fileInput = $("#file");
    var pickBtn = $("#pick");
    var results = $("#results");
    var preview = $("#preview");
    var metaName = $("#m-name");
    var metaType = $("#m-type");
    var metaSize = $("#m-size");
    var metaLen = $("#m-len");
    var metaB64Size = $("#m-b64size");       // optional: encoded size (chars ≈ bytes)
    var metaDims = $("#m-dims");             // optional: natural width × height
    var overheadNote = $("#overhead-note");  // optional: "~33% bigger" explainer
    var outData = $("#out-datauri"); // textarea: full data URI
    var outRaw = $("#out-raw");      // textarea: raw base64 only
    var rawWrap = $("#raw-wrap");
    var prefixToggle = $("#prefix-toggle"); // checkbox: show raw (no prefix)
    var outHtml = $("#out-html");
    var outCss = $("#out-css");
    var errBox = $("#enc-error");

    // The format this page is tuned for, e.g. "png" / "jpeg". Empty = any image.
    var accept = (drop.getAttribute("data-accept") || "").toLowerCase();

    // Report natural dimensions as soon as the preview bitmap is ready.
    if (preview) {
      preview.addEventListener("load", function () {
        if (metaDims) metaDims.textContent = preview.naturalWidth + " × " + preview.naturalHeight + " px";
      });
    }

    function showError(msg) {
      if (!errBox) return;
      errBox.textContent = msg;
      errBox.hidden = !msg;
    }

    function handleFile(file) {
      showError("");
      if (!file) return;
      if (!/^image\//.test(file.type)) {
        showError("That doesn't look like an image file. Please choose a PNG, JPG, GIF, WebP or SVG.");
        return;
      }
      if (accept && file.type.indexOf(accept) === -1) {
        // Soft note only — still convert, since the engine is format-agnostic.
        showError("Heads up: this is a " + (file.type || "non-" + accept) +
          " file, but the converter handles it the same way.");
      }
      var reader = new FileReader();
      reader.onload = function (e) {
        var dataUri = e.target.result;            // data:image/png;base64,AAAA...
        var comma = dataUri.indexOf(",");
        var raw = comma >= 0 ? dataUri.slice(comma + 1) : dataUri;

        outData.value = dataUri;
        outRaw.value = raw;
        if (outHtml) outHtml.value = '<img src="' + dataUri + '" alt="" />';
        if (outCss) outCss.value = "background-image: url(" + dataUri + ");";

        if (preview) { preview.src = dataUri; preview.hidden = false; }
        if (metaName) metaName.textContent = file.name || "(pasted image)";
        if (metaType) metaType.textContent = file.type || "image";
        if (metaSize) metaSize.textContent = bytesToSize(file.size);
        if (metaLen) metaLen.textContent = raw.length.toLocaleString() + " chars";
        if (metaB64Size) metaB64Size.textContent = bytesToSize(dataUri.length);

        // Overhead hint: Base64 packs every 3 bytes into 4 chars, so the
        // data URI ends up ~33% larger than the original file. Show the
        // exact number for this file instead of a flat estimate.
        if (overheadNote && file.size > 0) {
          var pct = (((dataUri.length - file.size) / file.size) * 100).toFixed(1);
          var msg = "Base64 encoding added <strong>≈ " + pct + "%</strong> of overhead: this " +
            bytesToSize(file.size) + " JPG became <strong>" + bytesToSize(dataUri.length) +
            "</strong> as a data URI.";
          if (file.size > 100 * 1024) {
            msg += " That's a big inline payload — for large photos a normal, cacheable <code>.jpg</code> file usually loads faster.";
          } else {
            msg += " Small enough to inline comfortably in HTML, CSS or JSON.";
          }
          overheadNote.innerHTML = msg;
          overheadNote.hidden = false;
        }

        if (results) results.hidden = false;
        results.scrollIntoView({ behavior: "smooth", block: "nearest" });
      };
      reader.onerror = function () { showError("Sorry — the file could not be read. Try another image."); };
      reader.readAsDataURL(file);
    }

    // Sample images: drawn locally on a canvas, then fed through the same
    // pipeline as a real file. Nothing is downloaded; zero extra requests.
    function makeSampleJpeg(kind, done) {
      var c = document.createElement("canvas");
      if (kind === "avatar") { c.width = 160; c.height = 160; } else { c.width = 480; c.height = 320; }
      var ctx = c.getContext("2d");
      if (!ctx) return;

      if (kind === "avatar") {
        var bg = ctx.createLinearGradient(0, 0, 0, 160);
        bg.addColorStop(0, "#8ec9ff");
        bg.addColorStop(1, "#dbeaff");
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, 160, 160);
        ctx.fillStyle = "#f2c19a";                                    // shoulders
        ctx.beginPath(); ctx.arc(80, 172, 52, Math.PI, 2 * Math.PI); ctx.fill();
        ctx.fillStyle = "#f6d0ae";                                    // head
        ctx.beginPath(); ctx.arc(80, 70, 30, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#3b2f2a";                                    // hair
        ctx.beginPath(); ctx.arc(80, 64, 30, Math.PI, 2 * Math.PI); ctx.fill();
      } else {
        ctx.fillStyle = "#eef2ff";
        ctx.fillRect(0, 0, 480, 320);
        var sky = ctx.createLinearGradient(0, 0, 0, 210);
        sky.addColorStop(0, "#5b6cff");
        sky.addColorStop(1, "#c9d4ff");
        ctx.fillStyle = sky;
        ctx.fillRect(0, 0, 480, 210);
        ctx.fillStyle = "#ffd66e";                                    // sun
        ctx.beginPath(); ctx.arc(360, 70, 34, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#19c39a";                                    // back hill
        ctx.beginPath(); ctx.moveTo(0, 320); ctx.quadraticCurveTo(140, 100, 300, 320); ctx.fill();
        ctx.fillStyle = "#0f9d7c";                                    // front hill
        ctx.beginPath(); ctx.moveTo(160, 320); ctx.quadraticCurveTo(330, 140, 480, 320); ctx.fill();
      }

      c.toBlob(function (blob) {
        if (!blob || !done) return;
        var name = kind === "avatar" ? "sample-avatar.jpg" : "sample-photo.jpg";
        try {
          done(new File([blob], name, { type: "image/jpeg" }));
        } catch (err) {
          blob.name = name; // very old browsers: carry the name on the Blob
          done(blob);
        }
      }, "image/jpeg", 0.88);
    }

    // Sample chips (only present on pages that ship them)
    drop.querySelectorAll(".sample-chip").forEach(function (chip) {
      chip.addEventListener("click", function () {
        makeSampleJpeg(chip.getAttribute("data-sample") || "photo", handleFile);
      });
    });

    // File picker
    if (pickBtn && fileInput) {
      pickBtn.addEventListener("click", function () { fileInput.click(); });
    }
    if (fileInput) {
      fileInput.addEventListener("change", function () {
        if (fileInput.files && fileInput.files[0]) handleFile(fileInput.files[0]);
      });
    }
    // Click anywhere on the dropzone opens the picker
    drop.addEventListener("click", function (e) {
      if (e.target.closest("button")) return;
      if (fileInput) fileInput.click();
    });

    // Drag & drop
    ["dragenter", "dragover"].forEach(function (ev) {
      drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.add("is-drag"); });
    });
    ["dragleave", "drop"].forEach(function (ev) {
      drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.remove("is-drag"); });
    });
    drop.addEventListener("drop", function (e) {
      var dt = e.dataTransfer;
      if (dt && dt.files && dt.files[0]) handleFile(dt.files[0]);
    });

    // Paste an image from clipboard
    document.addEventListener("paste", function (e) {
      var items = (e.clipboardData && e.clipboardData.items) || [];
      for (var i = 0; i < items.length; i++) {
        if (items[i].type && items[i].type.indexOf("image") === 0) {
          handleFile(items[i].getAsFile());
          break;
        }
      }
    });

    // Prefix toggle: show/hide the raw (no data: prefix) output
    if (prefixToggle && rawWrap) {
      var sync = function () { rawWrap.hidden = !prefixToggle.checked; };
      prefixToggle.addEventListener("change", sync);
      sync();
    }

    wireCopyButtons(drop.closest("section") || document);
  }

  // ====================================================================
  // DECODER  (base64 -> image)
  // ====================================================================
  function initDecoder() {
    var input = $("#b64-input");
    if (!input) return;

    var decodeBtn = $("#decode");
    var img = $("#decoded-img");
    var dlBtn = $("#download");
    var errBox = $("#dec-error");
    var resWrap = $("#dec-results");
    var resultNote = resWrap ? $(".meta .muted", resWrap) : null;
    var outputMime = (input.getAttribute("data-output-mime") || "").toLowerCase();
    var outputExt = (input.getAttribute("data-output-ext") || "").toLowerCase();
    var acceptMime = (input.getAttribute("data-accept-mime") || "").toLowerCase();
    var quality = parseFloat(input.getAttribute("data-quality") || "0.92");
    var activeObjectUrl = "";

    function showError(msg) {
      if (!errBox) return;
      errBox.textContent = msg;
      errBox.hidden = !msg;
    }

    function revokeActiveUrl() {
      if (!activeObjectUrl) return;
      URL.revokeObjectURL(activeObjectUrl);
      activeObjectUrl = "";
    }

    function mimeLabel(mime) {
      var labels = {
        "image/png": "PNG",
        "image/jpeg": "JPG",
        "image/gif": "GIF",
        "image/webp": "WebP",
        "image/svg+xml": "SVG"
      };
      return labels[mime] || mime || "image";
    }

    function extensionForMime(mime) {
      var extensions = {
        "image/png": "png",
        "image/jpeg": "jpg",
        "image/gif": "gif",
        "image/webp": "webp",
        "image/svg+xml": "svg"
      };
      return extensions[mime] || "img";
    }

    function detectMime(bytes) {
      if (bytes.length >= 8 &&
          bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 &&
          bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a) {
        return "image/png";
      }
      if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
        return "image/jpeg";
      }
      if (bytes.length >= 6) {
        var gifHeader = String.fromCharCode.apply(null, bytes.slice(0, 6));
        if (gifHeader === "GIF87a" || gifHeader === "GIF89a") return "image/gif";
      }
      if (bytes.length >= 12) {
        var riff = String.fromCharCode.apply(null, bytes.slice(0, 4));
        var webp = String.fromCharCode.apply(null, bytes.slice(8, 12));
        if (riff === "RIFF" && webp === "WEBP") return "image/webp";
      }
      try {
        var text = new TextDecoder("utf-8").decode(bytes.slice(0, 2048))
          .replace(/^\uFEFF/, "")
          .trim();
        if (/^(?:<\?xml[\s\S]*?\?>\s*)?<svg[\s>]/i.test(text)) return "image/svg+xml";
      } catch (e) {}
      return "";
    }

    function parseBase64(value) {
      var declaredMime = "";
      var body = value;
      var dataUri = value.match(/^data:([^;,]+)?(?:;charset=[^;,]+)?;base64,([\s\S]+)$/i);
      if (dataUri) {
        declaredMime = (dataUri[1] || "").toLowerCase();
        body = dataUri[2];
      } else if (/^data:/i.test(value)) {
        throw new Error("Use a Base64 data URI. URL-encoded data URIs are not supported here.");
      }

      body = body.replace(/\s+/g, "").replace(/-/g, "+").replace(/_/g, "/");
      if (!body || /[^a-z0-9+/=]/i.test(body)) {
        throw new Error("The input contains characters that are not valid Base64.");
      }
      body = body.replace(/=+$/, "");
      while (body.length % 4) body += "=";

      var binary;
      try {
        binary = atob(body);
      } catch (e) {
        throw new Error("The Base64 string is incomplete or malformed.");
      }
      if (!binary.length) throw new Error("The Base64 string is empty.");

      var bytes = new Uint8Array(binary.length);
      for (var i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      var detectedMime = detectMime(bytes);
      var mime = detectedMime || declaredMime;
      if (!/^image\//.test(mime)) {
        throw new Error("This Base64 data does not appear to contain a supported image.");
      }
      return { bytes: bytes, mime: mime };
    }

    function loadImage(url) {
      return new Promise(function (resolve, reject) {
        var source = new Image();
        source.onload = function () { resolve(source); };
        source.onerror = function () { reject(new Error("The decoded bytes are not a valid browser-readable image.")); };
        source.src = url;
      });
    }

    function canvasBlob(source, mime) {
      return new Promise(function (resolve, reject) {
        var canvas = document.createElement("canvas");
        canvas.width = source.naturalWidth;
        canvas.height = source.naturalHeight;
        var ctx = canvas.getContext("2d");
        if (!ctx || !canvas.width || !canvas.height) {
          reject(new Error("The decoded image has invalid dimensions."));
          return;
        }
        if (mime === "image/jpeg") {
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(0, 0, canvas.width, canvas.height);
        }
        ctx.drawImage(source, 0, 0);
        canvas.toBlob(function (blob) {
          if (!blob || blob.type !== mime) {
            reject(new Error(mimeLabel(mime) + " export is not supported by this browser."));
            return;
          }
          resolve(blob);
        }, mime, quality);
      });
    }

    function showResult(blob, mime, note) {
      revokeActiveUrl();
      activeObjectUrl = URL.createObjectURL(blob);
      img.src = activeObjectUrl;
      if (dlBtn) {
        dlBtn.href = activeObjectUrl;
        dlBtn.setAttribute("download", "decoded." + (outputExt || extensionForMime(mime)));
      }
      if (resultNote) resultNote.textContent = note;
      if (resWrap) resWrap.hidden = false;
      resWrap.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }

    function decode() {
      showError("");
      var v = (input.value || "").trim();
      if (!v) { showError("Paste a Base64 string or data URI first."); return; }
      revokeActiveUrl();
      if (resWrap) resWrap.hidden = true;

      var parsed;
      try {
        parsed = parseBase64(v);
      } catch (e) {
        showError(e.message || "The Base64 string could not be decoded.");
        return;
      }

      if (acceptMime && parsed.mime !== acceptMime) {
        showError(
          "This page accepts " + mimeLabel(acceptMime) + " data. The pasted image is " +
          mimeLabel(parsed.mime) + "."
        );
        return;
      }

      var sourceBlob = new Blob([parsed.bytes], { type: parsed.mime });
      var sourceUrl = URL.createObjectURL(sourceBlob);
      loadImage(sourceUrl).then(function (source) {
        if (!outputMime) {
          showResult(
            sourceBlob,
            parsed.mime,
            "Detected " + mimeLabel(parsed.mime) + ". Preview it here or download the original image bytes."
          );
          return null;
        }
        return canvasBlob(source, outputMime).then(function (convertedBlob) {
          showResult(
            convertedBlob,
            outputMime,
            "Converted " + mimeLabel(parsed.mime) + " to " + mimeLabel(outputMime) +
            " in your browser."
          );
        });
      }).catch(function (e) {
        showError(e.message || "The decoded image could not be processed.");
        if (resWrap) resWrap.hidden = true;
      }).finally(function () {
        URL.revokeObjectURL(sourceUrl);
      });
    }

    if (decodeBtn) decodeBtn.addEventListener("click", decode);
    window.addEventListener("beforeunload", revokeActiveUrl);
    wireCopyButtons(input.closest("section") || document);
  }

  // ---------- boot ----------
  document.addEventListener("DOMContentLoaded", function () {
    initEncoder();
    initDecoder();
    wireCopyButtons(document);
  });
})();

// Feedback mailto: include the page title in the subject so we know which page the user was on
document.querySelectorAll('a.feedback-link').forEach(function (a) {
  try {
    var url = new URL(a.href);
    url.searchParams.set('subject', 'Feedback: ' + document.title);
    a.href = url.toString();
  } catch (e) { /* keep static subject */ }
});
