import assert from "node:assert/strict";
import { test } from "node:test";
import encodeQR from "qr";
import decodeQR from "qr/decode.js";

// QR ຂອງປີ້ = qr_token (UUID) — ສ້າງແລ້ວຕ້ອງອ່ານກັບຄືນໄດ້ຄືເກົ່າ (ກວດ package ກ່ອນໃຊ້ຈິງ)
function toImage(bits: boolean[][], scale = 4, margin = 4) {
  const size = (bits.length + margin * 2) * scale;
  const data = new Uint8Array(size * size * 4).fill(255);
  bits.forEach((row, y) =>
    row.forEach((dark, x) => {
      if (!dark) return;
      for (let dy = 0; dy < scale; dy++)
        for (let dx = 0; dx < scale; dx++) {
          const i = (((y + margin) * scale + dy) * size + (x + margin) * scale + dx) * 4;
          data[i] = data[i + 1] = data[i + 2] = 0;
        }
    }),
  );
  return { width: size, height: size, data };
}

test("qr_token (UUID) → QR → ອ່ານຄືນໄດ້ຄືເກົ່າ", () => {
  for (const token of [crypto.randomUUID(), crypto.randomUUID(), "KS-7X4K9"]) {
    const bits = encodeQR(token, "raw", { ecc: "medium" });
    assert.equal(decodeQR(toImage(bits)), token);
  }
});

test("SVG ສຳລັບໜ້າປີ້ຂອງລູກຄ້າ", () => {
  const svg = encodeQR(crypto.randomUUID(), "svg", { ecc: "medium" });
  assert.match(svg, /^<svg viewBox="0 0 \d+ \d+"/);
});
