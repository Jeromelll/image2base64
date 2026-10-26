// ExifKit — read & strip photo metadata, 100% client-side.
// Core works on ArrayBuffer/Uint8Array (testable in Node); DOM layer is thin.
// Supports: JPEG (APP1 Exif / XMP, APP13, COM, APP2 MPF), PNG (eXIf, XMP text), WebP (EXIF/XMP chunks).
(function (global) {
  "use strict";

  // ---------- format detection ----------
  function detectFormat(u8) {
    if (u8.length > 3 && u8[0] === 0xff && u8[1] === 0xd8) return "jpeg";
    if (u8.length > 8 && u8[0] === 0x89 && u8[1] === 0x50 && u8[2] === 0x4e && u8[3] === 0x47) return "png";
    if (u8.length > 12 && u8[0] === 0x52 && u8[1] === 0x49 && u8[2] === 0x46 && u8[3] === 0x46 &&
        u8[8] === 0x57 && u8[9] === 0x45 && u8[10] === 0x42 && u8[11] === 0x50) return "webp";
    if (u8.length > 4 && ((u8[0] === 0x49 && u8[1] === 0x49) || (u8[0] === 0x4d && u8[1] === 0x4d))) return "tiff";
    if (u8.length > 12 && u8[4] === 0x66 && u8[5] === 0x74 && u8[6] === 0x79 && u8[7] === 0x70) {
      var brand = String.fromCharCode(u8[8], u8[9], u8[10], u8[11]);
      if (/^(hei[cfvx]|mif1|msf1|heim|heis|hevm|hevs|avif)/i.test(brand)) return brand.toLowerCase().indexOf("av") === 0 ? "avif" : "heic";
      return "isobmff";
    }
    return "unknown";
  }

  // ---------- JPEG segment scan ----------
  function scanJpeg(u8) {
    var dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
    var len = u8.length;
    if (len < 4 || dv.getUint8(0) !== 0xff || dv.getUint8(1) !== 0xd8) return { error: "not_jpeg" };
    var i = 2, segs = [];
    while (i < len - 1) {
      if (dv.getUint8(i) !== 0xff) return { error: "jpeg_lost_sync" };
      while (i < len && dv.getUint8(i) === 0xff) i++;
      if (i >= len) return { error: "jpeg_truncated" };
      var marker = dv.getUint8(i); i++;
      if (marker === 0xd9) return { segments: segs, eoiOffset: i - 1, eoiEnd: i + 1 };
      if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
      if (i + 2 > len) return { error: "jpeg_truncated" };
      var segLen = dv.getUint16(i);
      if (segLen < 2 || i + segLen > len) return { error: "jpeg_bad_segment" };
      segs.push({ marker: marker, offset: i - 2, lenOffset: i, dataOffset: i + 2, dataLen: segLen - 2 });
      i += segLen;
      if (marker === 0xda) {
        var j = i;
        while (j < len - 1) {
          if (dv.getUint8(j) === 0xff) {
            var m = dv.getUint8(j + 1);
            if (m !== 0x00 && !(m >= 0xd0 && m <= 0xd7)) {
              if (m === 0xd9) return { segments: segs, eoiOffset: j, eoiEnd: j + 2 };
              i = j; break;
            }
            j += 2;
          } else j++;
        }
        if (j >= len - 1) return { error: "jpeg_no_eoi" };
      }
    }
    return { error: "jpeg_unterminated" };
  }

  function segStartsWith(u8, seg, prefix) {
    if (seg.dataLen < prefix.length) return false;
    for (var k = 0; k < prefix.length; k++) if (u8[seg.dataOffset + k] !== prefix.charCodeAt(k)) return false;
    return true;
  }

  // ---------- TIFF parsing ----------
  function makeReader(dv, tiffBase) {
    var bo = dv.getUint16(tiffBase);
    var little = bo === 0x4949;
    return {
      little: little,
      u16: function (o) { return little ? dv.getUint16(o, true) : dv.getUint16(o, false); },
      u32: function (o) { return little ? dv.getUint32(o, true) : dv.getUint32(o, false); }
    };
  }

  var TYPE_SIZE = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 6: 1, 7: 1, 8: 2, 9: 4, 10: 8, 11: 4, 12: 8 };

  function parseIfd(r, dv, ifdOffset, tiffBase, u8) {
    if (ifdOffset <= 0 || tiffBase + ifdOffset + 6 > dv.byteLength) return null;
    var p = tiffBase + ifdOffset;
    var count = r.u16(p);
    if (count > 512 || p + 2 + count * 12 + 4 > dv.byteLength) return null;
    var entries = [];
    for (var e = 0; e < count; e++) {
      var ep = p + 2 + e * 12;
      var tag = r.u16(ep), type = r.u16(ep + 2), cnt = r.u32(ep + 4);
      var size = (TYPE_SIZE[type] || 1) * cnt;
      var data;
      if (size <= 4) {
        data = u8.slice(ep + 8, ep + 8 + size);
      } else {
        var off = r.u32(ep + 8);
        if (tiffBase + off + size > dv.byteLength) continue;
        data = u8.slice(tiffBase + off, tiffBase + off + size);
      }
      entries.push({ tag: tag, type: type, count: cnt, data: data });
    }
    var next = r.u32(p + 2 + count * 12);
    return { entries: entries, next: next };
  }

  function findEntry(ifd, tag) {
    if (!ifd) return null;
    for (var i = 0; i < ifd.entries.length; i++) if (ifd.entries[i].tag === tag) return ifd.entries[i];
    return null;
  }

  // ---------- value decoding ----------
  function readRationals(entry, little) {
    var dv = new DataView(entry.data.buffer, entry.data.byteOffset, entry.data.byteLength);
    var out = [];
    for (var i = 0; i < entry.data.length; i += 8) {
      var num = little ? dv.getUint32(i, true) : dv.getUint32(i, false);
      var den = little ? dv.getUint32(i + 4, true) : dv.getUint32(i + 4, false);
      out.push(den ? num / den : 0);
    }
    return out;
  }

  function readValue(entry, little) {
    var dv = new DataView(entry.data.buffer, entry.data.byteOffset, entry.data.byteLength);
    var i, out, e;
    switch (entry.type) {
      case 2:
        var s = "";
        for (i = 0; i < entry.data.length && entry.data[i] !== 0; i++) s += String.fromCharCode(entry.data[i]);
        return s;
      case 3:
        out = [];
        for (i = 0; i + 2 <= entry.data.length; i += 2) out.push(little ? dv.getUint16(i, true) : dv.getUint16(i, false));
        return out;
      case 4:
        out = [];
        for (i = 0; i + 4 <= entry.data.length; i += 4) out.push(little ? dv.getUint32(i, true) : dv.getUint32(i, false));
        return out;
      case 5: case 10: return readRationals(entry, entry.type === 10 ? little : little);
      case 9:
        out = [];
        for (i = 0; i + 4 <= entry.data.length; i += 4) out.push(little ? dv.getInt32(i, true) : dv.getInt32(i, false));
        return out;
      default: return entry.data;
    }
  }

  function firstNum(v) { return Array.isArray(v) ? v[0] : v; }

  function dmsToDecimal(ref, vals) {
    if (!vals || vals.length < 3) return null;
    var dec = vals[0] + vals[1] / 60 + vals[2] / 3600;
    if (ref === "S" || ref === "W") dec = -dec;
    return Math.round(dec * 1e6) / 1e6;
  }

  function fmtDms(ref, vals) {
    if (!vals || vals.length < 3) return "";
    var deg = vals[0], min = vals[1], sec = vals[2];
    function r(n) { return Math.round(n * 10000) / 10000; }
    return r(deg) + "° " + r(min) + "' " + r(sec) + '" ' + ref;
  }

  // ---------- field model ----------
  var GROUPS = ["gps", "camera", "time", "image", "rights"];

  // group assignment per tag id (tag 0x8000+ means sub-IFD namespace)
  function groupOf(ns, tag) {
    if (ns === "gps") return "gps";
    if (ns === "ifd0") {
      if (tag === 0x010f || tag === 0x0110 || tag === 0x0131 || tag === 0x013b) return "camera";
      if (tag === 0x0132) return "time";
      if (tag === 0x0112 || tag === 0x0102 || tag === 0x0103 || tag === 0x011a || tag === 0x011b || tag === 0x0128) return "image";
      if (tag === 0x8298) return "rights";
      return "image";
    }
    if (ns === "exif") {
      if (tag === 0x9003 || tag === 0x9004 || tag === 0x9010 || tag === 0x9011 || tag === 0x9012) return "time";
      if (tag === 0xa432 || tag === 0xa433 || tag === 0xa434 || tag === 0xa435) return "camera";
      if (tag === 0x927c) return "camera"; // MakerNote — sensitive vendor blob
      return "image";
    }
    return "image";
  }

  var FIELD_LABELS = {
    0x010f: "Camera make", 0x0110: "Camera model", 0x0131: "Software", 0x0132: "File modified",
    0x9003: "Date taken", 0x9004: "Date digitized", 0x9010: "Timezone offset", 0x9011: "Timezone (original)",
    0x0112: "Orientation", 0x829a: "Exposure time", 0x829d: "F-number", 0x8827: "ISO speed", 0x920a: "Focal length",
    0xa002: "Image width", 0xa003: "Image height", 0x9000: "EXIF version",
    0xa432: "Lens specification", 0xa433: "Lens make", 0xa434: "Lens model",
    0x013b: "Artist", 0x8298: "Copyright", 0x927c: "MakerNote (vendor blob)", 0x9286: "User comment",
    0x0001: "GPS latitude ref", 0x0002: "GPS latitude", 0x0003: "GPS longitude ref", 0x0004: "GPS longitude",
    0x0005: "GPS altitude ref", 0x0006: "GPS altitude", 0x0007: "GPS timestamp", 0x001d: "GPS date",
    0x0012: "GPS map datum", 0x000b: "GPS accuracy", 0x0010: "GPS direction ref", 0x0011: "GPS direction",
    0x001f: "GPS destination"
  };

  function formatValue(tag, entry, little) {
    var v = readValue(entry, little);
    switch (tag) {
      case 0x829a: { var n = firstNum(v); return n ? "1/" + Math.round(1 / n) + " s" : String(v); }
      case 0x829d: { var f = firstNum(v); return f ? "f/" + (Math.round(f * 10) / 10) : String(v); }
      case 0x0006: { var alt = firstNum(v); return alt != null ? Math.round(alt) + " m" : ""; }
      case 0x0112: {
        var o = firstNum(v);
        return ["", "Normal", "Mirror horizontal", "Rotate 180", "Mirror vertical", "Mirror + rotate 270", "Rotate 90", "Mirror + rotate 90", "Rotate 270"][o] || String(o);
      }
    }
    if (Array.isArray(v)) return v.map(function (x) { return typeof x === "number" ? (Math.round(x * 10000) / 10000) : x; }).join(", ");
    if (typeof v === "string") return v;
    return String(v);
  }

  // ---------- read metadata ----------
  function parseExifBlob(u8, tiffBase) {
    var dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
    if (tiffBase + 8 > dv.byteLength) return null;
    var r = makeReader(dv, tiffBase);
    if (!(r.u16(tiffBase) === 0x4949 || r.u16(tiffBase) === 0x4d4d)) return null;
    if (r.u16(tiffBase + 2) !== 42) return null;
    var ifd0 = parseIfd(r, dv, r.u32(tiffBase + 4), tiffBase, u8);
    if (!ifd0) return null;
    var exifPtr = findEntry(ifd0, 0x8769);
    var gpsPtr = findEntry(ifd0, 0x8825);
    var exifIfd = exifPtr ? parseIfd(r, dv, firstNum(readValue(exifPtr, r.little)), tiffBase, u8) : null;
    var gpsIfd = gpsPtr ? parseIfd(r, dv, firstNum(readValue(gpsPtr, r.little)), tiffBase, u8) : null;
    return { reader: r, ifd0: ifd0, exifIfd: exifIfd, gpsIfd: gpsIfd };
  }

  function collectFields(parsed) {
    var fields = [];
    var r = parsed.reader;
    function push(ns, ifd, tagOverride, labelOverride) {
      if (!ifd) return;
      ifd.entries.forEach(function (en) {
        var tag = tagOverride != null ? tagOverride : en.tag;
        var group = groupOf(ns, en.tag);
        var label = labelOverride || FIELD_LABELS[en.tag] || ("Tag 0x" + en.tag.toString(16));
        var value = "";
        try { value = formatValue(en.tag, en, r.little); } catch (e) { value = "(unparsed)"; }
        if (ns === "gps" && en.tag === 0x0002) value = fmtDms(readAscii(firstGpsRef(parsed, 0x0001)) || "N", readValue(en, r.little));
        if (ns === "gps" && en.tag === 0x0004) value = fmtDms(readAscii(firstGpsRef(parsed, 0x0003)) || "E", readValue(en, r.little));
        if (ns === "gps" && (en.tag === 0x0001 || en.tag === 0x0003 || en.tag === 0x0005 || en.tag === 0x0010 || en.tag === 0x0012)) {
          value = readAscii(en.data);
        }
        fields.push({ ns: ns, group: group, tag: en.tag, label: label, value: value });
      });
    }
    push("ifd0", parsed.ifd0);
    push("exif", parsed.exifIfd);
    push("gps", parsed.gpsIfd);
    return fields;
  }

  function readAscii(data) {
    var s = "";
    for (var i = 0; i < data.length && data[i] !== 0; i++) s += String.fromCharCode(data[i]);
    return s;
  }
  function firstGpsRef(parsed, tag) {
    if (!parsed.gpsIfd) return null;
    var en = findEntry(parsed.gpsIfd, tag);
    return en ? en.data : null;
  }

  function gpsDecimal(parsed) {
    if (!parsed.gpsIfd) return null;
    var lat = findEntry(parsed.gpsIfd, 0x0002), lon = findEntry(parsed.gpsIfd, 0x0004);
    if (!lat || !lon) return null;
    var latRef = readAscii((findEntry(parsed.gpsIfd, 0x0001) || {}).data || "") || "N";
    var lonRef = readAscii((findEntry(parsed.gpsIfd, 0x0003) || {}).data || "") || "E";
    var la = dmsToDecimal(latRef, readValue(lat, parsed.reader.little));
    var lo = dmsToDecimal(lonRef, readValue(lon, parsed.reader.little));
    if (la == null || lo == null) return null;
    return { lat: la, lon: lo };
  }

  // Read every metadata field from a buffer. Returns a summary object.
  function readMetadata(u8) {
    var format = detectFormat(u8);
    var out = { format: format, hasExif: false, fields: [], gps: null, tagCount: 0, error: null };
    var parsed = null;
    if (format === "jpeg") {
      var scan = scanJpeg(u8);
      if (scan.error) { out.error = scan.error; return out; }
      for (var i = 0; i < scan.segments.length; i++) {
        var seg = scan.segments[i];
        if (seg.marker === 0xe1 && segStartsWith(u8, seg, "Exif\0\0")) {
          parsed = parseExifBlob(u8, seg.dataOffset + 6);
          break;
        }
      }
    } else if (format === "png") {
      var exifChunk = findPngChunk(u8, "eXIf");
      if (exifChunk) parsed = parseExifBlob(u8, exifChunk.dataOffset);
    } else if (format === "webp") {
      var chunk = findWebpChunk(u8, "EXIF");
      if (chunk) parsed = parseExifBlob(u8, chunk.dataOffset);
    } else if (format === "tiff") {
      parsed = parseExifBlob(u8, 0);
    }
    if (!parsed) return out;
    out.hasExif = true;
    out.fields = collectFields(parsed);
    out.tagCount = out.fields.length;
    out.gps = gpsDecimal(parsed);
    out._parsed = parsed;
    return out;
  }

  // ---------- PNG chunk helpers ----------
  var CRC_TABLE = (function () {
    var t = new Uint32Array(256);
    for (var n = 0; n < 256; n++) {
      var c = n;
      for (var k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
      t[n] = c >>> 0;
    }
    return t;
  })();
  function crc32(u8, start, len) {
    var c = 0xffffffff;
    for (var i = start; i < start + len; i++) c = CRC_TABLE[(c ^ u8[i]) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  }
  function findPngChunk(u8, type) {
    var dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
    var i = 8;
    while (i + 8 <= u8.length) {
      var clen = dv.getUint32(i);
      var t = String.fromCharCode(u8[i + 4], u8[i + 5], u8[i + 6], u8[i + 7]);
      if (t === type) return { offset: i, dataOffset: i + 8, dataLen: clen, total: 12 + clen };
      i += 12 + clen;
      if (t === "IEND") break;
    }
    return null;
  }
  function textKeyword(u8, chunk) {
    // for tEXt/iTXt/zTXt: keyword is nul-terminated (iTXt also nul-terminated)
    var s = "";
    for (var i = 0; i < chunk.dataLen && i < 80; i++) {
      var b = u8[chunk.dataOffset + i];
      if (b === 0) break;
      s += String.fromCharCode(b);
    }
    return s.toLowerCase();
  }

  var PNG_TEXT_META = ["xml:com.adobe.xmp", "exif", "software", "comment", "description", "author", "copyright", "creator", "image description", "pixelminer"];

  // ---------- WebP chunk helpers ----------
  function findWebpChunk(u8, type) {
    var dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
    var i = 12;
    while (i + 8 <= u8.length) {
      var t = String.fromCharCode(u8[i], u8[i + 1], u8[i + 2], u8[i + 3]);
      var clen = dv.getUint32(i + 4, true);
      if (t === type) return { offset: i, dataOffset: i + 8, dataLen: clen, total: 8 + clen + (clen & 1) };
      i += 8 + clen + (clen & 1);
    }
    return null;
  }

  // ---------- TIFF rebuild (selective strip) ----------
  // groups: {ifd0, exif, gps}, each with TIFF entries.
  // Returns Uint8Array of a fresh TIFF blob (header..values), pointers resolved.
  function serializeTiff(little, groups) {
    var entriesOf = function (g) { return g ? g.entries : []; };
    var ifd0 = groups.ifd0, exif = groups.exif, gps = groups.gps;
    var headerSize = 8;
    var ifd0Size = 2 + entriesOf(ifd0).length * 12 + 4;
    var exifSize = exif && exif.entries.length ? 2 + exif.entries.length * 12 + 4 : 0;
    var gpsSize = gps && gps.entries.length ? 2 + gps.entries.length * 12 + 4 : 0;
    var exifAbs = exifSize ? headerSize + ifd0Size : 0;
    var gpsAbs = gpsSize ? headerSize + ifd0Size + exifSize : 0;
    var valueBase = headerSize + ifd0Size + exifSize + gpsSize;

    // pass 1: compute value offsets for every entry
    function prep(g, start) {
      if (!g) return start;
      var off = start;
      g.entries.forEach(function (en) {
        en._valOff = off;
        off += en.data.length + (en.data.length & 1);
      });
      g._valueSize = off - start;
      return off;
    }
    var valueEnd = prep(ifd0, valueBase);
    valueEnd = prep(exif, valueEnd);
    valueEnd = prep(gps, valueEnd);
    var total = valueEnd;

    var buf = new Uint8Array(total);
    var dv = new DataView(buf.buffer);
    var w16 = function (o, v) { little ? dv.setUint16(o, v, true) : dv.setUint16(o, v, false); };
    var w32 = function (o, v) { little ? dv.setUint32(o, v, true) : dv.setUint32(o, v, false); };
    buf[0] = little ? 0x49 : 0x4d; buf[1] = little ? 0x49 : 0x4d;
    w16(2, 42); w32(4, 8);

    function writeIfd(g, base, nextIfdOffset) {
      if (!g) return;
      w16(base, g.entries.length);
      var p = base + 2;
      g.entries.forEach(function (en) {
        w16(p, en.tag); w16(p + 2, en.type); w32(p + 4, en.count);
        if (en.tag === 0x8769 && exifAbs) { w32(p + 8, exifAbs); }
        else if (en.tag === 0x8825 && gpsAbs) { w32(p + 8, gpsAbs); }
        else if (en._pointerTarget !== undefined) { w32(p + 8, en._pointerTarget); }
        else if (en.data.length <= 4) {
          for (var i = 0; i < en.data.length; i++) buf[p + 8 + i] = en.data[i];
        } else { w32(p + 8, en._valOff); }
        p += 12;
      });
      w32(p, nextIfdOffset || 0);
      // values
      var vo = valueBase;
      g.entries.forEach(function (en) {
        if (en._pointerTarget !== undefined) return;
        if (en.data.length > 4) {
          buf.set(en.data, en._valOff);
        }
      });
    }

    writeIfd(ifd0, headerSize, 0);
    if (exifAbs) writeIfd(exif, exifAbs, 0);
    if (gpsAbs) writeIfd(gps, gpsAbs, 0);
    return buf;
  }

  // ---------- strip: JPEG ----------
  var STRIPPED_MARKERS_NOTE = { removedSegments: 0 };

  function stripJpeg(u8, mode, keepGroups) {
    var scan = scanJpeg(u8);
    if (scan.error) throw new Error(scan.error);
    if (scan.segments.filter(function (seg) { return seg.marker === 0xda; }).length > 1) throw new Error("jpeg_multiple_scans");
    var parts = [u8.slice(0, 2)];
    var removed = [];
    var sosDataEnd = -1;

    for (var i = 0; i < scan.segments.length; i++) {
      var seg = scan.segments[i];
      var drop = false;
      if (seg.marker === 0xda) sosDataEnd = seg.lenOffset + 2 + seg.dataLen;
      if (mode === "all") {
        if (seg.marker === 0xe1 && segStartsWith(u8, seg, "Exif\0\0")) {
          var orientationExif = rebuildExifApp1(u8, seg, mode, keepGroups, removed);
          if (orientationExif) parts.push(orientationExif);
          else { drop = true; removed.push("EXIF"); }
          continue;
        }
        if (seg.marker === 0xe1) { drop = true; removed.push("XMP"); }
        else if (seg.marker === 0xe2 && segStartsWith(u8, seg, "MPF\0")) { drop = true; removed.push("MPF (multi-picture)"); }
        else if (seg.marker === 0xed) { drop = true; removed.push("IPTC/Photoshop"); }
        else if (seg.marker === 0xfe) { drop = true; removed.push("Comment"); }
      } else {
        // selective: rebuild the Exif APP1; XMP may embed GPS too — drop it; MPF may embed a second image — drop it
        if (seg.marker === 0xe1 && segStartsWith(u8, seg, "Exif\0\0")) {
          var rebuilt = rebuildExifApp1(u8, seg, mode, keepGroups, removed);
          if (rebuilt) parts.push(rebuilt);
          else { drop = true; removed.push("EXIF"); }
          continue;
        }
        if (seg.marker === 0xe1 && segStartsWith(u8, seg, "http://ns.adobe.com/xap/1.0")) { drop = true; removed.push("XMP"); continue; }
        if (seg.marker === 0xe2 && segStartsWith(u8, seg, "MPF\0")) { drop = true; removed.push("MPF (multi-picture)"); continue; }
      }
      if (!drop) parts.push(u8.slice(seg.offset, seg.lenOffset + 2 + seg.dataLen));
    }
    // entropy-coded image data + EOI live after the SOS header — always carried over
    if (sosDataEnd >= 0 && scan.eoiEnd) parts.push(u8.slice(sosDataEnd, scan.eoiEnd));
    var sizes = 0;
    for (var p = 0; p < parts.length; p++) sizes += parts[p].length;
    var out = new Uint8Array(sizes);
    var o = 0;
    for (p = 0; p < parts.length; p++) { out.set(parts[p], o); o += parts[p].length; }
    return { data: out, removed: removed };
  }

  function rebuildExifApp1(u8, seg, mode, keepGroups, removed) {
    var tiffBase = seg.dataOffset + 6;
    var parsed = parseExifBlob(u8, tiffBase);
    if (!parsed) return null;
    var r = parsed.reader;
    var ifd0Entries = [], exifEntries = [], gpsEntries = [];
    var hadGps = !!parsed.gpsIfd;
    var removedCount = 0;

    parsed.ifd0.entries.forEach(function (en) {
      if (mode === "all" && en.tag !== 0x0112) { removedCount++; return; }
      if (en.tag === 0x8769) {
        // keep the pointer only when some EXIF sub-IFD entries survive (serializeTiff resolves its value)
        if (parsed.exifIfd && filteredExifEntries(parsed.exifIfd, r, mode, keepGroups).length) { ifd0Entries.push(cloneEntry(en)); return; }
        removedCount++;
        return;
      }
      if (en.tag === 0x8825) {
        if (mode === "custom" && keepGroups.gps && parsed.gpsIfd) { ifd0Entries.push(cloneEntry(en)); return; }
        removedCount++;
        return;
      }
      if (mode === "custom" && !keepGroups[groupOf("ifd0", en.tag)]) { removedCount++; return; }
      ifd0Entries.push(cloneEntry(en));
    });
    if (parsed.exifIfd) exifEntries = filteredExifEntries(parsed.exifIfd, r, mode, keepGroups);
    if (mode === "custom" && keepGroups.gps && parsed.gpsIfd) gpsEntries = parsed.gpsIfd.entries.map(cloneEntry);
    removedCount += parsed.ifd0.entries.length + (parsed.exifIfd ? parsed.exifIfd.entries.length : 0) - ifd0Entries.length - exifEntries.length;
    // count GPS tags too
    if (parsed.gpsIfd) removedCount += parsed.gpsIfd.entries.length - gpsEntries.length;

    if (mode === "all" && removedCount) removed.push("EXIF");
    if (hadGps && !gpsEntries.length) removed.push("GPS location");
    if (removedCount && mode === "gps") { /* GPS note already pushed */ }

    var tiff = serializeTiff(r.little, { ifd0: { entries: ifd0Entries }, exif: { entries: exifEntries }, gps: { entries: gpsEntries } });
    if (!ifd0Entries.length && !exifEntries.length) return null;

    // FFE1 | len(2, big-endian, incl. len bytes) | "Exif\0\0" | TIFF
    var magic = [0x45, 0x78, 0x69, 0x66, 0x00, 0x00]; // "Exif\0\0"
    var out = new Uint8Array(4 + magic.length + tiff.length);
    out[0] = 0xff; out[1] = 0xe1;
    new DataView(out.buffer).setUint16(2, magic.length + tiff.length + 2, false);
    out.set(magic, 4);
    out.set(tiff, 4 + magic.length);
    return out;
  }

  function cloneEntry(en) { return { tag: en.tag, type: en.type, count: en.count, data: en.data }; }

  function filteredExifEntries(exifIfd, r, mode, keepGroups) {
    var out = [];
    exifIfd.entries.forEach(function (en) {
      if (mode === "all") return;
      if (mode === "custom" && !keepGroups[groupOf("exif", en.tag)]) return;
      out.push(cloneEntry(en));
    });
    return out;
  }

  // ---------- strip: PNG ----------
  function stripPng(u8, mode, keepGroups) {
    var dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
    var parts = [u8.slice(0, 8)];
    var removed = [];
    var i = 8;
    while (i + 8 <= u8.length) {
      var clen = dv.getUint32(i);
      var t = String.fromCharCode(u8[i + 4], u8[i + 5], u8[i + 6], u8[i + 7]);
      if (clen > u8.length - i - 12) throw new Error("png_truncated");
      var total = 12 + clen;
      var drop = false;
      if (t === "eXIf") {
        var chunkRemoved = [];
        var keptTiff = rebuildExifTiff(u8, i + 8, mode, keepGroups, chunkRemoved);
        drop = true;
        if (keptTiff) parts.push(makePngChunk("eXIf", keptTiff));
        else removed.push("EXIF");
        removed = removed.concat(chunkRemoved);
      }
      else if (t === "tEXt" || t === "iTXt" || t === "zTXt") {
        var kw = textKeyword(u8, { dataOffset: i + 8, dataLen: clen });
        if (kw.indexOf("xml:com.adobe.xmp") !== -1 || kw.indexOf("exif") !== -1 ||
            (mode === "all" && PNG_TEXT_META.some(function (m) { return kw.indexOf(m) !== -1; }))) {
          drop = true;
          removed.push(t + " (" + kw + ")");
        }
      }
      if (!drop) parts.push(u8.slice(i, i + total));
      i += total;
      if (t === "IEND") break;
    }
    var sizes = 0;
    for (var p = 0; p < parts.length; p++) sizes += parts[p].length;
    var out = new Uint8Array(sizes);
    var o = 0;
    for (p = 0; p < parts.length; p++) { out.set(parts[p], o); o += parts[p].length; }
    return { data: out, removed: dedupe(removed) };
  }

  function rebuildExifTiff(u8, tiffBase, mode, keepGroups, removed) {
    var seg = { dataOffset: tiffBase - 6 };
    var app1 = rebuildExifApp1(u8, seg, mode, keepGroups, removed);
    return app1 ? app1.slice(10) : null;
  }

  function makePngChunk(type, data) {
    var out = new Uint8Array(12 + data.length);
    var dv = new DataView(out.buffer);
    dv.setUint32(0, data.length, false);
    for (var i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i);
    out.set(data, 8);
    dv.setUint32(8 + data.length, crc32(out, 4, 4 + data.length), false);
    return out;
  }

  // ---------- strip: WebP ----------
  function stripWebp(u8, mode, keepGroups) {
    var dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
    if (u8.length < 12 || dv.getUint32(4, true) + 8 > u8.length) throw new Error("webp_truncated");
    var parts = [];
    var removed = [];
    var i = 12;
    while (i + 8 <= u8.length) {
      var t = String.fromCharCode(u8[i], u8[i + 1], u8[i + 2], u8[i + 3]);
      var clen = dv.getUint32(i + 4, true);
      if (clen > u8.length - i - 8) throw new Error("webp_truncated");
      var total = 8 + clen + (clen & 1);
      var drop = false;
      if (t === "EXIF") {
        var webpTiffBase = i + 8;
        var prefixedExif = clen >= 6 && segStartsWith(u8, { dataOffset: i + 8, dataLen: clen }, "Exif\0\0");
        if (prefixedExif) webpTiffBase += 6;
        var chunkRemovedWebp = [];
        var keptWebpTiff = rebuildExifTiff(u8, webpTiffBase, mode, keepGroups, chunkRemovedWebp);
        drop = true;
        if (keptWebpTiff) parts.push(makeWebpChunk("EXIF", keptWebpTiff));
        else removed.push("EXIF");
        removed = removed.concat(chunkRemovedWebp);
      }
      else if (t === "XMP ") { drop = true; removed.push("XMP"); }
      else if (t === "VP8X") {
        var chunk = u8.slice(i, i + 8 + clen);
        chunk[8 + 0] = chunk[8 + 0] & ~0x04;
        parts.push(chunk);
        i += total;
        continue;
      }
      if (!drop) parts.push(u8.slice(i, i + total));
      i += total;
    }
    var hasExif = parts.some(function (part) { return part.length >= 4 && String.fromCharCode(part[0], part[1], part[2], part[3]) === "EXIF"; });
    parts.forEach(function (part) {
      if (part.length >= 9 && String.fromCharCode(part[0], part[1], part[2], part[3]) === "VP8X") {
        part[8] = hasExif ? part[8] | 0x08 : part[8] & ~0x08;
        part[8] &= ~0x04;
      }
    });
    var body = 0;
    for (var p = 0; p < parts.length; p++) body += parts[p].length;
    var out = new Uint8Array(12 + body);
    out.set(u8.slice(0, 4), 0);
    out.set(u8.slice(8, 12), 8);
    var o = 12;
    for (p = 0; p < parts.length; p++) { out.set(parts[p], o); o += parts[p].length; }
    new DataView(out.buffer).setUint32(4, out.length - 8, true);
    return { data: out, removed: dedupe(removed) };
  }

  function makeWebpChunk(type, data) {
    var out = new Uint8Array(8 + data.length + (data.length & 1));
    for (var i = 0; i < 4; i++) out[i] = type.charCodeAt(i);
    new DataView(out.buffer).setUint32(4, data.length, true);
    out.set(data, 8);
    return out;
  }

  function dedupe(arr) {
    var seen = {}, out = [];
    arr.forEach(function (x) { if (!seen[x]) { seen[x] = 1; out.push(x); } });
    return out;
  }

  // ---------- public strip ----------
  // mode: "all" | "gps" | "custom"; keepGroups: {gps,camera,time,image,rights} for custom
  function strip(u8, mode, keepGroups) {
    var format = detectFormat(u8);
    var result;
    if (format === "jpeg") result = stripJpeg(u8, mode, keepGroups);
    else if (format === "png") result = stripPng(u8, mode, keepGroups);
    else if (format === "webp") result = stripWebp(u8, mode, keepGroups);
    else throw new Error("unsupported_format");
    return result;
  }

  // ---------- HEIC / canvas re-encode path ----------
  function isHeicFamily(format) { return format === "heic" || format === "avif" || format === "isobmff"; }

  function reencodeToJpeg(file, quality) {
    if (typeof createImageBitmap !== "function") return Promise.reject(new Error("browser_cannot_decode"));
    return createImageBitmap(file).then(function (bmp) {
      var c = document.createElement("canvas");
      var maxSide = 4096;
      var scale = Math.min(1, maxSide / Math.max(bmp.width, bmp.height));
      c.width = Math.round(bmp.width * scale);
      c.height = Math.round(bmp.height * scale);
      var ctx = c.getContext("2d");
      if (!ctx) { bmp.close && bmp.close(); throw new Error("encode_failed"); }
      ctx.drawImage(bmp, 0, 0, c.width, c.height);
      bmp.close && bmp.close();
      return new Promise(function (resolve, reject) {
        c.toBlob(function (b) {
          if (b) resolve(b); else reject(new Error("encode_failed"));
        }, "image/jpeg", quality || 0.92);
      });
    });
  }

  // ---------- DOM layer ----------
  var ERRORS = {
    unsupported_format: "This file type is not supported. Use a JPEG, PNG or WebP image.",
    browser_cannot_decode: "Your browser can't decode this format (iPhone HEIC photos need Safari). Convert the photo to JPEG first, or open this page in Safari.",
    file_too_large: "File is too large to process in the browser. Try images under 50 MB.",
    parse_failed: "Couldn't read this image file — it may be corrupted or an unsupported variant.",
    jpeg_lost_sync: "Couldn't read this JPEG — the file structure looks damaged.",
    jpeg_truncated: "This JPEG looks cut off (incomplete download or export).",
    jpeg_bad_segment: "This JPEG contains a damaged section and can't be processed safely.",
    jpeg_no_eoi: "This JPEG is missing its end marker — it may be truncated.",
    jpeg_unterminated: "Couldn't find the end of this JPEG.",
    jpeg_multiple_scans: "This progressive JPEG uses multiple scans and can't be cleaned safely in this browser tool.",
    png_truncated: "This PNG contains a truncated chunk and can't be processed safely.",
    webp_truncated: "This WebP contains a truncated chunk and can't be processed safely.",
    encode_failed: "Re-encoding failed. Try a different file.",
    not_jpeg: "This doesn't look like a JPEG file."
  };

  function track(name, x1, x2) {
    try {
      var body = JSON.stringify({ e: name, p: location.pathname, x1: x1 || "", x2: x2 || "" });
      if (navigator.sendBeacon) navigator.sendBeacon("/api/evt", new Blob([body], { type: "application/json" }));
      else fetch("/api/evt", { method: "POST", body: body, keepalive: true });
    } catch (e) { /* analytics must never break the tool */ }
  }

  var state = { mode: "all", keepGroups: { gps: false, camera: true, time: true, image: true, rights: false } };

  function bytesToSize(bytes) {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(2) + " MB";
  }

  function errMessage(err) {
    var key = (err && err.message) || String(err);
    return ERRORS[key] || "Something went wrong while processing this image.";
  }

  function suffixFor(mode) { return mode === "gps" ? "_no-gps" : "_clean"; }

  function initTool() {
    var drop = document.getElementById("exif-drop");
    if (!drop) return;
    var fileInput = document.getElementById("exif-file");
    var results = document.getElementById("exif-results");
    var errorBox = document.getElementById("exif-error");
    var pick = document.getElementById("exif-pick");
    var body = document.body;
    var pageMode = body.getAttribute("data-exif-mode") || "full";
    var viewerOnly = pageMode === "viewer";
    if (pageMode === "gps") state.mode = "gps";
    track("exif_open", viewerOnly ? "viewer" : pageMode);

    // mode radios (main tool page)
    document.querySelectorAll("[data-exif-mode-radio]").forEach(function (radio) {
      radio.addEventListener("change", function () {
        state.mode = radio.value;
        var sel = document.getElementById("exif-selective");
        if (sel) sel.hidden = radio.value !== "custom";
      });
    });
    document.querySelectorAll("[data-exif-keep]").forEach(function (cb) {
      cb.addEventListener("change", function () { state.keepGroups[cb.value] = cb.checked; });
    });

    function showError(msg) {
      if (!errorBox) return;
      errorBox.textContent = msg;
      errorBox.hidden = false;
    }
    function clearError() { if (errorBox) errorBox.hidden = true; }

    function handleFiles(fileList) {
      var files = Array.prototype.slice.call(fileList || []);
      if (!files.length) return;
      if (files.length > 20) {
        showError("Please process at most 20 images at a time — showing the first 20.");
        files = files.slice(0, 20);
      }
      clearError();
      if (results) results.innerHTML = "";
      files.forEach(function (f, idx) { processOne(f, idx); });
    }

    function processOne(file, idx) {
      track("exif_start", file.type || "unknown");
      var row = document.createElement("div");
      row.className = "exif-row";
      row.innerHTML = '<div class="exif-row-head"><strong class="exif-name"></strong><span class="exif-size muted"></span></div><div class="exif-row-body"></div>';
      row.querySelector(".exif-name").textContent = file.name;
      row.querySelector(".exif-size").textContent = bytesToSize(file.size);
      if (results) results.appendChild(row);
      var body2 = row.querySelector(".exif-row-body");
      body2.textContent = "Reading…";

      file.arrayBuffer().then(function (buf) {
        var u8 = new Uint8Array(buf);
        var format = detectFormat(u8);
        var meta = readMetadata(u8);

        // HEIC / unsupported-decode path: re-encode to JPEG via canvas
        if (isHeicFamily(format)) {
          body2.innerHTML = '<p class="hint">HEIC/HEIF photo detected — re-encoding locally to JPEG…</p>';
          return reencodeToJpeg(file, 0.92).then(function (blob) {
            return blob.arrayBuffer().then(function (nb) {
              renderResult(row, file, {
                out: new Uint8Array(nb), removed: ["all metadata (re-encoded as fresh JPEG)"],
                note: "The JPEG output is a fresh re-encode: it contains no EXIF from the original. Image quality is slightly re-compressed (JPEG, quality 92), and pixel dimensions may be reduced for very large photos.",
                origMeta: meta, reencoded: true
              }, idx);
            });
          }).catch(function (err) {
            track("exif_fail", "heic_decode");
            body2.innerHTML = "";
            var p = document.createElement("p");
            p.className = "hint warn";
            p.textContent = errMessage(err);
            body2.appendChild(p);
          });
        }

        if (format !== "jpeg" && format !== "png" && format !== "webp") {
          track("exif_fail", format);
          body2.innerHTML = "";
          var p2 = document.createElement("p");
          p2.className = "hint warn";
          p2.textContent = ERRORS.unsupported_format;
          body2.appendChild(p2);
          return;
        }
        if (meta.error) {
          track("exif_fail", meta.error);
          body2.innerHTML = "";
          var p3 = document.createElement("p");
          p3.className = "hint warn";
          p3.textContent = ERRORS[meta.error] || ERRORS.parse_failed;
          body2.appendChild(p3);
          return;
        }

        if (viewerOnly) { renderViewer(row, file, meta, u8); return; }

        var mode = state.mode;
        var keep = state.keepGroups;
        var stripped;
        try { stripped = strip(u8, mode, keep); }
        catch (e) {
          track("exif_fail", e.message || "strip_error");
          body2.innerHTML = "";
          var p4 = document.createElement("p");
          p4.className = "hint warn";
          p4.textContent = errMessage(e);
          body2.appendChild(p4);
          return;
        }
        renderResult(row, file, { out: stripped.data, removed: stripped.removed, origMeta: meta }, idx);
      }).catch(function () {
        track("exif_fail", "read_error");
        if (body2) { body2.textContent = ""; body2.textContent = ERRORS.parse_failed; }
      });
    }

    function fieldListHtml(meta) {
      if (!meta.hasExif || !meta.fields.length) return "";
      var html = '<ul class="exif-fields">';
      meta.fields.forEach(function (f) {
        if (f.group === "gps" && (f.tag === 0x0001 || f.tag === 0x0003 || f.tag === 0x0005 || f.tag === 0x0007 || f.tag === 0x001d)) return;
        html += "<li><span class='k'>" + f.label + "</span><span class='v'></span></li>";
      });
      return html + "</ul>";
    }

    function renderViewer(row, file, meta, u8) {
      track("exif_done", meta.hasExif ? "found" : "none");
      var b = row.querySelector(".exif-row-body");
      b.innerHTML = "";
      if (!meta.hasExif) {
        b.innerHTML = '<p class="hint">No EXIF metadata found in this file.</p>';
        return;
      }
      var head = '<p class="hint">' + meta.fields.length + " metadata entries found." +
        (meta.gps ? ' <strong>GPS location is embedded:</strong> <a class="exif-maps" target="_blank" rel="noopener" href="https://www.google.com/maps?q=' + meta.gps.lat + "," + meta.gps.lon + '">open in Google Maps</a>' : " No GPS location embedded.") + "</p>";
      b.innerHTML = head;
      var tmp = document.createElement("div");
      tmp.innerHTML = fieldListHtml(meta);
      var lis = tmp.querySelectorAll("li");
      var fi = 0;
      meta.fields.forEach(function (f) {
        if (f.group === "gps" && (f.tag === 0x0001 || f.tag === 0x0003 || f.tag === 0x0005 || f.tag === 0x0007 || f.tag === 0x001d)) return;
        lis[fi] && (lis[fi].querySelector(".v").textContent = f.value);
        fi++;
      });
      b.appendChild(tmp.firstElementChild);

      var actions = document.createElement("div");
      actions.className = "exif-actions";
      var copyBtn = document.createElement("button");
      copyBtn.className = "btn btn-ghost";
      copyBtn.type = "button";
      copyBtn.textContent = "Copy as JSON";
      var json = {};
      meta.fields.forEach(function (f) { json[f.label] = f.value; });
      if (meta.gps) { json["GPS latitude (decimal)"] = meta.gps.lat; json["GPS longitude (decimal)"] = meta.gps.lon; }
      copyBtn.addEventListener("click", function () {
        var ta = document.createElement("textarea");
        ta.value = JSON.stringify({ file: file.name, metadata: json }, null, 2);
        document.body.appendChild(ta); ta.select();
        try { document.execCommand("copy"); copyBtn.textContent = "Copied!"; } catch (e) {}
        document.body.removeChild(ta);
        setTimeout(function () { copyBtn.textContent = "Copy as JSON"; }, 1500);
        track("exif_copy_json");
      });
      actions.appendChild(copyBtn);
      b.appendChild(actions);
    }

    function renderResult(row, file, res, idx) {
      track("exif_done", (res.removed || []).length ? "cleaned" : "noop");
      var b = row.querySelector(".exif-row-body");
      b.innerHTML = "";
      var summary = document.createElement("p");
      summary.className = "hint";
      var removedTxt = (res.removed && res.removed.length) ? res.removed.join(", ") : "no removable metadata found";
      summary.textContent = (res.origMeta && res.origMeta.tagCount ? res.origMeta.tagCount + " metadata entries → " : "") + "Removed: " + removedTxt + ".";
      b.appendChild(summary);
      if (res.note) {
        var note = document.createElement("p");
        note.className = "hint warn";
        note.textContent = res.note;
        b.appendChild(note);
      }
      var outSize = res.out.length;
      var blob = new Blob([res.out], { type: res.reencoded ? "image/jpeg" : (file.type || "application/octet-stream") });
      var extMatch = file.name.match(/\.[^.]+$/);
      var ext = res.reencoded ? ".jpg" : (extMatch ? extMatch[0] : "");
      var name = file.name.replace(/\.[^.]+$/, "") + suffixFor(state.mode) + ext;
      var actions = document.createElement("div");
      actions.className = "exif-actions";
      var dl = document.createElement("a");
      dl.className = "btn btn-primary";
      dl.textContent = "Download clean copy (" + bytesToSize(outSize) + ")";
      dl.href = URL.createObjectURL(blob);
      dl.download = name;
      dl.addEventListener("click", function () { track("exif_download", state.mode); });
      actions.appendChild(dl);
      b.appendChild(actions);
    }

    // wiring
    drop.addEventListener("click", function (e) { if (e.target === drop || e.target.closest && !e.target.closest("a,button,input")) { fileInput && fileInput.click(); } });
    pick && pick.addEventListener("click", function (e) { e.stopPropagation(); fileInput && fileInput.click(); });
    fileInput && fileInput.addEventListener("change", function () { handleFiles(fileInput.files); fileInput.value = ""; });
    ["dragenter", "dragover"].forEach(function (ev) {
      drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.add("is-drag"); });
    });
    ["dragleave", "drop"].forEach(function (ev) {
      drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.remove("is-drag"); });
    });
    drop.addEventListener("drop", function (e) {
      if (e.dataTransfer && e.dataTransfer.files) handleFiles(e.dataTransfer.files);
    });
    document.addEventListener("paste", function (e) {
      var items = e.clipboardData && e.clipboardData.files;
      if (items && items.length) handleFiles(items);
    });
  }

  // export
  global.ExifKit = {
    detectFormat: detectFormat,
    readMetadata: readMetadata,
    strip: strip,
    reencodeToJpeg: reencodeToJpeg,
    ERRORS: ERRORS
  };

  if (typeof document !== "undefined") {
    document.addEventListener("DOMContentLoaded", initTool);
  }
})(typeof window !== "undefined" ? window : globalThis);
