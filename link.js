/* link.html only. Builds a personalized link and draws its QR code.
   The QR encoder is a small standard one: byte mode, error correction level M, versions 1 to 10, best of the eight masks. */

const QR = (() => {
  const ECC_M = [0, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26];
  const BLOCKS_M = [0, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5];

  const rawModules = (v) => {
    let r = (16 * v + 128) * v + 64;
    if (v >= 2) { const n = Math.floor(v / 7) + 2; r -= (25 * n - 10) * n - 55; if (v >= 7) r -= 36; }
    return r;
  };
  const dataCodewords = (v) => Math.floor(rawModules(v) / 8) - ECC_M[v] * BLOCKS_M[v];

  const mul = (x, y) => {
    let z = 0;
    for (let i = 7; i >= 0; i--) { z = (z << 1) ^ ((z >>> 7) * 0x11d); z ^= ((y >>> i) & 1) * x; }
    return z & 0xff;
  };
  const divisor = (deg) => {
    const r = new Array(deg).fill(0);
    r[deg - 1] = 1;
    let root = 1;
    for (let i = 0; i < deg; i++) {
      for (let j = 0; j < deg; j++) { r[j] = mul(r[j], root); if (j + 1 < deg) r[j] ^= r[j + 1]; }
      root = mul(root, 2);
    }
    return r;
  };
  const remainder = (data, div) => {
    const r = div.map(() => 0);
    data.forEach((b) => {
      const f = b ^ r.shift();
      r.push(0);
      div.forEach((c, i) => (r[i] ^= mul(c, f)));
    });
    return r;
  };

  const alignPos = (v) => {
    if (v === 1) return [];
    const n = Math.floor(v / 7) + 2;
    const step = v === 32 ? 26 : Math.ceil((v * 4 + 4) / (n * 2 - 2)) * 2;
    const out = [6];
    for (let p = v * 4 + 10; out.length < n; p -= step) out.splice(1, 0, p);
    return out;
  };

  function encode(text) {
    const bytes = Array.from(new TextEncoder().encode(text));
    let v = 1;
    for (; v <= 10; v++) if (4 + (v < 10 ? 8 : 16) + bytes.length * 8 <= dataCodewords(v) * 8) break;
    if (v > 10) return null;
    const cap = dataCodewords(v) * 8;
    const bits = [];
    const put = (val, len) => { for (let i = len - 1; i >= 0; i--) bits.push((val >>> i) & 1); };
    put(4, 4);
    put(bytes.length, v < 10 ? 8 : 16);
    bytes.forEach((b) => put(b, 8));
    put(0, Math.min(4, cap - bits.length));
    put(0, (8 - (bits.length % 8)) % 8);
    for (let pad = 0xec; bits.length < cap; pad ^= 0xec ^ 0x11) put(pad, 8);
    const data = [];
    for (let i = 0; i < bits.length; i += 8) data.push(bits.slice(i, i + 8).reduce((a, b) => (a << 1) | b, 0));

    // Split into blocks, add error correction, interleave.
    const nb = BLOCKS_M[v], ecl = ECC_M[v], raw = Math.floor(rawModules(v) / 8);
    const shortLen = Math.floor(raw / nb), nShort = nb - (raw % nb);
    const div = divisor(ecl);
    const blocks = [];
    for (let i = 0, k = 0; i < nb; i++) {
      const len = shortLen - ecl + (i < nShort ? 0 : 1);
      const d = data.slice(k, k + len);
      k += len;
      const ec = remainder(d, div);
      if (i < nShort) d.push(0);
      blocks.push(d.concat(ec));
    }
    const words = [];
    for (let i = 0; i < blocks[0].length; i++) {
      blocks.forEach((b, j) => { if (i !== shortLen - ecl || j >= nShort) words.push(b[i]); });
    }

    // Function patterns.
    const size = v * 4 + 17;
    const m = Array.from({ length: size }, () => new Array(size).fill(false));
    const fn = Array.from({ length: size }, () => new Array(size).fill(false));
    const set = (x, y, dark) => { m[y][x] = dark; fn[y][x] = true; };
    for (let i = 0; i < size; i++) { set(6, i, i % 2 === 0); set(i, 6, i % 2 === 0); }
    const finder = (cx, cy) => {
      for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) {
        const d = Math.max(Math.abs(dx), Math.abs(dy)), x = cx + dx, y = cy + dy;
        if (x >= 0 && x < size && y >= 0 && y < size) set(x, y, d !== 2 && d !== 4);
      }
    };
    finder(3, 3); finder(size - 4, 3); finder(3, size - 4);
    const ap = alignPos(v);
    ap.forEach((ax, i) => ap.forEach((ay, j) => {
      if ((i === 0 && j === 0) || (i === 0 && j === ap.length - 1) || (i === ap.length - 1 && j === 0)) return;
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) set(ax + dx, ay + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
    }));
    const drawFormat = (mask) => {
      const d = mask; // level M is 00
      let r = d;
      for (let i = 0; i < 10; i++) r = (r << 1) ^ ((r >>> 9) * 0x537);
      const b = ((d << 10) | r) ^ 0x5412;
      const bit = (i) => ((b >>> i) & 1) !== 0;
      for (let i = 0; i <= 5; i++) set(8, i, bit(i));
      set(8, 7, bit(6)); set(8, 8, bit(7)); set(7, 8, bit(8));
      for (let i = 9; i < 15; i++) set(14 - i, 8, bit(i));
      for (let i = 0; i < 8; i++) set(size - 1 - i, 8, bit(i));
      for (let i = 8; i < 15; i++) set(8, size - 15 + i, bit(i));
      set(8, size - 8, true);
    };
    drawFormat(0);
    if (v >= 7) {
      let r = v;
      for (let i = 0; i < 12; i++) r = (r << 1) ^ ((r >>> 11) * 0x1f25);
      const b = (v << 12) | r;
      for (let i = 0; i < 18; i++) {
        const dark = ((b >>> i) & 1) !== 0, a = size - 11 + (i % 3), c = Math.floor(i / 3);
        set(a, c, dark); set(c, a, dark);
      }
    }

    // Codewords in the zigzag.
    let i = 0;
    for (let right = size - 1; right >= 1; right -= 2) {
      if (right === 6) right = 5;
      for (let vert = 0; vert < size; vert++) for (let j = 0; j < 2; j++) {
        const x = right - j, up = ((right + 1) & 2) === 0, y = up ? size - 1 - vert : vert;
        if (!fn[y][x] && i < words.length * 8) { m[y][x] = ((words[i >>> 3] >>> (7 - (i & 7))) & 1) !== 0; i++; }
      }
    }

    const MASKS = [(x, y) => (x + y) % 2, (x, y) => y % 2, (x) => x % 3, (x, y) => (x + y) % 3,
      (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2, (x, y) => (x * y) % 2 + (x * y) % 3,
      (x, y) => ((x * y) % 2 + (x * y) % 3) % 2, (x, y) => ((x + y) % 2 + (x * y) % 3) % 2];
    const applyMask = (k) => {
      for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (!fn[y][x] && MASKS[k](x, y) === 0) m[y][x] = !m[y][x];
    };
    const penalty = () => {
      let p = 0;
      const line = (get) => {
        for (let a = 0; a < size; a++) {
          let run = 1;
          for (let b = 1; b <= size; b++) {
            if (b < size && get(a, b) === get(a, b - 1)) run++;
            else { if (run >= 5) p += run - 2; run = 1; }
          }
          for (let b = 0; b + 10 < size; b++) {
            const s = Array.from({ length: 11 }, (_, k) => (get(a, b + k) ? 1 : 0)).join("");
            if (s === "10111010000" || s === "00001011101") p += 40;
          }
        }
      };
      line((a, b) => m[a][b]);
      line((a, b) => m[b][a]);
      for (let y = 0; y < size - 1; y++) for (let x = 0; x < size - 1; x++) {
        const c = m[y][x];
        if (c === m[y][x + 1] && c === m[y + 1][x] && c === m[y + 1][x + 1]) p += 3;
      }
      let dark = 0;
      m.forEach((row) => row.forEach((c) => { if (c) dark++; }));
      const total = size * size;
      p += Math.max(0, Math.ceil(Math.abs(dark * 20 - total * 10) / total) - 1) * 10;
      return p;
    };
    let best = 0, bestP = Infinity;
    for (let k = 0; k < 8; k++) {
      applyMask(k); drawFormat(k);
      const pk = penalty();
      if (pk < bestP) { bestP = pk; best = k; }
      applyMask(k);
    }
    applyMask(best); drawFormat(best);
    return { size, modules: m, version: v, mask: best };
  }

  return { encode };
})();

