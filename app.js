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
    var outData = $("#out-datauri"); // textarea: full data URI
    var outRaw = $("#out-raw");      // textarea: raw base64 only
    var rawWrap = $("#raw-wrap");
    var prefixToggle = $("#prefix-toggle"); // checkbox: show raw (no prefix)
    var outHtml = $("#out-html");
    var outCss = $("#out-css");
    var errBox = $("#enc-error");

    // The format this page is tuned for, e.g. "png" / "jpeg". Empty = any image.
    var accept = (drop.getAttribute("data-accept") || "").toLowerCase();

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

        if (results) results.hidden = false;
        results.scrollIntoView({ behavior: "smooth", block: "nearest" });
      };
      reader.onerror = function () { showError("Sorry — the file could not be read. Try another image."); };
      reader.readAsDataURL(file);
    }

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

    function showError(msg) {
      if (!errBox) return;
      errBox.textContent = msg;
      errBox.hidden = !msg;
    }

    function decode() {
      showError("");
      var v = (input.value || "").trim();
      if (!v) { showError("Paste a Base64 string or data URI first."); return; }

      // Accept either a full data URI or a bare base64 body.
      var src = v;
      if (v.indexOf("data:") !== 0) {
        // Guess a mime from a leading hint, default to png.
        src = "data:image/png;base64," + v.replace(/\s+/g, "");
      }
      // Validate by attempting to load it.
      img.onerror = function () {
        showError("That string didn't decode to a valid image. Check that you pasted the full Base64 body.");
        if (resWrap) resWrap.hidden = true;
      };
      img.onload = function () {
        if (resWrap) resWrap.hidden = false;
        if (dlBtn) {
          dlBtn.href = src;
          var m = src.match(/^data:image\/([a-z0-9.+-]+)/i);
          dlBtn.setAttribute("download", "decoded." + ((m && m[1]) || "png").replace("jpeg", "jpg"));
        }
        resWrap.scrollIntoView({ behavior: "smooth", block: "nearest" });
      };
      img.src = src;
    }

    if (decodeBtn) decodeBtn.addEventListener("click", decode);
    wireCopyButtons(input.closest("section") || document);
  }

  // ---------- boot ----------
  document.addEventListener("DOMContentLoaded", function () {
    initEncoder();
    initDecoder();
    wireCopyButtons(document);
  });
})();
