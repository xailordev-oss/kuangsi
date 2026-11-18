import Link from "next/link";
import { can, type Role } from "@/lib/auth/roles";
import type { StaffDictionary } from "@/lib/i18n/staff";
import { cn } from "@/lib/utils";

// ລິ້ງລະຫວ່າງໜ້າພະນັກງານ — ສະແດງສະເພາະໜ້າທີ່ບົດບາດນີ້ເຂົ້າໄດ້
const LINKS = [
  { href: "/admin", permission: "report.read", key: "overview" },
  { href: "/admin/bookings", permission: "booking.read", key: "bookings" },
  { href: "/admin/reports", permission: "report.read", key: "reports" },
  { href: "/admin/scan-reviews", permission: "report.read", key: "scanReviews" },
  { href: "/admin/users", permission: "users.manage", key: "users" },
  { href: "/admin/ticket-types", permission: "catalog.manage", key: "catalog" },
  { href: "/admin/settings", permission: "settings.manage", key: "settings" },
  { href: "/staff/pos", permission: "pos.sell", key: "pos" },
  { href: "/staff/proofs", permission: "proof.verify", key: "proofs" },
  { href: "/staff/scan", permission: "checkin.scan", key: "scan" },
] as const;

export function StaffNav({ role, current, dict }: { role: Role; current: string; dict: StaffDictionary }) {
  const links = LINKS.filter((l) => can(role, l.permission));
  if (links.length < 2) return null;
  return (
    // admin ມີ 7 ລິ້ງ → ຂຶ້ນແຖວໃໝ່ (ບໍ່ເຊື່ອງລິ້ງໄວ້ນອກຈໍ)
    <nav className="flex flex-wrap border-b px-2 print:hidden">
      {links.map((l) => (
        <Link
          key={l.href}
          href={l.href}
          aria-current={current === l.href ? "page" : undefined}
          className={cn(
            "flex min-h-11 items-center whitespace-nowrap border-b-2 px-2.5 text-base",
            current === l.href ? "border-primary font-semibold text-primary" : "border-transparent text-muted-foreground",
          )}
        >
          {dict.nav[l.key]}
        </Link>
      ))}
    </nav>
  );
}
