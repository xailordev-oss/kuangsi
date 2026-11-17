import { randomUUID } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

// ຂໍ້ຕົກລົງ 29: ຮູບສະລິບມີເລກບັນຊີຂອງລູກຄ້າ — ເກັບນອກ public/ · ຊື່ໄຟລ໌ UUID ສຸ່ມ · ເປີດຜ່ານ API ທີ່ກວດສິດເທົ່ານັ້ນ
export const PROOF_MAX_BYTES = 5 * 1024 * 1024;

const TYPES = {
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
} as const;
type Ext = keyof typeof TYPES;

const FILE_NAME = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(jpg|png|webp)$/;

function dir(): string {
  // turbopackIgnore: path ຕອນ runtime — ບໍ່ໃຫ້ build trace ທັງໂປຣເຈັກເຂົ້າ output
  return process.env.PROOF_UPLOAD_DIR || path.join(/* turbopackIgnore: true */ process.cwd(), "storage", "proofs");
}

// ກວດຈາກເນື້ອໄຟລ໌ (magic bytes) ບໍ່ແມ່ນນາມສະກຸນ ຫຼື content-type ທີ່ client ສົ່ງມາ
export function detectImageType(bytes: Uint8Array): Ext | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "jpg";
  if (bytes.length >= 8 && [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((b, i) => bytes[i] === b)) return "png";
  if (
    bytes.length >= 12 &&
    String.fromCharCode(...bytes.subarray(0, 4)) === "RIFF" &&
    String.fromCharCode(...bytes.subarray(8, 12)) === "WEBP"
  ) {
    return "webp";
  }
  return null;
}

export async function saveProof(bytes: Uint8Array, ext: Ext): Promise<string> {
  const name = `${randomUUID()}.${ext}`;
  await mkdir(/* turbopackIgnore: true */ dir(), { recursive: true, mode: 0o700 });
  await writeFile(path.join(/* turbopackIgnore: true */ dir(), name), bytes, { mode: 0o600, flag: "wx" });
  return name;
}

// ຊື່ໄຟລ໌ມາຈາກ DB ເທົ່ານັ້ນ ແຕ່ກວດຮູບແບບອີກຄັ້ງ ກັນ path traversal
export async function readProof(name: string): Promise<{ bytes: Buffer; contentType: string } | null> {
  if (!FILE_NAME.test(name)) return null;
  try {
    const bytes = await readFile(path.join(/* turbopackIgnore: true */ dir(), name));
    return { bytes, contentType: TYPES[name.split(".").pop() as Ext] };
  } catch {
    return null;
  }
}

export async function deleteProof(name: string): Promise<void> {
  if (!FILE_NAME.test(name)) return;
  await unlink(path.join(/* turbopackIgnore: true */ dir(), name)).catch(() => undefined);
}

export function imageResponse(file: { bytes: Buffer; contentType: string }): Response {
  return new Response(new Uint8Array(file.bytes), {
    headers: {
      "Content-Type": file.contentType,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Disposition": "inline",
    },
  });
}
