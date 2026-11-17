"use client";

import { Languages, LogOut } from "lucide-react";
import { signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { StaffDictionary, StaffLocale } from "@/lib/i18n/staff";

const STAFF_LANG_COOKIE = "staff_lang";

// ຂໍ້ຕົກລົງ 21: ປຸ່ມ "ອອກຈາກລະບົບ" ເຫັນຊັດທີ່ມຸມຂວາເທິງ (ບໍ່ຢູ່ເຄິ່ງລຸ່ມ ກັນແຕະໂດຍບັງເອີນ) + ຖາມຢືນຢັນ
// ຂໍ້ຕົກລົງ 33: ເລືອກພາສາ ລາວ/ອັງກິດ ເກັບໃນ cookie
export function StaffHeader({
  title,
  staffName,
  locale,
  dict,
}: {
  title: string;
  staffName?: string;
  locale: StaffLocale;
  dict: StaffDictionary;
}) {
  const router = useRouter();
  const [leaving, setLeaving] = useState(false);

  function setLocale(next: string) {
    document.cookie = `${STAFF_LANG_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur print:hidden">
      <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-2 px-4 py-2">
        <div className="min-w-0">
          <p className="truncate text-lg font-bold text-primary">{title}</p>
          {staffName && <p className="truncate text-sm text-muted-foreground">{staffName}</p>}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <label className="flex min-h-11 items-center gap-1">
            <Languages aria-hidden className="size-4 text-muted-foreground" />
            <span className="sr-only">{dict.common.language}</span>
            <select
              value={locale}
              onChange={(e) => setLocale(e.target.value)}
              className="min-h-11 rounded-md border border-input bg-background px-2 text-base"
            >
              <option value="lo">ລາວ</option>
              <option value="en">English</option>
            </select>
          </label>
          {staffName && (
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline" className="min-h-11 text-base">
                  <LogOut aria-hidden />
                  {dict.common.logout}
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogTitle className="text-lg">{dict.common.logoutConfirm}</DialogTitle>
                <DialogFooter className="gap-2">
                  <DialogClose asChild>
                    <Button variant="outline" className="min-h-11 text-base">
                      {dict.common.cancel}
                    </Button>
                  </DialogClose>
                  <Button
                    className="min-h-11 text-base"
                    disabled={leaving}
                    onClick={() => {
                      setLeaving(true);
                      void signOut({ redirectTo: "/staff/login" });
                    }}
                  >
                    <LogOut aria-hidden />
                    {dict.common.logout}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>
    </header>
  );
}
