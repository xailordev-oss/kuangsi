import { Ban, CheckCheck, CircleCheck, Hourglass, Search, TimerOff } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Dictionary } from "@/lib/i18n/dictionaries";

export type BookingStatus = "pending" | "verifying" | "paid" | "used" | "cancelled" | "expired";

// icon + ຂໍ້ຄວາມສະເໝີ — ບໍ່ໃຊ້ສີຢ່າງດຽວບອກສະຖານະ (ui-brief 1.4)
const STYLE: Record<BookingStatus, { icon: typeof Hourglass; className: string }> = {
  pending: { icon: Hourglass, className: "bg-warning-subtle text-warning" },
  verifying: { icon: Search, className: "bg-warning-subtle text-warning" },
  paid: { icon: CircleCheck, className: "bg-success-subtle text-success" },
  used: { icon: CheckCheck, className: "bg-muted text-neutral" },
  cancelled: { icon: Ban, className: "bg-muted text-neutral" },
  expired: { icon: TimerOff, className: "bg-muted text-neutral" },
};

export function BookingStatusBadge({ status, dict }: { status: BookingStatus; dict: Dictionary }) {
  const { icon: Icon, className } = STYLE[status];
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold", className)}>
      <Icon aria-hidden className="size-4" />
      {dict.status[status]}
    </span>
  );
}
