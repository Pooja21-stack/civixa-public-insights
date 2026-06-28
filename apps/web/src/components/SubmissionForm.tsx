"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { createSubmission } from "@/lib/api-mock";
import { WARD_OPTIONS, THEME_LABELS, SUPPORTED_LANGUAGES } from "@/lib/constants";
import { ThemeKey } from "@/types";
import { Spinner } from "@/components/ui";
import { clsx } from "clsx";

interface FormValues {
  text_raw: string;
  ward_id: string;
  theme: ThemeKey;
  lang: string;
  lat?: number;
  lng?: number;
}

type Step = "form" | "submitting" | "success" | "error";

export default function SubmissionForm() {
  const [step, setStep] = useState<Step>("form");
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [recording, setRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormValues>({
    defaultValues: { lang: "en", theme: "other" },
  });

  // ── Voice recording ─────────────────────────────────────────────────────────
  async function startRecording() {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mr = new MediaRecorder(stream);
    const chunks: Blob[] = [];
    mr.ondataavailable = (e) => chunks.push(e.data);
    mr.onstop = () => setAudioBlob(new Blob(chunks, { type: "audio/webm" }));
    mr.start();
    setMediaRecorder(mr);
    setRecording(true);
  }

  function stopRecording() {
    mediaRecorder?.stop();
    setRecording(false);
  }

  // ── Submit ──────────────────────────────────────────────────────────────────
  async function onSubmit(values: FormValues) {
    setStep("submitting");
    try {
      const fd = new FormData();
      fd.append("text_raw", values.text_raw);
      fd.append("channel", "web");
      fd.append("ward_id", values.ward_id || "");
      fd.append("lang", values.lang);
      if (audioBlob) fd.append("media", audioBlob, "voice.webm");

      await createSubmission(fd);
      setStep("success");
      reset();
      setAudioBlob(null);
    } catch (e: any) {
      setErrorMsg(e?.message ?? "Something went wrong. Please try again.");
      setStep("error");
    }
  }

  // ── Success ─────────────────────────────────────────────────────────────────
  if (step === "success") {
    return (
      <div className="text-center py-12 space-y-4">
        <div className="text-5xl">✅</div>
        <h2 className="text-xl font-bold text-gray-900">Thank you!</h2>
        <p className="text-gray-500 text-sm">
          Your request has been received. Our AI will analyse it and surface it to your MP.
        </p>
        <button
          onClick={() => setStep("form")}
          className="mt-4 px-5 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 transition"
        >
          Submit another
        </button>
      </div>
    );
  }

  // ── Error ───────────────────────────────────────────────────────────────────
  if (step === "error") {
    return (
      <div className="text-center py-12 space-y-4">
        <div className="text-5xl">❌</div>
        <p className="text-gray-700 text-sm">{errorMsg}</p>
        <button
          onClick={() => setStep("form")}
          className="mt-2 px-5 py-2 bg-gray-200 text-gray-800 rounded-lg text-sm font-semibold hover:bg-gray-300 transition"
        >
          Try again
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">

      {/* Language selector */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Language</label>
        <select
          {...register("lang")}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {SUPPORTED_LANGUAGES.map((l) => (
            <option key={l.code} value={l.code}>{l.label}</option>
          ))}
        </select>
      </div>

      {/* Description */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Describe your request <span className="text-red-500">*</span>
        </label>
        <textarea
          {...register("text_raw", { required: "Please describe your request", minLength: { value: 10, message: "At least 10 characters" } })}
          rows={5}
          placeholder="E.g. Our village road is broken and children can't reach school safely…"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
        />
        {errors.text_raw && (
          <p className="text-red-500 text-xs mt-1">{errors.text_raw.message}</p>
        )}
      </div>

      {/* Category */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
        <select
          {...register("theme")}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {(Object.keys(THEME_LABELS) as ThemeKey[]).map((k) => (
            <option key={k} value={k}>{THEME_LABELS[k]}</option>
          ))}
        </select>
      </div>

      {/* Ward */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Your Ward / Area</label>
        <select
          {...register("ward_id")}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">— Select ward (optional) —</option>
          {WARD_OPTIONS.map((w) => (
            <option key={w.value} value={w.value}>{w.label}</option>
          ))}
        </select>
      </div>

      {/* Voice note */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Voice Note (optional)</label>
        <div className="flex items-center gap-3">
          {!recording ? (
            <button
              type="button"
              onClick={startRecording}
              className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 transition"
            >
              🎙️ Record
            </button>
          ) : (
            <button
              type="button"
              onClick={stopRecording}
              className="flex items-center gap-2 px-4 py-2 bg-red-100 border border-red-300 rounded-lg text-sm text-red-700 animate-pulse"
            >
              ⏹ Stop recording
            </button>
          )}
          {audioBlob && (
            <span className="text-xs text-green-600 font-medium">✓ Voice note ready</span>
          )}
        </div>
        {audioBlob && (
          <audio controls src={URL.createObjectURL(audioBlob)} className="mt-2 w-full h-8" />
        )}
      </div>

      {/* Submit */}
      <button
        type="submit"
        disabled={step === "submitting"}
        className={clsx(
          "w-full py-3 rounded-lg font-semibold text-sm transition flex items-center justify-center gap-2",
          step === "submitting"
            ? "bg-gray-300 text-gray-500 cursor-not-allowed"
            : "bg-blue-600 text-white hover:bg-blue-700"
        )}
      >
        {step === "submitting" ? <><Spinner size="sm" /> Submitting…</> : "Submit Request"}
      </button>
    </form>
  );
}
