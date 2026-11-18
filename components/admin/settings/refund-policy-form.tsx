"use client";

import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { SaveFeedback, useSettingsSave, type SD } from "@/components/admin/settings/save-kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { PolicyTier } from "@/lib/refunds/policy";

// ຂໍ້ຕົກລົງ 53: ຂັ້ນນະໂຍບາຍຈາກ refund_policies — ບັນທຶກທັງຊຸດ · server ຂໍຢືນຢັນເກົ່າ-ໃໝ່ທຸກຄັ້ງ
export function RefundPolicyForm({ initial, d }: { initial: PolicyTier[]; d: SD }) {
  const s = useSettingsSave(d);
  const p = d.refundPolicy;
  const [rows, setRows] = useState(initial.map((t) => ({ hours: String(t.hoursBefore), percent: String(t.refundPercent) })));
  const set = (i: number, patch: Partial<(typeof rows)[number]>) => setRows((r) => r.map((x, j) => (j === i ? { ...x, ...patch } : x)));

  return (
    <form
      className="flex flex-col gap-3"
      data-testid="refund-policy"
      onSubmit={(e) => {
        e.preventDefault();
        void s.send("/api/admin/settings/refund-policies", "PUT", { tiers: rows.map((r) => ({ hoursBefore: Number(r.hours), refundPercent: Number(r.percent) })) });
      }}
    >
      <p className="text-muted-foreground">{p.intro}</p>
      {rows.length === 0 && <p className="rounded-lg border border-dashed p-4">{p.empty}</p>}
      <ul className="flex flex-col gap-2">
        {rows.map((r, i) => (
          <li key={i} className="grid grid-cols-[1fr_1fr_auto] items-end gap-2">
            <label className="flex flex-col gap-1">
              <span className="text-sm">{p.hours}</span>
              <Input className="min-h-11 text-base" type="number" inputMode="numeric" min={1} max={8760} required value={r.hours} onChange={(e) => set(i, { hours: e.target.value })} />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-sm">{p.percent}</span>
              <Input className="min-h-11 text-base" type="number" inputMode="numeric" min={0} max={100} required value={r.percent} onChange={(e) => set(i, { percent: e.target.value })} />
            </label>
            <Button type="button" variant="outline" className="min-h-11" aria-label={p.remove} onClick={() => setRows((x) => x.filter((_, j) => j !== i))}>
              <Trash2 aria-hidden />
            </Button>
          </li>
        ))}
      </ul>
      <p className="text-sm text-muted-foreground">{p.none}</p>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" className="min-h-11" disabled={rows.length >= 10} onClick={() => setRows((x) => [...x, { hours: "", percent: "" }])}>
          <Plus aria-hidden />
          {p.add}
        </Button>
        <Button type="submit" className="min-h-11" disabled={s.busy}>
          {s.busy ? d.saving : d.save}
        </Button>
      </div>
      <SaveFeedback s={s} d={d} />
    </form>
  );
}