function drawQR(canvas, text) {
  const q = QR.encode(text);
  const ctx = canvas.getContext("2d");
  if (!q) { ctx.clearRect(0, 0, canvas.width, canvas.height); return null; }
  const quiet = 4, n = q.size + quiet * 2;
  const scale = Math.floor(canvas.width / n);
  const off = Math.floor((canvas.width - scale * n) / 2);
  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#17191E";
  q.modules.forEach((row, y) => row.forEach((dark, x) => {
    if (dark) ctx.fillRect(off + (x + quiet) * scale, off + (y + quiet) * scale, scale, scale);
  }));
  return q;
}

/** The link Garrison sends. Empty fields stay out of it. */
function buildLink(co, trade, town) {
  const p = new URLSearchParams();
  const c = cleanName(co), t = cleanName(town);
  if (c) p.set("co", c);
  if (TRADES[trade]) p.set("trade", trade);
  if (t) p.set("town", t);
  const qs = p.toString();
  return CONFIG.SITE + "/" + (qs ? "?" + qs : "");
}

(function initLinkBuilder() {
  const form = $("[data-link-builder]");
  if (!form) return;
  const out = $("[data-lb-url]"), open = $("[data-lb-open]"), status = $(".form-status", form);
  const canvas = $("[data-lb-qr]");
  let url = "";
  const render = () => {
    url = buildLink(form.elements.co.value, form.elements.trade.value, form.elements.town.value);
    out.textContent = url;
    open.href = url.replace(CONFIG.SITE + "/", "index.html");
    const q = drawQR(canvas, url);
    status.textContent = q ? "" : "That link is too long for a QR code. The copy button still works.";
    window.__gcQR = q;
  };
  form.addEventListener("input", render);
  form.addEventListener("submit", (e) => e.preventDefault());
  $("[data-lb-copy]").addEventListener("click", async () => {
    try { await navigator.clipboard.writeText(url); status.textContent = "Copied."; }
    catch (e) {
      const r = document.createRange();
      r.selectNodeContents(out);
      const s = getSelection(); s.removeAllRanges(); s.addRange(r);
      status.textContent = "Selected. Press copy on your keyboard.";
    }
  });
  $("[data-lb-qr-save]").addEventListener("click", () => {
    const a = document.createElement("a");
    a.href = canvas.toDataURL("image/png");
    a.download = "garrisoncole-qr.png";
    a.click();
  });
  render();
})();
