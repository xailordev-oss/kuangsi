import encodeQR from "qr";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { t } from "@/lib/i18n/format";

// QR = qr_token (UUID ເດົາບໍ່ໄດ້) · ສ້າງ SVG ຢູ່ server → ບໍ່ຕ້ອງໂຫຼດ JS ຝັ່ງ browser ແລະ ເປີດ offline ໄດ້
// ລະຫັດຈອງຕົວໃຫຍ່ສຳຮອງຕອນສະແກນບໍ່ໄດ້ (ui-brief 4)
export function QrTicket({ qrToken, bookingCode, dict }: { qrToken: string; bookingCode: string; dict: Dictionary }) {
  const svg = encodeQR(qrToken, "svg", { ecc: "medium", border: 4 });
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border-2 border-primary bg-white p-4 text-center">
      <div
        role="img"
        aria-label={t(dict.ticket.qrAlt, { code: bookingCode })}
        className="w-full max-w-72 [&>svg]:h-auto [&>svg]:w-full"
        dangerouslySetInnerHTML={{ __html: svg }}
      />
      <p className="text-sm text-muted-foreground">{dict.ticket.showAtGate}</p>
      <p className="text-3xl font-bold tracking-[0.2em] tabular-nums">{bookingCode}</p>
      <p className="text-sm text-muted-foreground">☀ {dict.ticket.brightness}</p>
    </div>
  );
}
