import { Check, Copy, MessageCircle } from "lucide-react";
import { useState } from "react";
import { useToast } from "./ui";
import { copyText } from "../lib/hooks";
import { waLink } from "../lib/wa";

/**
 * Dua cara mengirim pengingat: buka WhatsApp langsung, atau salin teksnya saja
 * (berguna untuk ditempel di grup, di WA Business, atau bila nomor belum diisi).
 * `onUse` dipanggil di kedua cara — mis. untuk mencatat "sudah diingatkan".
 */
export function WaActions({ phone, message, label = "Kirim WA", onUse, size = "sm", variant = "primary", copyLabel = "Salin teks", hideLabelOnMobile = false }: {
  phone: string | null | undefined;
  message: string;
  label?: string;
  onUse?: (how: "wa" | "copy") => void | Promise<void>;
  size?: "sm" | "md";
  variant?: "primary" | "soft" | "dark";
  copyLabel?: string;
  hideLabelOnMobile?: boolean;
}) {
  const toast = useToast();
  const [copied, setCopied] = useState(false);
  const link = waLink(phone, message);
  const sm = size === "sm" ? "btn-sm" : "";
  const ic = size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4";
  const txt = hideLabelOnMobile ? "hidden sm:inline" : "";

  const copy = async () => {
    if (!(await copyText(message))) return toast("Gagal menyalin — coba lagi", "err");
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
    toast("Teks pengingat tersalin");
    await onUse?.("copy");
  };
  const open = async () => {
    if (!link) return toast("Nomor WA belum diisi — pakai Salin teks", "err");
    window.open(link, "_blank");
    await onUse?.("wa");
  };

  return (
    <span className="inline-flex shrink-0 items-stretch">
      <button type="button" onClick={open} disabled={!link} title={link ? "Buka WhatsApp dengan pesan terisi" : "Nomor WA belum diisi"}
        className={`btn-${variant} ${sm} rounded-r-none`}>
        <MessageCircle className={ic} /> <span className={txt}>{label}</span>
      </button>
      <button type="button" onClick={copy} title="Salin teks pengingat"
        className={`btn-ghost ${sm} -ml-px rounded-l-none`}>
        {copied ? <Check className={`${ic} text-emerald-600`} /> : <Copy className={ic} />}
        <span className={size === "sm" ? "hidden sm:inline" : ""}>{copied ? "Tersalin" : copyLabel}</span>
      </button>
    </span>
  );
}
