import Link from "next/link";
import { can, type Role } from "@/lib/auth/roles";
import type { StaffDictionary } from "@/lib/i18n/staff";
import { cn } from "@/lib/utils";

// ລິ້ງລະຫວ່າງໜ້າພະນັກງານ — ສະແດງສະເພາະໜ້າທີ່ບົດບາດນີ້ເຂົ້າໄດ້
const LINKS = [
  { href: "/staff/pos", permission: "pos.sell", key: "pos" },
  { href: "/staff/proofs", permission: "proof.verify", key: "proofs" },
  { href: "/staff/scan", permission: "checkin.scan", key: "scan" },
] as const;

export function StaffNav({ role, current, dict }: { role: Role; current: string; dict: StaffDictionary }) {
  const links = LINKS.filter((l) => can(role, l.permission));
  if (links.length < 2) return null;
  return (
    <nav className="flex gap-1 border-b px-2 print:hidden">
      {links.map((l) => (
        <Link
          key={l.href}
          href={l.href}
          aria-current={current === l.href ? "page" : undefined}
          className={cn(
            "flex min-h-11 items-center border-b-2 px-3 text-base",
            current === l.href ? "border-primary font-semibold text-primary" : "border-transparent text-muted-foreground",
          )}
        >
          {dict.nav[l.key]}
        </Link>
      ))}
    </nav>
  );
}
