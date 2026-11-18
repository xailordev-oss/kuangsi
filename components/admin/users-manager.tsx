"use client";

import { KeyRound, LockOpen, Plus, UserCheck, UserX } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { CopyButton } from "@/components/booking/copy-button";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Role } from "@/lib/auth/roles";
import { t } from "@/lib/i18n/format";
import type { StaffDictionary } from "@/lib/i18n/staff";

type D = StaffDictionary["admin"]["users"];
export type UserCard = {
  id: string;
  username: string;
  fullName: string;
  email: string;
  role: Role;
  isActive: boolean;
  isSelf: boolean;
  isLastAdmin: boolean;
  lastLoginLabel: string;
  lockedLabel: string | null;
};
type Pending =
  | { kind: "role"; user: UserCard; role: Role }
  | { kind: "deactivate" | "activate" | "reset_password"; user: UserCard };

const ROLES: Role[] = ["admin", "cashier", "scanner", "viewer"];
const selectClass = "min-h-11 w-full rounded-md border border-input bg-background px-2 text-base disabled:opacity-60";

export function UsersManager({ users, d }: { users: UserCard[]; d: D }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<Pending | null>(null);
  const [password, setPassword] = useState<{ name: string; value: string } | null>(null);
  const [adding, setAdding] = useState(false);
  const [roleDraft, setRoleDraft] = useState<Record<string, Role>>({});

  function errorText(code: unknown): string {
    return (typeof code === "string" && (d.errors as Record<string, string>)[code]) || d.errors.validation;
  }

  async function call(url: string, method: "POST" | "PATCH", body: unknown): Promise<Record<string, unknown> | null> {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(url, { method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      if (res.status === 401) router.replace("/staff/login?callbackUrl=/admin/users");
      if (!res.ok) {
        setError(errorText(json.error));
        return null;
      }
      return json;
    } catch {
      setError(errorText("network"));
      return null;
    } finally {
      setBusy(false);
      router.refresh();
    }
  }

  async function confirmPending() {
    if (!pending) return;
    const p = pending;
    setPending(null);
    const body = p.kind === "role" ? { action: "role", role: p.role } : { action: p.kind };
    const res = await call(`/api/admin/users/${p.user.id}`, "PATCH", body);
    if (res && typeof res.password === "string") setPassword({ name: p.user.fullName, value: res.password });
    if (p.kind === "role") {
      setRoleDraft((r) => {
        const next = { ...r };
        delete next[p.user.id];
        return next;
      });
    }
  }

  async function create(form: FormData) {
    const body = Object.fromEntries(["username", "fullName", "email", "role"].map((k) => [k, String(form.get(k) ?? "")]));
    const res = await call("/api/admin/users", "POST", body);
    if (res && typeof res.password === "string") {
      setAdding(false);
      setPassword({ name: body.fullName, value: res.password });
    }
  }

  const question = (p: Pending) =>
    p.kind === "role"
      ? t(d.confirmRole, { name: p.user.fullName, role: d.roles[p.role] })
      : t({ deactivate: d.confirmDeactivate, activate: d.confirmActivate, reset_password: d.confirmReset }[p.kind], { name: p.user.fullName });

  return (
    <div className="flex flex-col gap-3">
      <Button type="button" className="min-h-11 w-fit" onClick={() => setAdding(true)}>
        <Plus aria-hidden />
        {d.add}
      </Button>
      {error && (
        <p role="alert" className="rounded-lg border border-destructive/40 bg-destructive-subtle p-3 text-destructive">
          {error}
        </p>
      )}

      <ul className="grid gap-2 md:grid-cols-2">
        {users.map((u) => {
          // ຂໍ້ຕົກລົງ 45: ປິດປຸ່ມ + ບອກເຫດຜົນ (server ກວດຊ້ຳສະເໝີ)
          const guard = u.isLastAdmin ? d.lastAdmin : u.isSelf ? d.self : null;
          const draft = roleDraft[u.id] ?? u.role;
          return (
            <li key={u.id} data-testid={`user-${u.username}`} className={`flex flex-col gap-2 rounded-lg border p-3 ${u.isActive ? "bg-card" : "bg-muted text-muted-foreground"}`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-semibold">
                  {u.fullName} {u.isSelf && <span className="font-normal text-muted-foreground">{d.you}</span>}
                </span>
                <span className="flex flex-wrap gap-1">
                  <span className="rounded-full bg-primary-subtle px-2.5 py-0.5 text-sm font-semibold text-primary">{d.roleShort[u.role]}</span>
                  <span className={`rounded-full px-2.5 py-0.5 text-sm font-semibold ${u.isActive ? "bg-success-subtle text-success" : "bg-muted text-neutral"}`}>
                    {u.isActive ? d.active : d.inactive}
                  </span>
                </span>
              </div>
              <span className="text-sm">
                {u.username} · <span className="break-all">{u.email}</span>
              </span>
              <span className="text-sm text-muted-foreground">{u.lastLoginLabel}</span>
              {u.lockedLabel && <span className="text-sm font-semibold text-warning">🔒 {u.lockedLabel}</span>}

              <div className="flex gap-2">
                <label className="flex-1">
                  <span className="sr-only">{d.changeRole}</span>
                  <select
                    className={selectClass}
                    value={draft}
                    disabled={busy || Boolean(guard)}
                    aria-describedby={guard ? `guard-${u.id}` : undefined}
                    onChange={(e) => setRoleDraft((r) => ({ ...r, [u.id]: e.target.value as Role }))}
                  >
                    {ROLES.map((r) => (
                      <option key={r} value={r}>
                        {d.roles[r]}
                      </option>
                    ))}
                  </select>
                </label>
                <Button type="button" variant="outline" className="min-h-11" disabled={busy || draft === u.role} onClick={() => setPending({ kind: "role", user: u, role: draft })}>
                  {d.save}
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" className="min-h-11" disabled={busy} onClick={() => setPending({ kind: "reset_password", user: u })}>
                  <KeyRound aria-hidden />
                  {d.resetPassword}
                </Button>
                {u.lockedLabel && (
                  <Button type="button" variant="outline" className="min-h-11" disabled={busy} onClick={() => void call(`/api/admin/users/${u.id}`, "PATCH", { action: "unlock" })}>
                    <LockOpen aria-hidden />
                    {d.unlock}
                  </Button>
                )}
                {u.isActive ? (
                  <Button
                    type="button"
                    variant="outline"
                    className="min-h-11 text-destructive"
                    disabled={busy || Boolean(guard)}
                    aria-describedby={guard ? `guard-${u.id}` : undefined}
                    onClick={() => setPending({ kind: "deactivate", user: u })}
                  >
                    <UserX aria-hidden />
                    {d.deactivate}
                  </Button>
                ) : (
                  <Button type="button" variant="outline" className="min-h-11" disabled={busy} onClick={() => setPending({ kind: "activate", user: u })}>
                    <UserCheck aria-hidden />
                    {d.activate}
                  </Button>
                )}
              </div>
              {guard && (
                <p id={`guard-${u.id}`} className="text-sm text-muted-foreground">
                  {guard}
                </p>
              )}
            </li>
          );
        })}
      </ul>

      <Dialog open={pending !== null} onOpenChange={(o) => !o && setPending(null)}>
        <DialogContent>
          <DialogTitle>{pending?.kind === "role" ? d.changeRole : pending ? { deactivate: d.deactivate, activate: d.activate, reset_password: d.resetPassword }[pending.kind] : ""}</DialogTitle>
          <DialogDescription className="text-base">{pending && question(pending)}</DialogDescription>
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" className="min-h-11" onClick={() => setPending(null)}>
              {d.cancel}
            </Button>
            <Button type="button" className="min-h-11" variant={pending?.kind === "deactivate" ? "destructive" : "default"} onClick={() => void confirmPending()}>
              {d.confirm}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={adding} onOpenChange={setAdding}>
        <DialogContent>
          <DialogTitle>{d.add}</DialogTitle>
          <form
            className="flex flex-col gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              void create(new FormData(e.currentTarget));
            }}
          >
            <div className="flex flex-col gap-1">
              <Label htmlFor="new-username">{d.username}</Label>
              <Input id="new-username" name="username" required minLength={3} maxLength={50} pattern="[a-z0-9_.\-]+" autoCapitalize="none" autoComplete="off" aria-describedby="new-username-hint" />
              <p id="new-username-hint" className="text-sm text-muted-foreground">
                {d.usernameHint}
              </p>
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="new-name">{d.fullName}</Label>
              <Input id="new-name" name="fullName" required maxLength={150} autoComplete="off" />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="new-email">{d.email}</Label>
              <Input id="new-email" name="email" type="email" required maxLength={255} autoComplete="off" />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="new-role">{d.role}</Label>
              <select id="new-role" name="role" defaultValue="cashier" className={selectClass}>
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {d.roles[r]}
                  </option>
                ))}
              </select>
            </div>
            {error && (
              <p role="alert" className="text-destructive">
                {error}
              </p>
            )}
            <DialogFooter className="gap-2">
              <Button type="button" variant="outline" className="min-h-11" onClick={() => setAdding(false)}>
                {d.cancel}
              </Button>
              <Button type="submit" className="min-h-11" disabled={busy}>
                {d.create}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ຂໍ້ຕົກລົງ 46: ລະຫັດຊົ່ວຄາວສະແດງເທື່ອດຽວ — ປິດແລ້ວລ້າງອອກຈາກ state */}
      <Dialog open={password !== null} onOpenChange={(o) => !o && setPassword(null)}>
        <DialogContent>
          <DialogTitle>{password && t(d.passwordTitle, { name: password.name })}</DialogTitle>
          <p data-testid="temp-password" className="select-all rounded-lg bg-muted p-3 text-center font-mono text-2xl tracking-wider">
            {password?.value}
          </p>
          <DialogDescription className="text-base">{d.passwordHint}</DialogDescription>
          <DialogFooter className="gap-2">
            {password && <CopyButton value={password.value} label={d.copy} copiedLabel={d.copied} />}
            <Button type="button" className="min-h-11" onClick={() => setPassword(null)}>
              {d.close}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
