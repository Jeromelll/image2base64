const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const context = { Uint8Array, Uint32Array, DataView, ArrayBuffer, Promise, console };
context.globalThis = context;
vm.runInNewContext(fs.readFileSync(require.resolve('../exif.js'), 'utf8'), context);
const kit = context.ExifKit;
const bytes = (...values) => Uint8Array.from(values);
const join = (...arrays) => {
  const out = new Uint8Array(arrays.reduce((n, a) => n + a.length, 0));
  let offset = 0;
  for (const array of arrays) { out.set(array, offset); offset += array.length; }
  return out;
};
const ascii = (s) => Uint8Array.from([...s].map((c) => c.charCodeAt(0)));
const u16le = (n) => bytes(n & 255, n >>> 8 & 255);
const u32le = (n) => bytes(n & 255, n >>> 8 & 255, n >>> 16 & 255, n >>> 24 & 255);
const contains = (data, text) => {
  const needle = ascii(text);
  return data.some((_, i) => needle.every((byte, j) => data[i + j] === byte));
};

function tiff() {
  // Little-endian IFD0 with Orientation=6, camera model and a GPS reference.
  return join(bytes(0x49, 0x49, 42, 0), u32le(8), u16le(3),
    u16le(0x0112), u16le(3), u32le(1), u16le(6), u16le(0),
    u16le(0x0110), u16le(2), u32le(7), u32le(68),
    u16le(0x8825), u16le(4), u32le(1), u32le(50),
    u32le(0), u16le(1), u16le(0x0001), u16le(2), u32le(2), u16le(0x004e), u16le(0), u32le(0), ascii('Camera\0'));
}
function jpegWithExif() {
  const payload = join(ascii('Exif\0\0'), tiff());
  const app1 = join(bytes(0xff, 0xe1), Uint8Array.from([payload.length + 2 >> 8, payload.length + 2 & 255]), payload);
  // Minimal structurally valid JPEG with a scan payload that must survive.
  const frame = bytes(0xff, 0xc0, 0, 11, 8, 0, 1, 0, 1, 1, 1, 0x11, 0);
  const scan = bytes(0xff, 0xda, 0, 8, 1, 1, 0, 0, 63, 0, 0x31, 0xff, 0xd9);
  return join(bytes(0xff, 0xd8), app1, frame, scan);
}
function jpegWithMultipleScans() {
  const frame = bytes(0xff, 0xc0, 0, 11, 8, 0, 1, 0, 1, 1, 1, 0x11, 0);
  const scans = bytes(0xff, 0xda, 0, 8, 1, 1, 0, 0, 63, 0, 0x31,
    0xff, 0xda, 0, 8, 1, 1, 0, 0, 63, 0, 0x32, 0xff, 0xd9);
  return join(bytes(0xff, 0xd8), frame, scans);
}
function pngChunk(type, data) {
  const typeBytes = ascii(type);
  // CRC validity is not needed by ExifKit's chunk scanner; include the complete chunk layout.
  return join(u32le(data.length).reverse(), typeBytes, data, bytes(0, 0, 0, 0));
}
function pngWithExif() {
  return join(bytes(137, 80, 78, 71, 13, 10, 26, 10),
    pngChunk('eXIf', tiff()), pngChunk('eXIf', tiff()),
    pngChunk('tEXt', ascii('XML:com.adobe.xmp\0PRIVATE_XMP_LOCATION')),
    pngChunk('IDAT', bytes(1, 2, 3)), pngChunk('IEND', new Uint8Array()));
}
function webpWithExif() {
  const exif = join(ascii('EXIF'), u32le(tiff().length), tiff(), bytes(0));
  const exif2 = join(ascii('EXIF'), u32le(tiff().length), tiff(), bytes(0));
  const image = join(ascii('VP8 '), u32le(3), bytes(1, 2, 3, 0));
  const length = 4 + exif.length + exif2.length + image.length;
  return join(ascii('RIFF'), u32le(length), ascii('WEBP'), exif, exif2, image);
}

const jpeg = jpegWithExif();
const cleanedJpeg = kit.strip(jpeg, 'all').data;
assert.equal(kit.readMetadata(jpeg).fields.find((f) => f.tag === 0x0112).value, 'Rotate 90');
assert.equal(kit.readMetadata(cleanedJpeg).fields.find((f) => f.tag === 0x0112)?.value, 'Rotate 90', 'all-mode JPEG cleaning should preserve display orientation');
assert.ok(cleanedJpeg.includes(0x31), 'JPEG scan payload should survive');
for (const image of [jpeg, pngWithExif(), webpWithExif()]) {
  const gpsClean = kit.readMetadata(kit.strip(image, 'gps').data);
  assert.ok(gpsClean.fields.some((f) => f.tag === 0x0110), 'GPS-only mode should preserve camera fields');
  assert.ok(gpsClean.fields.some((f) => f.tag === 0x0112), 'GPS-only mode should preserve orientation');
  assert.ok(!gpsClean.fields.some((f) => f.group === 'gps'), 'GPS-only mode should remove GPS fields');
  if (kit.detectFormat(image) === 'png') {
    assert.ok(!contains(kit.strip(image, 'gps').data, 'PRIVATE_XMP_LOCATION'), 'GPS-only PNG cleaning should drop XMP text that may duplicate location');
  }
  const custom = kit.readMetadata(kit.strip(image, 'custom', { gps: true, camera: true, time: true, image: true, rights: true }).data);
  assert.ok(custom.fields.some((f) => f.group === 'gps'), 'custom mode should honor the GPS keep checkbox');
}
assert.equal(kit.readMetadata(pngWithExif()).hasExif, true);
assert.equal(kit.readMetadata(kit.strip(pngWithExif(), 'all').data).fields.map((f) => f.tag).join(','), '274', 'PNG cleaning should retain only orientation');
assert.ok(!contains(kit.strip(pngWithExif(), 'all').data, 'Camera'), 'all PNG EXIF chunks should be rebuilt without private values');
assert.equal(kit.readMetadata(webpWithExif()).hasExif, true);
assert.equal(kit.readMetadata(kit.strip(webpWithExif(), 'all').data).fields.map((f) => f.tag).join(','), '274', 'WebP cleaning should retain only orientation');
assert.ok(!contains(kit.strip(webpWithExif(), 'all').data, 'Camera'), 'all WebP EXIF chunks should be rebuilt without private values');
assert.throws(() => kit.strip(bytes(0xff, 0xd8, 0xff, 0), 'all'), /jpeg_/);
assert.throws(() => kit.strip(jpegWithMultipleScans(), 'all'), /jpeg_multiple_scans/);
assert.throws(() => kit.strip(bytes(1, 2, 3), 'all'), /unsupported_format/);
assert.throws(() => kit.strip(join(bytes(137, 80, 78, 71, 13, 10, 26, 10), bytes(0, 0, 0, 20, 101, 88, 73, 102)), 'all'), /png_truncated/);
assert.throws(() => kit.strip(join(ascii('RIFF'), u32le(100), ascii('WEBP'), ascii('EXIF'), u32le(40)), 'all'), /webp_truncated/);
assert.doesNotThrow(() => kit.readMetadata(join(bytes(0xff, 0xd8, 0xff, 0xe1, 0, 14), ascii('Exif\0\0'), bytes(0x49, 0x49, 42, 0, 8, 0, 0, 0, 0, 0))), 'malformed EXIF should be reported without throwing');
console.log('EXIF format, stripping, orientation and malformed-input checks passed');
