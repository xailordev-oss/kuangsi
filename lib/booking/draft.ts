"use client";

import { useCallback, useEffect, useState } from "react";

// ຮ່າງການຈອງລະຫວ່າງຂັ້ນ 1–3 ເກັບໃນ sessionStorage ຂອງ tab ນີ້ (ບໍ່ສົ່ງໄປ server ຈົນກວ່າຈະຢືນຢັນ)
// ຖ້າ storage ໃຊ້ບໍ່ໄດ້ (private mode) ຍັງໃຊ້ໄດ້ໃນໜ້າດຽວ ແຕ່ຈະຫາຍເມື່ອ refresh
export type DraftCustomer = {
  fullName: string;
  phone: string;
  email?: string;
  nationality?: string;
  idType?: "national_id" | "passport" | "other";
  idNumber?: string;
  phoneCountry: string;
  phoneNational: string;
};

export type BookingDraft = {
  visitDate?: string;
  group: "lao" | "foreigner" | "mixed";
  tickets: Record<string, number>;
  addOns: Record<string, number>;
  customer?: DraftCustomer;
};

const KEY = "kuangsi-booking-draft-v1";

function read(): BookingDraft | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as BookingDraft) : null;
  } catch {
    return null;
  }
}

function write(draft: BookingDraft) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(draft));
  } catch {
    // storage ຖືກປິດ — ບໍ່ເປັນຫຍັງ
  }
}

export function clearDraft() {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    // storage ຖືກປິດ
  }
}

export function useDraft(initial: BookingDraft) {
  const [draft, setDraft] = useState<BookingDraft>(initial);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const stored = read();
    // ອ່ານ sessionStorage ໄດ້ສະເພາະຫຼັງ hydrate — ບໍ່ດັ່ງນັ້ນ HTML ຂອງ server ກັບ client ຈະບໍ່ກົງກັນ
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (stored) setDraft({ ...initial, ...stored });
    setReady(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const update = useCallback((patch: Partial<BookingDraft> | ((d: BookingDraft) => BookingDraft)) => {
    setDraft((prev) => {
      const next = typeof patch === "function" ? patch(prev) : { ...prev, ...patch };
      write(next);
      return next;
    });
  }, []);

  return { draft, update, ready };
}
