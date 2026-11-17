// ກົດການສະແກນຕອນເນັດຂາດ (ຂໍ້ຕົກລົງ 39) — ບໍ່ແຕະ DOM ຫຼື storage ເພື່ອໃຫ້ທົດສອບໄດ້
import type { TicketLine } from "@/lib/scan/check-in";

export type ManifestTicket = {
  qrToken: string;
  bookingCode: string;
  status: "pending" | "verifying" | "paid" | "used" | "cancelled" | "expired";
  checkedIn: boolean;
  lines: TicketLine[];
};

export type Manifest = { date: string; generatedAt: string; gates: string[]; tickets: ManifestTicket[] };

export type TicketRef = { qrToken?: string; bookingCode?: string };

// offline_ok = ໃຫ້ເຂົ້າຕາມລາຍການໃນເຄື່ອງ ແຕ່ຍັງບໍ່ໄດ້ຢືນຢັນກັບ server (ສີຕ່າງຈາກ ok)
export type OfflineResult = "offline_ok" | "offline_unknown" | "duplicate" | "unpaid" | "cancelled" | "expired";

export type QueuedScan = TicketRef & {
  offlineId: string;
  gate: string;
  scannedAt: string;
  localResult: OfflineResult;
  bookingCode?: string;
};

export function findTicket(manifest: Manifest, ref: TicketRef): ManifestTicket | undefined {
  return manifest.tickets.find((t) => (ref.qrToken ? t.qrToken === ref.qrToken.toLowerCase() : t.bookingCode === ref.bookingCode));
}

export function decideOffline(
  manifest: Manifest | null,
  today: string,
  ref: TicketRef,
  queue: readonly QueuedScan[],
): { result: OfflineResult; ticket?: ManifestTicket } {
  // ລາຍການເກົ່າ (ມື້ອື່ນ) ໃຊ້ບໍ່ໄດ້ — ບໍ່ຮູ້ວ່າປີ້ຂອງມື້ນີ້ມີຫຍັງແດ່
  if (!manifest || manifest.date !== today) return { result: "offline_unknown" };
  const ticket = findTicket(manifest, ref);
  if (!ticket) return { result: "offline_unknown" };
  if (ticket.status === "cancelled") return { result: "cancelled", ticket };
  if (ticket.status === "expired") return { result: "expired", ticket };
  if (ticket.status === "pending" || ticket.status === "verifying") return { result: "unpaid", ticket };
  const letInHere = queue.some((q) => q.bookingCode === ticket.bookingCode && q.localResult === "offline_ok");
  if (ticket.status === "used" || ticket.checkedIn || letInHere) return { result: "duplicate", ticket };
  return { result: "offline_ok", ticket };
}

// ປີ້ທີ່ຖືກປ່ອຍເຂົ້າຕອນ offline ແຕ່ server ບອກວ່າບໍ່ຜ່ານ → ຕ້ອງໃຫ້ພະນັກງານກວດ (ຫ້າມປະຖິ້ມງຽບໆ)
export function needsReview(localResult: OfflineResult, serverResult: string): boolean {
  return localResult === "offline_ok" && serverResult !== "ok";
}

// ບໍ່ຮູ້ຈັກປີ້ → ບໍ່ສົ່ງ sync: ພະນັກງານບໍ່ໄດ້ໃຫ້ເຂົ້າ ຖ້າ server ພົບວ່າຖືກຕ້ອງ ຈະກາຍເປັນ "ໃຊ້ແລ້ວ" ທັງທີ່ບໍ່ໄດ້ເຂົ້າ
export function shouldQueue(result: OfflineResult): boolean {
  return result !== "offline_unknown";
}
