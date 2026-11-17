"use client";

import { Loader2, LogIn } from "lucide-react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { canAccessPath, homePathForRole, isRole } from "@/lib/auth/roles";
import type { StaffDictionary } from "@/lib/i18n/staff";

// ກັນ open redirect: ໄປໄດ້ສະເພາະໜ້າພະນັກງານທີ່ບົດບາດນີ້ເຂົ້າໄດ້
function safeCallback(raw: string | null, role: Parameters<typeof canAccessPath>[0]): string {
  if (raw && /^\/(staff|admin)(\/|$)/.test(raw) && !raw.startsWith("//") && canAccessPath(role, raw.split("?")[0])) return raw;
  return homePathForRole(role);
}

export function StaffLoginForm({ dict, lockoutHint }: { dict: StaffDictionary; lockoutHint: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!username.trim() || !password) {
      setError(dict.login.required);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await signIn("credentials", { username: username.trim(), password, redirect: false });
      if (!res || res.error) {
        // ຂໍ້ຕົກລົງ 22: ຊື່ຜິດ / ລະຫັດຜິດ / ຖືກລັອກ → ຂໍ້ຄວາມດຽວກັນ · ບອກ "ຖືກປິດ" ສະເພາະເມື່ອລະຫັດຖືກ
        setError(res?.code === "account_disabled" ? dict.login.disabled : dict.login.failed);
        setBusy(false);
        return;
      }
      const me = await fetch("/api/staff/me").then((r) => (r.ok ? r.json() : null));
      const role = me?.role;
      router.replace(isRole(role) ? safeCallback(searchParams.get("callbackUrl"), role) : "/staff/login");
      router.refresh();
    } catch {
      setError(dict.common.network);
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="username" className="text-base">
          {dict.login.username}
        </Label>
        <Input
          id="username"
          autoComplete="username"
          autoCapitalize="none"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="min-h-11 text-base"
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="password" className="text-base">
          {dict.login.password}
        </Label>
        <Input
          id="password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="min-h-11 text-base"
        />
      </div>
      {error && (
        <p role="alert" className="rounded-md bg-destructive-subtle p-3 text-destructive">
          {error}
        </p>
      )}
      <Button type="submit" size="lg" className="min-h-12 text-base" disabled={busy}>
        {busy ? <Loader2 aria-hidden className="animate-spin" /> : <LogIn aria-hidden />}
        {dict.login.submit}
      </Button>
      <p className="text-sm text-muted-foreground">{lockoutHint}</p>
    </form>
  );
}
