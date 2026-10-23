import test from 'node:test';
import assert from 'node:assert/strict';
import jsQR from 'jsqr';
import { qrcodegen } from '../dist/internal/qrcodegen.js';

function pixels(code, logo = false, scale = 5) {
  const width = (code.size + 8) * scale;
  const data = new Uint8ClampedArray(width * width * 4).fill(255);
  const logoSize = Math.floor(code.size * .2);
  const logoStart = Math.floor((code.size - logoSize) / 2);
  for (let y = 0; y < code.size; y++) for (let x = 0; x < code.size; x++) {
    const covered = logo && x >= logoStart && x < logoStart + logoSize && y >= logoStart && y < logoStart + logoSize;
    if (!code.getModule(x, y) || covered) continue;
    for (let dy = 0; dy < scale; dy++) for (let dx = 0; dx < scale; dx++) {
      const offset = (((y + 4) * scale + dy) * width + (x + 4) * scale + dx) * 4;
      data[offset] = data[offset + 1] = data[offset + 2] = 0;
    }
  }
  return { data, width };
}

for (const [name, level] of Object.entries({ L: qrcodegen.QrCode.Ecc.LOW, M: qrcodegen.QrCode.Ecc.MEDIUM, Q: qrcodegen.QrCode.Ecc.QUARTILE, H: qrcodegen.QrCode.Ecc.HIGH })) {
  test(`independent decoder reads numeric, alphanumeric, URL and UTF-8 payloads at ${name} correction`, () => {
    for (const value of ['01234567890123456789', 'HAIYUE UI 2026', 'https://haiyuestudio.github.io/UI/', '海月工作室 · 二维码 🙂']) {
      const segments = /^[\x00-\x7f]*$/.test(value) ? qrcodegen.QrSegment.makeSegments(value) : [qrcodegen.QrSegment.makeEci(26), qrcodegen.QrSegment.makeBytes([...new TextEncoder().encode(value)])];
      const code = qrcodegen.QrCode.encodeSegments(segments, level, 1, 40, -1, false);
      const image = pixels(code);
      assert.equal(jsQR(image.data, image.width, image.width)?.data, value);
    }
  });
}

test('independent decoder reads H symbols with bounded center coverage across several versions', () => {
  for (const length of [3, 35, 120, 500]) {
    const value = 'a'.repeat(length);
    const code = qrcodegen.QrCode.encodeSegments(qrcodegen.QrSegment.makeSegments(value), qrcodegen.QrCode.Ecc.HIGH, 1, 40, -1, false);
    const image = pixels(code, true);
    assert.equal(jsQR(image.data, image.width, image.width)?.data, value);
  }
});

test('version 40 byte capacity is supported and over-capacity input is rejected', () => {
  const value = 'a'.repeat(2953);
  const code = qrcodegen.QrCode.encodeSegments(qrcodegen.QrSegment.makeSegments(value), qrcodegen.QrCode.Ecc.LOW, 1, 40, -1, false);
  assert.equal(code.version, 40);
  const image = pixels(code, false, 4);
  assert.equal(jsQR(image.data, image.width, image.width)?.data, value);
  assert.throws(() => qrcodegen.QrCode.encodeSegments(qrcodegen.QrSegment.makeSegments(value + 'a'), qrcodegen.QrCode.Ecc.LOW, 1, 40, -1, false), /too long/i);
});
