"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useForm } from "react-hook-form";
import { clsx } from "clsx";
import { createSubmission } from "@/lib/api-mock";
import { WARD_OPTIONS, THEME_LABELS, SUPPORTED_LANGUAGES } from "@/lib/constants";
import { ThemeKey } from "@/types";
import { Spinner } from "@/components/ui";

// ─── Types ────────────────────────────────────────────────────────────────────

type ChannelTab = "text" | "voice" | "photo" | "whatsapp";
type Step = "form" | "submitting" | "success" | "error";

interface CommonFields {
  ward_id: string;
  theme: ThemeKey;
  lang: string;
}

// ─── Channel tab config ───────────────────────────────────────────────────────

const TABS: { id: ChannelTab; label: string; icon: string; color: string; activeColor: string }[] = [
  { id: "text",      label: "Text",      icon: "✍️",  color: "border-gray-200 text-gray-600",        activeColor: "border-primary-500 bg-primary-50 text-primary-700" },
  { id: "voice",     label: "Voice",     icon: "🎙️",  color: "border-gray-200 text-gray-600",        activeColor: "border-purple-500 bg-purple-50 text-purple-700" },
  { id: "photo",     label: "Photo",     icon: "📷",  color: "border-gray-200 text-gray-600",        activeColor: "border-amber-500 bg-amber-50 text-amber-700" },
  { id: "whatsapp",  label: "WhatsApp",  icon: "💬",  color: "border-gray-200 text-gray-600",        activeColor: "border-mint-500 bg-mint-50 text-mint-700" },
];

// ─── Shared ward/theme/lang selectors ────────────────────────────────────────

function CommonSelectors({ register }: { register: any }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      {/* Language */}
      <div className="space-y-1.5">
        <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">🌐 Language</label>
        <select
          {...register("lang")}
          className="w-full border-2 border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white hover:border-gray-300 transition-all"
        >
          {SUPPORTED_LANGUAGES.map((l) => (
            <option key={l.code} value={l.code}>{l.label}</option>
          ))}
        </select>
      </div>

      {/* Category */}
      <div className="space-y-1.5">
        <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">🏷️ Category</label>
        <select
          {...register("theme")}
          className="w-full border-2 border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white hover:border-gray-300 transition-all"
        >
          {(Object.keys(THEME_LABELS) as ThemeKey[]).map((k) => (
            <option key={k} value={k}>{THEME_LABELS[k]}</option>
          ))}
        </select>
      </div>

      {/* Ward */}
      <div className="space-y-1.5">
        <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">📍 Ward / Area</label>
        <select
          {...register("ward_id")}
          className="w-full border-2 border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white hover:border-gray-300 transition-all"
        >
          <option value="">— Select (optional) —</option>
          {WARD_OPTIONS.map((w) => (
            <option key={w.value} value={w.value}>{w.label}</option>
          ))}
        </select>
      </div>
    </div>
  );
}

// ─── Voice recorder hook ──────────────────────────────────────────────────────

function useVoiceRecorder() {
  const [recording, setRecording]   = useState(false);
  const [audioBlob, setAudioBlob]   = useState<Blob | null>(null);
  const [duration, setDuration]     = useState(0);
  const [error, setError]           = useState<string | null>(null);
  const mrRef    = useRef<MediaRecorder | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const start = useCallback(async () => {
    setError(null);
    setAudioBlob(null);
    setDuration(0);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mr = new MediaRecorder(stream);
      const chunks: Blob[] = [];
      mr.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
      mr.onstop = () => {
        setAudioBlob(new Blob(chunks, { type: "audio/webm" }));
        stream.getTracks().forEach((t) => t.stop());
      };
      mr.start(100);
      mrRef.current = mr;
      setRecording(true);
      timerRef.current = setInterval(() => setDuration((d) => d + 1), 1000);
    } catch {
      setError("Microphone access denied. Please allow microphone access and try again.");
    }
  }, []);

  const stop = useCallback(() => {
    mrRef.current?.stop();
    if (timerRef.current) clearInterval(timerRef.current);
    setRecording(false);
  }, []);

  const clear = useCallback(() => {
    setAudioBlob(null);
    setDuration(0);
  }, []);

  // Clean up on unmount
  useEffect(() => () => {
    if (timerRef.current) clearInterval(timerRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
  }, []);

  return { recording, audioBlob, duration, error, start, stop, clear };
}

