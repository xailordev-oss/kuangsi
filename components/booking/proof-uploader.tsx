"use client";

import { Camera, ImageIcon, Loader2, Send } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { t } from "@/lib/i18n/format";

// ຄືກັບ server (lib/payments/proof-storage.ts) — server ກວດເນື້ອໄຟລ໌ອີກຄັ້ງ
const MAX_MB = 5;
const ACCEPT = "image/jpeg,image/png,image/webp";

export function ProofUploader({ bookingCode, dict }: { bookingCode: string; dict: Dictionary }) {
  const router = useRouter();
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview);
  }, [preview]);

  function choose(f: File | undefined) {
    setError(null);
    if (!f) return;
    if (!ACCEPT.split(",").includes(f.type) || f.size > MAX_MB * 1024 * 1024) {
      setError(t(dict.pay.errFile, { mb: MAX_MB }));
      return;
    }
    setFile(f);
    setPreview(URL.createObjectURL(f));
  }

  async function send() {
    if (!file) return;
    setSending(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("proof", file);
      const res = await fetch(`/api/public/bookings/${bookingCode}/proof`, { method: "POST", body: form });
      if (res.status === 201) {
        router.refresh();
        return;
      }
      const body = await res.json().catch(() => ({}));
      if (body.error === "invalid_file") setError(t(dict.pay.errFile, { mb: MAX_MB }));
      else if (body.error === "not_pending") router.refresh();
      else setError(dict.pay.errUpload);
    } catch {
      setError(dict.error.network);
    }
    setSending(false);
  }

  return (
    <div className="flex flex-col gap-3">
      <input ref={cameraRef} type="file" accept={ACCEPT} capture="environment" className="sr-only" tabIndex={-1} onChange={(e) => choose(e.target.files?.[0])} />
      <input ref={galleryRef} type="file" accept={ACCEPT} className="sr-only" tabIndex={-1} onChange={(e) => choose(e.target.files?.[0])} />

      {preview ? (
        // eslint-disable-next-line @next/next/no-img-element -- blob: URL ໃຊ້ next/image ບໍ່ໄດ້
        <img src={preview} alt={dict.pay.previewAlt} className="max-h-80 w-full rounded-xl border object-contain" />
      ) : null}

      <div className="grid grid-cols-2 gap-2">
        <Button type="button" variant="outline" className="min-h-12 text-base" onClick={() => cameraRef.current?.click()} disabled={sending}>
          <Camera aria-hidden />
          {preview ? dict.pay.changePhoto : dict.pay.takePhoto}
        </Button>
        <Button type="button" variant="outline" className="min-h-12 text-base" onClick={() => galleryRef.current?.click()} disabled={sending}>
          <ImageIcon aria-hidden />
          {dict.pay.choosePhoto}
        </Button>
      </div>

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      {file && (
        <Button type="button" size="lg" className="min-h-12 text-base" onClick={send} disabled={sending}>
          {sending ? <Loader2 aria-hidden className="animate-spin" /> : <Send aria-hidden />}
          {sending ? dict.pay.uploading : dict.pay.submitProof}
        </Button>
      )}
    </div>
  );
}
