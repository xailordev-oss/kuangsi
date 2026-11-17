import { expect, type Page } from "@playwright/test";

// ui-brief 1.1: ຈໍ 375px ຕ້ອງບໍ່ມີການເລື່ອນຊ້າຍຂວາ
// ທຽບກັບຄວາມກວ້າງທີ່ຕັ້ງໄວ້ ບໍ່ແມ່ນ window.innerWidth — ໂໝດມືຖືຂອງ Chrome ຂະຫຍາຍ innerWidth ຕາມເນື້ອຫາທີ່ກວ້າງເກີນ
export async function expectNoHorizontalScroll(page: Page) {
  const width = page.viewportSize()?.width;
  if (!width) throw new Error("viewport size is not set");
  const overflow = await page.evaluate((viewport) => {
    const offenders = [...document.querySelectorAll<HTMLElement>("body *")]
      .filter((el) => {
        const r = el.getBoundingClientRect();
        return r.width > 0 && (r.right > viewport + 1 || r.left < -1);
      })
      .slice(0, 5)
      .map((el) => `${el.tagName.toLowerCase()}.${String(el.className).slice(0, 60)}`);
    return { scrollWidth: document.documentElement.scrollWidth, offenders };
  }, width);
  expect(overflow.offenders, "elements wider than the viewport").toEqual([]);
  expect(overflow.scrollWidth).toBeLessThanOrEqual(width);
}

// CLAUDE.md ພາກ 4: ຂໍ້ຄວາມລາວ line-height ≥ 1.7 ແລະ ບໍ່ຖືກຕັດ (ວັນນະຍຸດ/ສະຫຼະ ຊັ້ນເທິງ-ລຸ່ມ)
export async function expectLaoTextNotClipped(page: Page) {
  const issues = await page.evaluate(() => {
    const LAO = /[຀-໿]/;
    const out: string[] = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const seen = new Set<Element>();
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const el = node.parentElement;
      if (!el || seen.has(el) || !LAO.test(node.textContent ?? "")) continue;
      seen.add(el);
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) continue; // ເຊື່ອງຢູ່ (sr-only ຖືກກວດແຍກ)
      const cs = getComputedStyle(el);
      const fontSize = parseFloat(cs.fontSize);
      const lineHeight = cs.lineHeight === "normal" ? NaN : parseFloat(cs.lineHeight);
      const label = `"${(node.textContent ?? "").trim().slice(0, 30)}"`;
      if (!(lineHeight / fontSize >= 1.7 - 0.01)) out.push(`${label} line-height ${cs.lineHeight} / font ${cs.fontSize}`);
      if (cs.textAlign === "justify") out.push(`${label} text-align: justify`);
      // ຖືກຕັດ: ກ່ອງທີ່ຊ່ອນສ່ວນເກີນ ແຕ່ເນື້ອຫາສູງກວ່າກ່ອງ
      for (let a: Element | null = el; a && a !== document.body; a = a.parentElement) {
        const s = getComputedStyle(a);
        const hides = /(hidden|clip)/.test(s.overflowY) || /(hidden|clip)/.test(s.overflow);
        if (hides && a.scrollHeight > a.clientHeight + 1 && s.position !== "absolute") {
          out.push(`${label} clipped by <${a.tagName.toLowerCase()} class="${String(a.className).slice(0, 50)}">`);
          break;
        }
      }
    }
    return out;
  });
  expect(issues).toEqual([]);
}
