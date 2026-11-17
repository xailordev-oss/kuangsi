import { Store } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import type { Dictionary } from "@/lib/i18n/dictionaries";

// ຂໍ້ຕົກລົງ 28: ບັນຊີທະນາຄານຍັງເປັນ TODO → ບໍ່ມີທາງຈ່າຍ online
export function OnlineClosedNotice({ dict }: { dict: Dictionary }) {
  return (
    <Alert className="border-warning/40 bg-warning-subtle text-foreground">
      <Store aria-hidden className="text-warning" />
      <AlertTitle className="text-base font-semibold">{dict.onlineClosed.title}</AlertTitle>
      <AlertDescription className="text-base text-foreground">{dict.onlineClosed.body}</AlertDescription>
    </Alert>
  );
}
