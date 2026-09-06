// Base64 Tools — image ⇄ base64, 100% client-side.
// No uploads, no network calls. Wires up whichever widgets exist on the page.

(function () {
  "use strict";

  // ---------- privacy-first event tracking ----------
  // Sends minimal, cookieless events to our own Worker (/api/evt).
  // Never sends file contents, names, or anything personal — only
  // event name, page path, and coarse metadata (mime type, size bucket).
  function track(name, x1, x2) {
    try {
      var body = JSON.stringify({ e: name, p: location.pathname, x1: x1 || "", x2: x2 || "" });
      if (navigator.sendBeacon) {
        navigator.sendBeacon("/api/evt", new Blob([body], { type: "application/json" }));
      } else {
        fetch("/api/evt", { method: "POST", body: body, keepalive: true });
      }
    } catch (e) { /* analytics must never break the tool */ }
  }
  function sizeBucket(bytes) {
    if (!bytes && bytes !== 0) return "";
    if (bytes < 10 * 1024) return "<10KB";
    if (bytes < 100 * 1024) return "10-100KB";
    if (bytes < 1024 * 1024) return "100KB-1MB";
    return ">=1MB";
  }

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
  // Draw a sample scene (photo or avatar) shared by encoder and decoder
  // sample chips. Canvas stays local; nothing is downloaded.
  function drawSampleScene(ctx, kind) {
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
  }

  // Wire any [data-copy="#targetId"] button to copy that element's value/text.
  function wireCopyButtons(root) {
    (root || document).querySelectorAll("[data-copy]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var t = $(btn.getAttribute("data-copy"));
        if (!t) return;
        track("copy", btn.getAttribute("data-copy"));
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
    var creditToggle = $("#credit-toggle"); // checkbox: append opt-in "via Image2Base64" credit to the HTML snippet
    var outHtml = $("#out-html");
    var outCss = $("#out-css");
    var outLink = $("#out-link");    // optional: favicon <link rel="icon"> snippet
    var errBox = $("#enc-error");

    // The format this page is tuned for, e.g. "png" / "jpeg". Empty = any image.
    var accept = (drop.getAttribute("data-accept") || "").toLowerCase();

    // Last encoded data URI, so the opt-in credit toggle can rebuild the
    // HTML snippet without re-reading the file.
    var lastDataUri = null;

    // HTML <img> snippet builder. The credit link is strictly opt-in:
    // default off, only appended when the visitor ticks the checkbox.
    function buildHtmlSnippet(dataUri) {
      var snippet = '<img src="' + dataUri + '" alt="" />';
      if (creditToggle && creditToggle.checked) {
        snippet += ' <small><a href="https://image2base64.com/">via Image2Base64</a></small>';
      }
      return snippet;
    }

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
      if (msg) track("error", "encode", msg.slice(0, 60));
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
        if (outRaw) outRaw.value = raw;
        lastDataUri = dataUri;
        if (outHtml) outHtml.value = buildHtmlSnippet(dataUri);
        if (outCss) outCss.value = "background-image: url(" + dataUri + ");";
        if (outLink) outLink.value = '<link rel="icon" type="' + (file.type || "image/png") + '" href="' + dataUri + '" />';

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
          // Derive a friendly format label + extension from the actual file type
          // (jpeg page shows "JPG"/".jpg" exactly as before; png page shows "PNG"/".png").
          var sub = (file.type.split("/")[1] || "image").toLowerCase();
          var fmtLabel = sub === "jpeg" ? "JPG" : sub.toUpperCase();
          var fmtExt = sub === "jpeg" ? "jpg" : sub;
          var msg = "Base64 encoding added <strong>≈ " + pct + "%</strong> of overhead: this " +
            bytesToSize(file.size) + " " + fmtLabel + " became <strong>" + bytesToSize(dataUri.length) +
            "</strong> as a data URI.";
          if (file.size > 100 * 1024) {
            msg += " That's a big inline payload — for large photos a normal, cacheable <code>." + fmtExt + "</code> file usually loads faster.";
          } else {
            msg += " Small enough to inline comfortably in HTML, CSS or JSON.";
          }
          overheadNote.innerHTML = msg;
          overheadNote.hidden = false;
        }

        if (results) results.hidden = false;
        results.scrollIntoView({ behavior: "smooth", block: "nearest" });
        track("convert", file.type || "image", sizeBucket(file.size));
      };
      reader.onerror = function () { showError("Sorry — the file could not be read. Try another image."); };
      reader.readAsDataURL(file);
    }

    // Sample images: drawn locally on a canvas, then fed through the same
    // pipeline as a real file. Nothing is downloaded; zero extra requests.
    // mime/ext are derived from the page's data-accept so each page ships
    // samples in its own format (png page -> real PNGs, jpeg page -> JPGs).
    function makeSampleImage(kind, mime, ext, done) {
      var c = document.createElement("canvas");
      if (kind === "avatar") { c.width = 160; c.height = 160; } else { c.width = 480; c.height = 320; }
      var ctx = c.getContext("2d");
      if (!ctx) return;

      drawSampleScene(ctx, kind);

      c.toBlob(function (blob) {
        if (!blob || !done) return;
        var name = kind === "avatar" ? "sample-avatar." + ext : "sample-photo." + ext;
        try {
          done(new File([blob], name, { type: mime }));
        } catch (err) {
          blob.name = name; // very old browsers: carry the name on the Blob
          done(blob);
        }
      }, mime, 0.88);
    }

    // Sample chips (only present on pages that ship them)
    drop.querySelectorAll(".sample-chip").forEach(function (chip) {
      chip.addEventListener("click", function () {
        track("sample", chip.getAttribute("data-sample") || "photo");
        var sampleMime = accept === "png" ? "image/png"
                       : accept === "webp" ? "image/webp"
                       : "image/jpeg";
        var sampleExt = accept === "png" ? "png"
                      : accept === "webp" ? "webp"
                      : "jpg";
        makeSampleImage(chip.getAttribute("data-sample") || "photo", sampleMime, sampleExt, handleFile);
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

    // Credit toggle: rebuild the HTML snippet without touching the file input
    if (creditToggle && outHtml) {
      creditToggle.addEventListener("change", function () {
        track("credit", creditToggle.checked ? "on" : "off");
        if (lastDataUri) outHtml.value = buildHtmlSnippet(lastDataUri);
      });
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
    // Optional result readouts (only present on pages that ship them)
    var dSrcType = $("#d-srctype");
    var dDims = $("#d-dims");
    var dSize = $("#d-size");
    var dB64Len = $("#d-b64len");
    var dNote = $("#d-note");

    function showError(msg) {
      if (!errBox) return;
      errBox.textContent = msg;
      errBox.hidden = !msg;
      if (msg) track("error", "decode", msg.slice(0, 60));
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

    function showResult(blob, mime, note, extra) {
      revokeActiveUrl();
      activeObjectUrl = URL.createObjectURL(blob);
      img.src = activeObjectUrl;
      if (dlBtn) {
        dlBtn.href = activeObjectUrl;
        dlBtn.setAttribute("download", "decoded." + (outputExt || extensionForMime(mime)));
      }
      if (resultNote) resultNote.textContent = note;
      if (extra) {
        if (dSrcType) dSrcType.textContent = mimeLabel(extra.srcMime || mime);
        if (dDims) dDims.textContent = extra.dims || "—";
        if (dSize) dSize.textContent = bytesToSize(blob.size);
        if (dB64Len) dB64Len.textContent = (extra.srcChars || 0).toLocaleString() + " chars";
        if (dNote) {
          dNote.innerHTML = "Decoded <strong>" + (extra.srcChars || 0).toLocaleString() +
            " chars</strong> of Base64 into a <strong>" + bytesToSize(blob.size) + "</strong> " +
            mimeLabel(mime) + " (" + (extra.dims || "—") +
            ") — binary is ≈25% lighter than its Base64 text. Ready to download below.";
          dNote.hidden = false;
        }
      }
      if (resWrap) resWrap.hidden = false;
      resWrap.scrollIntoView({ behavior: "smooth", block: "nearest" });
      track("decode", mime, outputMime || "original");
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
        var dims = source.naturalWidth + " × " + source.naturalHeight + " px";
        if (!outputMime) {
          showResult(
            sourceBlob,
            parsed.mime,
            "Detected " + mimeLabel(parsed.mime) + ". Preview it here or download the original image bytes.",
            { srcMime: parsed.mime, dims: dims, srcChars: v.length }
          );
          return null;
        }
        return canvasBlob(source, outputMime).then(function (convertedBlob) {
          showResult(
            convertedBlob,
            outputMime,
            "Converted " + mimeLabel(parsed.mime) + " to " + mimeLabel(outputMime) +
            " in your browser.",
            { srcMime: parsed.mime, dims: dims, srcChars: v.length }
          );
        });
      }).catch(function (e) {
        showError(e.message || "The decoded image could not be processed.");
        if (resWrap) resWrap.hidden = true;
      }).finally(function () {
        URL.revokeObjectURL(sourceUrl);
      });
    }

    // Sample data URIs: drawn locally on a canvas, then fed through the same
    // decode pipeline as pasted text. Nothing is downloaded; zero extra requests.
    function makeSampleDataUri(kind) {
      return new Promise(function (resolve) {
        var c = document.createElement("canvas");
        if (kind === "avatar") { c.width = 160; c.height = 160; } else { c.width = 480; c.height = 320; }
        var ctx = c.getContext("2d");
        if (!ctx) return resolve("");
        drawSampleScene(ctx, kind);
        c.toBlob(function (blob) {
          if (!blob) return resolve("");
          var reader = new FileReader();
          reader.onload = function () { resolve(String(reader.result || "")); };
          reader.onerror = function () { resolve(""); };
          reader.readAsDataURL(blob);
        }, "image/png");
      });
    }

    // Sample chips (only present on pages that ship them)
    document.querySelectorAll(".sample-chip").forEach(function (chip) {
      chip.addEventListener("click", function () {
        track("sample", chip.getAttribute("data-sample") || "photo");
        makeSampleDataUri(chip.getAttribute("data-sample") || "photo").then(function (uri) {
          if (!uri) { showError("Could not generate the sample in this browser."); return; }
          input.value = uri;
          decode();
        });
      });
    });

    if (decodeBtn) decodeBtn.addEventListener("click", decode);
    if (dlBtn) dlBtn.addEventListener("click", function () {
      track("download", dlBtn.getAttribute("download") || "");
    });
    window.addEventListener("beforeunload", revokeActiveUrl);
    wireCopyButtons(input.closest("section") || document);
  }

  // ====================================================================
  // COMPRESS-THEN-ENCODE  (compress-png-to-base64 page)
  // Re-encodes via canvas: optional downscale + JPEG/WebP quality,
  // then emits the data URI. Nothing leaves the browser.
  // ====================================================================
  function initCompressEncoder() {
    var drop = $("#cdrop");
    if (!drop) return;

    var fileInput = $("#cfile");
    var pickBtn = $("#cpick");
    var fmtSel = $("#cfmt");
    var quality = $("#cquality");
    var qVal = $("#cqval");
    var maxWSel = $("#cmaxw");
    var results = $("#cresults");
    var preview = $("#cpreview");
    var mOrig = $("#cm-orig");
    var mComp = $("#cm-comp");
    var mDims = $("#cm-dims");
    var mB64 = $("#cm-b64");
    var savings = $("#csavings");
    var outData = $("#c-out-datauri");
    var outHtml = $("#c-out-html");
    var outCss = $("#c-out-css");
    var errBox = $("#c-error");

    function showError(msg) {
      if (!errBox) return;
      errBox.textContent = msg;
      errBox.hidden = !msg;
      if (msg) track("error", "compress", msg.slice(0, 60));
    }

    if (quality && qVal) {
      var syncQ = function () { qVal.textContent = quality.value + "%"; };
      quality.addEventListener("input", syncQ);
      syncQ();
    }

    function fmtLabel(mime) {
      if (mime === "image/webp") return "WebP";
      if (mime === "image/jpeg") return "JPG";
      return "PNG";
    }

    function render(dataUri, origBytes, compBytes, w, h) {
      var comma = dataUri.indexOf(",");
      outData.value = dataUri;
      outHtml.value = '<img src="' + dataUri + '" alt="" width="' + w + '" height="' + h + '" />';
      outCss.value = "background-image: url(" + dataUri + ");";
      if (preview) { preview.src = dataUri; preview.hidden = false; }
      if (mOrig) mOrig.textContent = bytesToSize(origBytes);
      if (mComp) mComp.textContent = bytesToSize(compBytes);
      if (mDims) mDims.textContent = w + " × " + h + " px";
      if (mB64) mB64.textContent = bytesToSize(dataUri.length);
      if (savings) {
        if (compBytes < origBytes) {
          var pct = (((origBytes - compBytes) / origBytes) * 100).toFixed(0);
          savings.innerHTML = "Compressed <strong>" + bytesToSize(origBytes) + " → " +
            bytesToSize(compBytes) + "</strong> (−" + pct + "%). The data URI is " +
            bytesToSize(dataUri.length) + " of text.";
          savings.style.display = "";
        } else {
          savings.innerHTML = "Re-encoding did not shrink this image (" + bytesToSize(origBytes) +
            " → " + bytesToSize(compBytes) + "). Try <strong>WebP</strong>, a lower quality value, or a smaller max width.";
          savings.style.display = "";
        }
        savings.hidden = false;
      }
      results.hidden = false;
      track("compress", (fmtSel ? fmtSel.value : "?"), sizeBucket(origBytes));
    }

    function process(file) {
      showError("");
      if (!file) return;
      if (!/^image\//.test(file.type)) {
        showError("That doesn't look like an image file. Please choose a PNG, JPG or WebP.");
        return;
      }
      var mime = fmtSel ? fmtSel.value : "image/webp";
      var q = quality ? parseInt(quality.value, 10) / 100 : 0.8;
      var maxW = maxWSel ? parseInt(maxWSel.value, 10) : 0;

      var source = new Image();
      var srcUrl = URL.createObjectURL(file);
      source.onload = function () {
        var w = source.naturalWidth, h = source.naturalHeight;
        if (maxW > 0 && w > maxW) { h = Math.round(h * (maxW / w)); w = maxW; }
        var canvas = document.createElement("canvas");
        canvas.width = w; canvas.height = h;
        var ctx = canvas.getContext("2d");
        if (!ctx) { URL.revokeObjectURL(srcUrl); showError("Your browser could not process this image."); return; }
        ctx.drawImage(source, 0, 0, w, h);
        URL.revokeObjectURL(srcUrl);
        // PNG output from a canvas re-encode rarely shrinks a real PNG —
        // the honest path is JPEG (photos) or WebP (everything, alpha kept).
        canvas.toBlob(function (blob) {
          if (!blob) { showError("Your browser could not encode this image in the selected format."); return; }
          var reader = new FileReader();
          reader.onload = function () { render(String(reader.result || ""), file.size, blob.size, w, h); };
          reader.onerror = function () { showError("Sorry — the compressed image could not be read back."); };
          reader.readAsDataURL(blob);
        }, mime, q);
      };
      source.onerror = function () {
        URL.revokeObjectURL(srcUrl);
        showError("Sorry — the image could not be loaded. Try another file.");
      };
      source.src = srcUrl;
    }

    // Sample: a deliberately detailed 960×640 scene so compression has
    // something to bite into. Drawn locally; zero network requests.
    var sampleBtn = drop.querySelector(".sample-chip");
    if (sampleBtn) {
      sampleBtn.addEventListener("click", function () {
        track("sample", "photo");
        var c = document.createElement("canvas");
        c.width = 960; c.height = 640;
        var ctx = c.getContext("2d");
        if (!ctx) return;
        ctx.scale(2, 2);
        drawSampleScene(ctx, "photo");
        c.toBlob(function (blob) {
          if (!blob) return;
          try {
            process(new File([blob], "sample-photo.png", { type: "image/png" }));
          } catch (err) {
            blob.name = "sample-photo.png";
            process(blob);
          }
        }, "image/png");
      });
    }

    if (pickBtn && fileInput) pickBtn.addEventListener("click", function () { fileInput.click(); });
    if (fileInput) fileInput.addEventListener("change", function () {
      if (fileInput.files && fileInput.files[0]) process(fileInput.files[0]);
    });
    drop.addEventListener("click", function (e) {
      if (e.target.closest("button")) return;
      if (fileInput) fileInput.click();
    });
    ["dragenter", "dragover"].forEach(function (ev) {
      drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.add("is-drag"); });
    });
    ["dragleave", "drop"].forEach(function (ev) {
      drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.remove("is-drag"); });
    });
    drop.addEventListener("drop", function (e) {
      var dt = e.dataTransfer;
      if (dt && dt.files && dt.files[0]) process(dt.files[0]);
    });
    document.addEventListener("paste", function (e) {
      var items = (e.clipboardData && e.clipboardData.items) || [];
      for (var i = 0; i < items.length; i++) {
        if (items[i].type && items[i].type.indexOf("image") === 0) {
          process(items[i].getAsFile());
          break;
        }
      }
    });
  }

  // ====================================================================
  // SIZE CALCULATOR  (base64-image-size-calculator page)
  // Binary size -> Base64 chars -> data URI bytes, with an inline verdict.
  // ====================================================================
  function initCalculator() {
    var input = $("#calc-input");
    if (!input) return;

    var unit = $("#calc-unit");
    var fileInput = $("#calc-file");
    var pickBtn = $("#calc-pick");
    var out = $("#calc-out");
    var vRaw = $("#cv-raw");
    var vUri = $("#cv-uri");
    var vPct = $("#cv-pct");
    var vVerdict = $("#cv-verdict");
    var barOrig = $("#cbar-orig");
    var barB64 = $("#cbar-b64");

    var PREFIX = "data:image/png;base64,".length; // 22 chars

    function calc(n) {
      if (!n || n <= 0) return null;
      var rawChars = 4 * Math.ceil(n / 3);
      var uriChars = rawChars + PREFIX;
      return { raw: rawChars, uri: uriChars };
    }

    function show(n) {
      var r = calc(n);
      if (!r) return;
      var pct = ((r.uri - n) / n) * 100;
      if (vRaw) vRaw.textContent = r.raw.toLocaleString() + " chars (" + bytesToSize(r.raw) + ")";
      if (vUri) vUri.textContent = r.uri.toLocaleString() + " chars (" + bytesToSize(r.uri) + ")";
      if (vPct) vPct.textContent = "+" + pct.toFixed(1) + "%";
      if (vVerdict) {
        var verdict;
        if (n <= 5 * 1024) {
          verdict = '<span class="calc-ok">Good to inline.</span> Under 5 KB of source data — the saved HTTP request usually outweighs the extra text.';
        } else if (n <= 50 * 1024) {
          verdict = '<span class="calc-warn">Borderline.</span> Compress the image first — a smaller version may inline comfortably. Try the <a href="/compress-png-to-base64">PNG compressor + encoder</a>.';
        } else {
          verdict = '<span class="calc-bad">Too big to inline.</span> Serve it as a normal image file so the browser can cache it independently. You can still <a href="/compress-png-to-base64">compress it first</a>.';
        }
        vVerdict.innerHTML = verdict;
      }
      if (barOrig && barB64) {
        var ratio = n / r.uri;
        barOrig.style.width = Math.max(4, ratio * 100) + "%";
        barB64.style.width = "100%";
        barOrig.setAttribute("data-label", bytesToSize(n));
        barB64.setAttribute("data-label", bytesToSize(r.uri));
      }
      out.hidden = false;
      track("calc", "", sizeBucket(n));
    }

    function fromFields() {
      var n = parseFloat(input.value);
      if (!n || n <= 0) return;
      var mult = unit && unit.value === "mb" ? 1024 * 1024 : unit && unit.value === "b" ? 1 : 1024;
      show(Math.round(n * mult));
    }

    if (pickBtn && fileInput) pickBtn.addEventListener("click", function () { fileInput.click(); });
    if (fileInput) fileInput.addEventListener("change", function () {
      if (fileInput.files && fileInput.files[0]) {
        show(fileInput.files[0].size);
        input.value = (fileInput.files[0].size / 1024).toFixed(1);
        if (unit) unit.value = "kb";
      }
    });
    input.addEventListener("input", fromFields);
    if (unit) unit.addEventListener("change", fromFields);
  }

  // ---------- boot ----------
  document.addEventListener("DOMContentLoaded", function () {
    // Privacy-first page view: cookieless, no IP, stored on our own Worker.
    track("page_view", document.referrer);
    initEncoder();
    initDecoder();
    initCompressEncoder();
    initCalculator();
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