// ─── Photo uploader ───────────────────────────────────────────────────────────

function PhotoUploader({
  photos,
  onAdd,
  onRemove,
}: {
  photos: File[];
  onAdd: (files: File[]) => void;
  onRemove: (idx: number) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const accept = (files: FileList | null) => {
    if (!files) return;
    const valid = Array.from(files).filter((f) => f.type.startsWith("image/"));
    onAdd(valid);
  };

  return (
    <div className="space-y-3">
      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); accept(e.dataTransfer.files); }}
        onClick={() => inputRef.current?.click()}
        className={clsx(
          "border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all",
          dragging
            ? "border-amber-400 bg-amber-50 scale-[1.01]"
            : "border-gray-200 bg-gray-50 hover:border-amber-300 hover:bg-amber-50/50"
        )}
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => accept(e.target.files)}
        />
        <div className="text-4xl mb-2">📷</div>
        <p className="text-sm font-semibold text-gray-700">Drop photos here or <span className="text-amber-600">browse</span></p>
        <p className="text-xs text-gray-400 mt-1">JPG, PNG, WEBP — up to 5 photos</p>
      </div>

      {/* Previews */}
      {photos.length > 0 && (
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
          {photos.map((file, idx) => (
            <div key={idx} className="relative group aspect-square rounded-xl overflow-hidden border-2 border-gray-200">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={URL.createObjectURL(file)}
                alt={file.name}
                className="w-full h-full object-cover"
              />
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onRemove(idx); }}
                className="absolute top-1 right-1 w-5 h-5 bg-red-500 text-white rounded-full text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity font-bold"
              >
                ×
              </button>
              <div className="absolute bottom-0 left-0 right-0 bg-black/40 text-white text-[9px] px-1 py-0.5 truncate">
                {file.name}
              </div>
            </div>
          ))}
          {photos.length < 5 && (
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="aspect-square rounded-xl border-2 border-dashed border-gray-300 flex items-center justify-center text-gray-400 hover:border-amber-400 hover:text-amber-500 transition-all"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Caption field (shared by voice + photo tabs) ─────────────────────────────

function CaptionField({
  value,
  onChange,
  placeholder,
  required,
  error,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  required?: boolean;
  error?: string;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
        ✍️ Caption / Description {required && <span className="text-rose-500 ml-0.5">*</span>}
      </label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={3}
        placeholder={placeholder}
        className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 resize-none transition-all bg-white hover:border-gray-300"
      />
      {error && (
        <p className="text-rose-500 text-xs flex items-center gap-1">
          <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          {error}
        </p>
      )}
    </div>
  );
}

// ─── WhatsApp deep-link tab ───────────────────────────────────────────────────
// The citizen fills in their request here, then clicks "Open WhatsApp" which
// opens the real WhatsApp app (or web.whatsapp.com) pre-filled with a
// structured message sent to the CivIxa helpline number.

const WA_PHONE = "9199999999"; // Replace with real WhatsApp Business number
const WA_DISPLAY = "+91 9999999999";

// SVG QR-code that encodes the wa.me link — generated as a static inline SVG
// (3-bit module pattern hand-crafted to look like a real QR; in production
//  replace with a real QR library output or pre-generated PNG data URI)
function WhatsAppQR() {
  // Each row is a bitmask of filled (1) modules.  7×7 finder + quiet zone approximation.
  const modules = [
    "1111111011010111111",
    "1000001001001000001",
    "1011101010101011101",
    "1011101001001011101",
    "1011101011101011101",
    "1000001001101000001",
    "1111111010101111111",
    "0000000001100000000",
    "1101011011110110101",
    "0110100110010110010",
    "1010110101011010110",
    "0101001010101001010",
    "1001011101110101101",
    "0000000011001000010",
    "1111111001011110100",
    "1000001011101001011",
    "1011101001010110101",
    "1011101010101010010",
    "1111111011011101101",
  ];
  const SIZE = 19;
  const CELL = 6;
  return (
    <svg
      width={SIZE * CELL + 16}
      height={SIZE * CELL + 16}
      viewBox={`0 0 ${SIZE * CELL + 16} ${SIZE * CELL + 16}`}
      xmlns="http://www.w3.org/2000/svg"
      className="rounded-xl"
      aria-label="QR code for WhatsApp helpline"
    >
      <rect width="100%" height="100%" fill="white" rx="10" />
      {modules.map((row, r) =>
        row.split("").map((cell, c) =>
          cell === "1" ? (
            <rect
              key={`${r}-${c}`}
              x={c * CELL + 8}
              y={r * CELL + 8}
              width={CELL - 1}
              height={CELL - 1}
              fill="#111827"
              rx="1"
            />
          ) : null
        )
      )}
    </svg>
  );
}

function WhatsAppTab({
  register,
  theme,
  ward_id,
  lang,
  onSubmitted,
}: {
  register: any;
  theme: ThemeKey;
  ward_id: string;
  lang: string;
  onSubmitted: (id: string) => void;
}) {
  const [request, setRequest]     = useState("");
  const [copied, setCopied]       = useState(false);
  const [sending, setSending]     = useState(false);
  const [sent, setSent]           = useState(false);
  const [trackingId, setTrackingId] = useState<string | null>(null);

  const wardLabel  = WARD_OPTIONS.find((w) => w.value === ward_id)?.label ?? "";
  const themeLabel = THEME_LABELS[theme] ?? theme;

  // Build the structured WhatsApp message
  const structuredMsg = [
    `🏛️ *CivIxa Development Request*`,
    ``,
    request.trim() ? request.trim() : "[Describe your request here]",
    ``,
    `📋 Category: ${themeLabel}`,
    wardLabel ? `📍 Area: ${wardLabel}` : null,
    lang !== "en" ? `🌐 Language: ${lang.toUpperCase()}` : null,
    ``,
    `_Sent via CivIxa Public Insights_`,
  ]
    .filter((l) => l !== null)
    .join("\n");

  const waUrl = `https://wa.me/${WA_PHONE}?text=${encodeURIComponent(structuredMsg)}`;

  function copyNumber() {
    navigator.clipboard.writeText(WA_DISPLAY.replace(/\s/g, ""));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  // Save submission to the system AND open WhatsApp simultaneously
  async function handleOpenWhatsApp() {
    // ⚠️ window.open MUST be called synchronously within the click handler
    // (trusted user gesture) — calling it after an await gets blocked by browsers.
    // Open a blank tab now, then navigate it to WhatsApp once the save completes.
    // NOTE: do NOT pass "noopener" — that severs the window reference (returns null),
    // making it impossible to set location.href afterwards.
    const waWin = window.open("", "_blank");

    setSending(true);
    try {
      const fd = new FormData();
      fd.append("text_raw", request.trim() || structuredMsg);
      fd.append("channel",  "whatsapp");
      fd.append("lang",     lang);
      fd.append("theme",    theme);
      fd.append("ward_id",  ward_id || "");

      const result = await createSubmission(fd);
      setTrackingId(result.id ?? null);
      setSent(true);
      onSubmitted(result.id ?? "");
    } catch {
      // save failed — still redirect to WhatsApp
    } finally {
      setSending(false);
      // Now point the already-opened tab at the WhatsApp URL
      if (waWin) {
        waWin.location.href = waUrl;
      }
    }
  }

  return (
    <div className="space-y-5 animate-slide-up">

      {/* ── Header banner ───────────────────────────────────────────────────── */}
      <div className="bg-gradient-to-r from-[#075E54] to-[#128C7E] rounded-2xl px-5 py-4 flex items-center gap-4">
        <div className="flex-shrink-0 w-12 h-12 bg-white/15 rounded-xl flex items-center justify-center">
          <svg className="w-7 h-7 text-white" fill="currentColor" viewBox="0 0 24 24">
            <path d="M20.52 3.449C18.24 1.245 15.24 0 12.045 0 5.463 0 .104 5.334.101 11.893c0 2.096.549 4.14 1.595 5.945L0 24l6.335-1.652c1.746.943 3.71 1.444 5.71 1.447h.006c6.585 0 11.946-5.336 11.949-11.896.002-3.176-1.24-6.165-3.48-8.45zM12.045 21.785h-.005c-1.774 0-3.513-.478-5.031-1.378l-.361-.214-3.741.981 1-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.002-5.45 4.436-9.884 9.893-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.891 9.884zm5.43-7.403c-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.148-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.52.148-.174.198-.297.297-.495.099-.198.05-.372-.025-.521-.074-.148-.668-1.612-.916-2.207-.241-.579-.487-.5-.668-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.413-.074-.124-.272-.198-.57-.347z"/>
          </svg>
        </div>
        <div>
          <p className="text-white font-bold text-base leading-snug">Submit via WhatsApp</p>
          <p className="text-white/80 text-xs mt-0.5 leading-relaxed">
            Message our helpline number directly from your WhatsApp
          </p>
        </div>
      </div>

      {/* ── Two-column: QR + phone ───────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row gap-4">

        {/* QR code */}
        <div className="flex flex-col items-center gap-2 bg-gray-50 border-2 border-gray-200 rounded-2xl p-4">
          <WhatsAppQR />
          <p className="text-[11px] text-gray-500 font-medium text-center leading-tight">
            Scan with your phone camera<br />to open WhatsApp
          </p>
        </div>

        {/* Phone number + copy */}
        <div className="flex-1 flex flex-col justify-center gap-3">
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">WhatsApp Helpline Number</p>
            <div className="flex items-center gap-2">
              <span className="text-2xl font-bold text-gray-900 tracking-wide">{WA_DISPLAY}</span>
              <button
                type="button"
                onClick={copyNumber}
                className={clsx(
                  "flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border",
                  copied
                    ? "bg-[#25D366]/10 text-[#075E54] border-[#25D366]/40"
                    : "bg-gray-100 text-gray-600 border-gray-200 hover:bg-gray-200"
                )}
              >
                {copied ? (
                  <>
                    <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    Copied!
                  </>
                ) : (
                  <>
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                    Copy
                  </>
                )}
              </button>
            </div>
          </div>

          <div className="space-y-1.5 text-xs text-gray-500">
            <div className="flex items-start gap-2">
              <span className="text-[#25D366] font-bold mt-0.5">✓</span>
              <span>Works on Android &amp; iPhone WhatsApp</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-[#25D366] font-bold mt-0.5">✓</span>
              <span>Send text, voice note, or photo</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-[#25D366] font-bold mt-0.5">✓</span>
              <span>Any language accepted</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-[#25D366] font-bold mt-0.5">✓</span>
              <span>MP team responds within 48 hours</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Message composer ─────────────────────────────────────────────────── */}
      <div className="space-y-2">
        <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
          ✍️ Describe your request <span className="text-gray-400 font-normal normal-case">(optional — pre-fills your WhatsApp message)</span>
        </label>
        <textarea
          value={request}
          onChange={(e) => setRequest(e.target.value)}
          rows={3}
          placeholder="E.g. The road near our school has been broken for 3 months. Children cannot walk safely…"
          className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#25D366] focus:border-[#25D366] resize-none transition-all bg-white hover:border-gray-300"
        />
      </div>

      <CommonSelectors register={register} />

      {/* ── Pre-filled preview ───────────────────────────────────────────────── */}
      <div className="bg-[#ECE5DD] rounded-2xl p-3">
        <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-2">Message preview</p>
        <div className="bg-[#DCF8C6] rounded-xl rounded-tr-sm px-3 py-2.5 shadow-sm max-w-[90%] ml-auto">
          <pre className="text-xs text-gray-800 whitespace-pre-wrap font-sans leading-relaxed">
            {structuredMsg}
          </pre>
          <p className="text-[10px] text-gray-400 text-right mt-1">
            {new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </p>
        </div>
      </div>

      {/* ── Sent confirmation ────────────────────────────────────────────────── */}
      {sent && trackingId && (
        <div className="bg-[#25D366]/10 border-2 border-[#25D366]/40 rounded-xl p-4 flex items-start gap-3 animate-slide-up">
          <svg className="w-5 h-5 text-[#075E54] flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
          <div className="space-y-0.5">
            <p className="text-sm font-bold text-[#075E54]">Recorded on MP dashboard ✓</p>
            <p className="text-xs text-gray-600">
              Reference: <span className="font-mono text-[#075E54] font-semibold">{trackingId.slice(0, 16)}</span>
            </p>
            <p className="text-xs text-gray-500">WhatsApp has opened — send the pre-filled message to complete your submission.</p>
          </div>
        </div>
      )}

      {/* ── Open WhatsApp button ─────────────────────────────────────────────── */}
      <button
        type="button"
        onClick={handleOpenWhatsApp}
        disabled={sending}
        className="flex items-center justify-center gap-3 w-full py-4 bg-[#25D366] hover:bg-[#20ba58] disabled:opacity-60 disabled:cursor-not-allowed text-white rounded-xl font-bold text-base transition-all shadow-soft hover:shadow-lg transform hover:scale-[1.02]"
      >
        {sending ? (
          <>
            <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <span>Saving &amp; Opening WhatsApp…</span>
          </>
        ) : (
          <>
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
              <path d="M20.52 3.449C18.24 1.245 15.24 0 12.045 0 5.463 0 .104 5.334.101 11.893c0 2.096.549 4.14 1.595 5.945L0 24l6.335-1.652c1.746.943 3.71 1.444 5.71 1.447h.006c6.585 0 11.946-5.336 11.949-11.896.002-3.176-1.24-6.165-3.48-8.45zM12.045 21.785h-.005c-1.774 0-3.513-.478-5.031-1.378l-.361-.214-3.741.981 1-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.002-5.45 4.436-9.884 9.893-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.891 9.884zm5.43-7.403c-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.148-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.52.148-.174.198-.297.297-.495.099-.198.05-.372-.025-.521-.074-.148-.668-1.612-.916-2.207-.241-.579-.487-.5-.668-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.413-.074-.124-.272-.198-.57-.347z"/>
            </svg>
            <span>Open WhatsApp &amp; Send</span>
          </>
        )}
      </button>

      <p className="text-[11px] text-gray-400 text-center">
        Your request is saved to the dashboard the moment you click — WhatsApp opens so you can confirm by sending the message.
      </p>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function SubmissionForm() {
  const [activeTab, setActiveTab] = useState<ChannelTab>("text");
  const [step, setStep]           = useState<Step>("form");
  const [errorMsg, setErrorMsg]   = useState("");
  const [trackingId, setTrackingId] = useState<string | null>(null);

  // Text tab state
  const [textValue, setTextValue] = useState("");
  const [textError, setTextError] = useState("");

  // Voice tab state
  const voice = useVoiceRecorder();
  const [voiceCaption, setVoiceCaption] = useState("");
  const [voiceCaptionError, setVoiceCaptionError] = useState("");

  // Photo tab state
  const [photos, setPhotos]         = useState<File[]>([]);
  const [photoCaption, setPhotoCaption] = useState("");
  const [photoCaptionError, setPhotoCaptionError] = useState("");
  const [photoError, setPhotoError] = useState("");

  // Common fields via react-hook-form
  const { register, getValues, watch, reset } = useForm<CommonFields>({
    defaultValues: { lang: "en", theme: "other", ward_id: "" },
  });

  // Watch form fields so WhatsApp tab preview stays in sync
  const watchedTheme   = watch("theme");
  const watchedWard    = watch("ward_id");
  const watchedLang    = watch("lang");

  // ── Validation ──────────────────────────────────────────────────────────────

  function validate(): boolean {
    let ok = true;

    if (activeTab === "text") {
      if (!textValue.trim() || textValue.trim().length < 10) {
        setTextError("Please describe your request (at least 10 characters).");
        ok = false;
      } else {
        setTextError("");
      }
    }

    if (activeTab === "voice") {
      if (!voice.audioBlob) {
        voice.start();
        ok = false;
      }
      if (!voiceCaption.trim() || voiceCaption.trim().length < 5) {
        setVoiceCaptionError("Please add a brief caption (at least 5 characters).");
        ok = false;
      } else {
        setVoiceCaptionError("");
      }
    }

    if (activeTab === "photo") {
      if (photos.length === 0) {
        setPhotoError("Please attach at least one photo.");
        ok = false;
      } else {
        setPhotoError("");
      }
      if (!photoCaption.trim() || photoCaption.trim().length < 5) {
        setPhotoCaptionError("Please describe what the photo shows (at least 5 characters).");
        ok = false;
      } else {
        setPhotoCaptionError("");
      }
    }

    return ok;
  }

  // ── Submit (text / voice / photo tabs) ──────────────────────────────────────

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    setStep("submitting");

    try {
      const { lang, theme, ward_id } = getValues();
      const fd = new FormData();
      fd.append("lang",    lang);
      fd.append("theme",   theme);
      fd.append("ward_id", ward_id || "");

      if (activeTab === "text") {
        fd.append("text_raw", textValue.trim());
        fd.append("channel",  "web");
      }

      if (activeTab === "voice") {
        fd.append("text_raw", voiceCaption.trim());
        fd.append("channel",  "voice");
        fd.append("media",    voice.audioBlob!, "voice.webm");
      }

      if (activeTab === "photo") {
        fd.append("text_raw", photoCaption.trim());
        fd.append("channel",  "web");
        photos.forEach((photo, i) => fd.append(`media_${i}`, photo, photo.name));
        fd.append("media", photos[0], photos[0].name);
      }

      const result = await createSubmission(fd);
      setTrackingId(result.id ?? null);
      setStep("success");
      reset();
      setTextValue("");
      setVoiceCaption("");
      setPhotoCaption("");
      setPhotos([]);
      voice.clear();
    } catch (err: any) {
      setErrorMsg(err?.message ?? "Something went wrong. Please try again.");
      setStep("error");
    }
  }

  // ── Success screen ───────────────────────────────────────────────────────────

  if (step === "success") {
    return (
      <div className="text-center py-12 space-y-6 animate-scale-in">
        <div className="relative inline-block">
          <div className="absolute inset-0 bg-mint-200 rounded-full blur-2xl opacity-50 animate-pulse-soft" />
          <div className="relative text-7xl">✅</div>
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-bold text-gray-900">Thank you!</h2>
          <p className="text-gray-600 text-base max-w-md mx-auto leading-relaxed">
            Your request has been received. Our AI will analyse it and surface it to your MP with priority ranking.
          </p>
        </div>
        {trackingId && (
          <div className="bg-gradient-to-br from-primary-50 to-purple-50 border-2 border-primary-200 rounded-xl p-4 max-w-sm mx-auto text-left">
            <p className="text-xs font-bold text-gray-700 mb-2">🔖 Your reference number</p>
            <p className="font-mono text-sm text-primary-700 bg-white rounded-lg px-3 py-2 border border-primary-200 select-all break-all">
              {trackingId}
            </p>
            <p className="text-xs text-gray-500 mt-2">Save this to check your request status later.</p>
          </div>
        )}
        <div className="bg-gradient-to-br from-mint-50 to-primary-50 border-2 border-mint-200 rounded-xl p-4 max-w-sm mx-auto">
          <p className="text-xs text-mint-800 font-medium">🤖 AI is processing your submission in the background</p>
        </div>
        <button
          onClick={() => { setStep("form"); setActiveTab("text"); }}
          className="mt-4 px-8 py-3 bg-gradient-to-r from-primary-600 to-primary-700 text-white rounded-xl font-semibold hover:from-primary-700 hover:to-primary-800 transition-all shadow-soft hover:shadow-glow-blue transform hover:scale-105"
        >
          Submit Another Request
        </button>
      </div>
    );
  }

  // ── Error screen ─────────────────────────────────────────────────────────────

  if (step === "error") {
    return (
      <div className="text-center py-12 space-y-6 animate-scale-in">
        <div className="relative inline-block">
          <div className="absolute inset-0 bg-rose-200 rounded-full blur-2xl opacity-50 animate-pulse-soft" />
          <div className="relative text-7xl">❌</div>
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-bold text-gray-900">Oops! Something went wrong</h2>
          <p className="text-gray-600 max-w-md mx-auto">{errorMsg}</p>
        </div>
        <button
          onClick={() => setStep("form")}
          className="mt-4 px-8 py-3 bg-gradient-to-r from-gray-600 to-gray-700 text-white rounded-xl font-semibold hover:from-gray-700 hover:to-gray-800 transition-all shadow-soft transform hover:scale-105"
        >
          Try Again
        </button>
      </div>
    );
  }

  // ── Main form ─────────────────────────────────────────────────────────────────

  return (
    <form onSubmit={handleSubmit} className="space-y-6">

      {/* ── Channel tabs ──────────────────────────────────────────────────────── */}
      <div>
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Choose how to submit</p>
        <div className="grid grid-cols-4 gap-2">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={clsx(
                "flex flex-col items-center gap-1.5 py-3 px-2 rounded-2xl border-2 font-semibold text-xs transition-all",
                activeTab === tab.id ? tab.activeColor : tab.color + " hover:border-gray-300 hover:bg-gray-50"
              )}
            >
              <span className="text-xl">{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ── Tab panels ────────────────────────────────────────────────────────── */}

      {/* TEXT tab */}
      {activeTab === "text" && (
        <div className="space-y-4 animate-slide-up">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
              ✍️ Describe your request <span className="text-rose-500">*</span>
            </label>
            <textarea
              value={textValue}
              onChange={(e) => { setTextValue(e.target.value); if (textError) setTextError(""); }}
              rows={6}
              placeholder="E.g. Our village road is broken and children can't reach school safely. We need urgent repairs before the monsoon season..."
              className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 resize-none transition-all bg-white hover:border-gray-300"
            />
            {textError && (
              <p className="text-rose-500 text-xs flex items-center gap-1">
                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                {textError}
              </p>
            )}
          </div>
          <CommonSelectors register={register} />
        </div>
      )}

      {/* VOICE tab */}
      {activeTab === "voice" && (
        <div className="space-y-5 animate-slide-up">
          {/* Recorder UI */}
          <div className="bg-gradient-to-br from-purple-50 to-primary-50 border-2 border-purple-200 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-sm font-bold text-gray-800">🎙️ Voice Recording</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  Speak your request in any language — AI will transcribe it
                </p>
              </div>
              {voice.recording && (
                <div className="flex items-center gap-2 bg-rose-100 px-3 py-1.5 rounded-full">
                  <span className="w-2 h-2 bg-rose-500 rounded-full animate-pulse" />
                  <span className="text-xs font-bold text-rose-700">
                    {String(Math.floor(voice.duration / 60)).padStart(2, "0")}:
                    {String(voice.duration % 60).padStart(2, "0")}
                  </span>
                </div>
              )}
            </div>

            {/* Waveform placeholder while recording */}
            {voice.recording && (
              <div className="flex items-end justify-center gap-0.5 h-10 mb-4">
                {Array.from({ length: 32 }).map((_, i) => (
                  <div
                    key={i}
                    className="w-1.5 bg-purple-400 rounded-full"
                    style={{
                      height: `${20 + Math.random() * 60}%`,
                      animation: `pulse ${0.4 + Math.random() * 0.4}s ease-in-out infinite alternate`,
                    }}
                  />
                ))}
              </div>
            )}

            <div className="flex items-center gap-3">
              {!voice.recording && !voice.audioBlob && (
                <button
                  type="button"
                  onClick={voice.start}
                  className="flex items-center gap-2 px-5 py-2.5 bg-white border-2 border-purple-300 rounded-xl text-sm font-semibold text-purple-700 hover:bg-purple-50 hover:border-purple-400 transition-all shadow-sm"
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" clipRule="evenodd" />
                  </svg>
                  Start Recording
                </button>
              )}

              {voice.recording && (
                <button
                  type="button"
                  onClick={voice.stop}
                  className="flex items-center gap-2 px-5 py-2.5 bg-rose-500 border-2 border-rose-600 rounded-xl text-sm font-semibold text-white hover:bg-rose-600 transition-all shadow-soft animate-pulse"
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8 7a1 1 0 00-1 1v4a1 1 0 001 1h4a1 1 0 001-1V8a1 1 0 00-1-1H8z" clipRule="evenodd" />
                  </svg>
                  Stop Recording
                </button>
              )}

              {voice.audioBlob && !voice.recording && (
                <>
                  <span className="text-xs text-mint-700 font-semibold flex items-center gap-1.5 bg-mint-100 px-3 py-1.5 rounded-full">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    Recorded ({String(Math.floor(voice.duration / 60)).padStart(2, "0")}:{String(voice.duration % 60).padStart(2, "0")})
                  </span>
                  <button
                    type="button"
                    onClick={voice.clear}
                    className="text-xs text-gray-400 hover:text-rose-500 underline transition-colors"
                  >
                    Re-record
                  </button>
                </>
              )}
            </div>

            {voice.audioBlob && (
              <audio
                controls
                src={URL.createObjectURL(voice.audioBlob)}
                className="mt-3 w-full h-10 rounded-lg"
              />
            )}

            {voice.error && (
              <p className="mt-2 text-xs text-rose-600 flex items-center gap-1">
                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                {voice.error}
              </p>
            )}
          </div>

          <CaptionField
            value={voiceCaption}
            onChange={(v) => { setVoiceCaption(v); if (voiceCaptionError) setVoiceCaptionError(""); }}
            placeholder="Brief description of what you recorded, e.g. 'Road damage on main street'"
            required
            error={voiceCaptionError}
          />
          <CommonSelectors register={register} />
        </div>
      )}

      {/* PHOTO tab */}
      {activeTab === "photo" && (
        <div className="space-y-5 animate-slide-up">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
              📷 Attach Photos <span className="text-rose-500">*</span>
            </label>
            <PhotoUploader
              photos={photos}
              onAdd={(files) => {
                setPhotos((prev) => [...prev, ...files].slice(0, 5));
                setPhotoError("");
              }}
              onRemove={(idx) => setPhotos((prev) => prev.filter((_, i) => i !== idx))}
            />
            {photoError && (
              <p className="text-rose-500 text-xs flex items-center gap-1">
                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                {photoError}
              </p>
            )}
          </div>

          <CaptionField
            value={photoCaption}
            onChange={(v) => { setPhotoCaption(v); if (photoCaptionError) setPhotoCaptionError(""); }}
            placeholder="Describe what the photo shows, e.g. 'Broken road near primary school entrance'"
            required
            error={photoCaptionError}
          />
          <CommonSelectors register={register} />
        </div>
      )}

      {/* WHATSAPP tab — real wa.me deep-link */}
      {activeTab === "whatsapp" && (
        <WhatsAppTab
          register={register}
          theme={watchedTheme}
          ward_id={watchedWard}
          lang={watchedLang}
          onSubmitted={(id) => { setTrackingId(id); }}
        />
      )}

      {/* ── Submit button (text / voice / photo tabs only) ───────────────────── */}
      {activeTab !== "whatsapp" && (
        <button
          type="submit"
          disabled={step === "submitting"}
          className={clsx(
            "w-full py-4 rounded-xl font-semibold text-base transition-all duration-300 flex items-center justify-center gap-2 shadow-soft",
            step === "submitting"
              ? "bg-gray-300 text-gray-500 cursor-not-allowed"
              : "bg-gradient-to-r from-primary-600 to-primary-700 text-white hover:from-primary-700 hover:to-primary-800 hover:shadow-glow-blue transform hover:scale-[1.02]"
          )}
        >
          {step === "submitting" ? (
            <>
              <Spinner size="sm" />
              <span>Submitting your request…</span>
            </>
          ) : (
            <>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
              <span>Submit Request</span>
            </>
          )}
        </button>
      )}
    </form>
  );
}
