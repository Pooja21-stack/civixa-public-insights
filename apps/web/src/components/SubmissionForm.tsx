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
  const { register, getValues, reset } = useForm<CommonFields>({
    defaultValues: { lang: "en", theme: "other", ward_id: "" },
  });

  // WhatsApp demo chat state
  const [waMessage, setWaMessage]   = useState("");
  const [waError, setWaError]       = useState("");
  const [waChatLog, setWaChatLog]   = useState<{ from: "user" | "bot"; text: string }[]>([]);
  const [waSending, setWaSending]   = useState(false);

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

  // ── WhatsApp demo send ───────────────────────────────────────────────────────

  async function sendWhatsAppMessage() {
    const msg = waMessage.trim();
    if (!msg || msg.length < 5) {
      setWaError("Please type at least 5 characters.");
      return;
    }
    setWaError("");
    setWaSending(true);
    setWaChatLog((prev) => [...prev, { from: "user", text: msg }]);
    setWaMessage("");

    try {
      const { lang, theme, ward_id } = getValues();
      const fd = new FormData();
      fd.append("text_raw", msg);
      fd.append("channel",  "whatsapp");
      fd.append("lang",     lang);
      fd.append("theme",    theme);
      fd.append("ward_id",  ward_id || "");

      const result = await createSubmission(fd);
      setTrackingId(result.id ?? null);

      // Bot acknowledgement after short delay
      setTimeout(() => {
        setWaChatLog((prev) => [
          ...prev,
          {
            from: "bot",
            text: `✅ Thank you! We've received your development suggestion and will review it shortly.\n\n🔖 Ref: ${result.id?.slice(0, 8) ?? "—"}`,
          },
        ]);
        setWaSending(false);
      }, 900);
    } catch {
      setWaChatLog((prev) => [
        ...prev,
        { from: "bot", text: "⚠️ Sorry, we couldn't save your message right now. Please try again." },
      ]);
      setWaSending(false);
    }
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

      {/* WHATSAPP tab — demo chat simulator */}
      {activeTab === "whatsapp" && (
        <div className="space-y-4 animate-slide-up">

          {/* Phone-frame chat window */}
          <div className="border-2 border-[#25D366]/40 rounded-2xl overflow-hidden shadow-soft">
            {/* WhatsApp-style header bar */}
            <div className="bg-[#075E54] px-4 py-3 flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-[#25D366] flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                C
              </div>
              <div>
                <p className="text-white text-sm font-semibold leading-none">CivIxa Helpline Bot</p>
                <p className="text-[#25D366] text-[10px] mt-0.5">
                  {waSending ? "typing…" : "online · Demo mode"}
                </p>
              </div>
              <span className="ml-auto text-[10px] font-semibold bg-[#25D366]/20 text-[#25D366] px-2 py-0.5 rounded-full">
                DEMO
              </span>
            </div>

            {/* Chat messages */}
            <div className="bg-[#ECE5DD] min-h-[200px] max-h-[280px] overflow-y-auto p-3 space-y-2 flex flex-col">
              {/* Welcome message from bot */}
              {waChatLog.length === 0 && (
                <div className="self-start max-w-[80%]">
                  <div className="bg-white rounded-2xl rounded-tl-sm px-3 py-2 shadow-sm">
                    <p className="text-xs text-gray-800 leading-relaxed">
                      👋 Hello! I&apos;m the CivIxa bot. Type your development request below and I&apos;ll pass it to your MP&apos;s dashboard. You can write in <strong>any language</strong>.
                    </p>
                    <p className="text-[10px] text-gray-400 text-right mt-1">Now</p>
                  </div>
                </div>
              )}

              {/* Dynamic chat log */}
              {waChatLog.map((msg, i) => (
                <div
                  key={i}
                  className={clsx("max-w-[80%]", msg.from === "user" ? "self-end" : "self-start")}
                >
                  <div
                    className={clsx(
                      "px-3 py-2 shadow-sm text-xs leading-relaxed whitespace-pre-line",
                      msg.from === "user"
                        ? "bg-[#DCF8C6] rounded-2xl rounded-tr-sm text-gray-800"
                        : "bg-white rounded-2xl rounded-tl-sm text-gray-800"
                    )}
                  >
                    {msg.text}
                    <p className="text-[10px] text-gray-400 text-right mt-1">
                      {new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                </div>
              ))}

              {/* Typing indicator */}
              {waSending && (
                <div className="self-start">
                  <div className="bg-white rounded-2xl rounded-tl-sm px-4 py-2.5 shadow-sm flex items-center gap-1">
                    <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                    <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                    <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                  </div>
                </div>
              )}
            </div>

            {/* Input bar */}
            <div className="bg-[#F0F0F0] px-3 py-2 flex items-end gap-2 border-t border-gray-200">
              <textarea
                value={waMessage}
                onChange={(e) => { setWaMessage(e.target.value); if (waError) setWaError(""); }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendWhatsAppMessage(); }
                }}
                rows={2}
                placeholder="Type a message…"
                className="flex-1 bg-white rounded-2xl px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#25D366] border border-gray-200"
              />
              <button
                type="button"
                onClick={sendWhatsAppMessage}
                disabled={waSending}
                className="flex-shrink-0 w-10 h-10 bg-[#25D366] hover:bg-[#20ba58] disabled:opacity-50 text-white rounded-full flex items-center justify-center transition-all shadow-sm"
                title="Send"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
                </svg>
              </button>
            </div>
          </div>

          {/* Error */}
          {waError && (
            <p className="text-rose-500 text-xs flex items-center gap-1">
              <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              {waError}
            </p>
          )}

          {/* Language / ward selectors still apply */}
          <CommonSelectors register={register} />

          <p className="text-[11px] text-gray-400 text-center">
            💡 Demo mode — messages are submitted directly to the backend as WhatsApp channel
          </p>
        </div>
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
