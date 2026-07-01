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
      <div className="text-center py-16 space-y-6 animate-scale-in">
        <div className="relative inline-block">
          <div className="absolute inset-0 bg-mint-200 rounded-full blur-2xl opacity-50 animate-pulse-soft"></div>
          <div className="relative text-7xl">✅</div>
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-bold text-gray-900">Thank you!</h2>
          <p className="text-gray-600 text-base max-w-md mx-auto leading-relaxed">
            Your request has been received. Our AI will analyze it and surface it to your MP with priority ranking.
          </p>
        </div>
        <div className="bg-gradient-to-br from-mint-50 to-primary-50 border-2 border-mint-200 rounded-xl p-4 max-w-sm mx-auto">
          <p className="text-xs text-mint-800 font-medium">
            🤖 AI is processing your submission in the background
          </p>
        </div>
        <button
          onClick={() => setStep("form")}
          className="mt-6 px-8 py-3 bg-gradient-to-r from-primary-600 to-primary-700 text-white rounded-xl text-base font-semibold hover:from-primary-700 hover:to-primary-800 transition-all shadow-soft hover:shadow-glow-blue transform hover:scale-105"
        >
          Submit Another Request
        </button>
      </div>
    );
  }

  // ── Error ───────────────────────────────────────────────────────────────────
  if (step === "error") {
    return (
      <div className="text-center py-16 space-y-6 animate-scale-in">
        <div className="relative inline-block">
          <div className="absolute inset-0 bg-rose-200 rounded-full blur-2xl opacity-50 animate-pulse-soft"></div>
          <div className="relative text-7xl">❌</div>
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-bold text-gray-900">Oops! Something went wrong</h2>
          <p className="text-gray-600 text-base max-w-md mx-auto leading-relaxed">
            {errorMsg}
          </p>
        </div>
        <button
          onClick={() => setStep("form")}
          className="mt-6 px-8 py-3 bg-gradient-to-r from-gray-600 to-gray-700 text-white rounded-xl text-base font-semibold hover:from-gray-700 hover:to-gray-800 transition-all shadow-soft transform hover:scale-105"
        >
          Try Again
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">

      {/* Language selector */}
      <div className="space-y-2">
        <label className="flex items-center gap-2 text-sm font-semibold text-gray-700">
          <span className="text-lg">🌐</span>
          Language
        </label>
        <select
          {...register("lang")}
          className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all bg-white hover:border-gray-300"
        >
          {SUPPORTED_LANGUAGES.map((l) => (
            <option key={l.code} value={l.code}>{l.label}</option>
          ))}
        </select>
      </div>

      {/* Description */}
      <div className="space-y-2">
        <label className="flex items-center gap-2 text-sm font-semibold text-gray-700">
          <span className="text-lg">✍️</span>
          Describe your request <span className="text-rose-500">*</span>
        </label>
        <textarea
          {...register("text_raw", { required: "Please describe your request", minLength: { value: 10, message: "At least 10 characters" } })}
          rows={6}
          placeholder="E.g. Our village road is broken and children can't reach school safely. We need urgent repairs before the monsoon season..."
          className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 resize-none transition-all bg-white hover:border-gray-300"
        />
        {errors.text_raw && (
          <p className="text-rose-500 text-xs mt-1 flex items-center gap-1">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            {errors.text_raw.message}
          </p>
        )}
      </div>

      {/* Category */}
      <div className="space-y-2">
        <label className="flex items-center gap-2 text-sm font-semibold text-gray-700">
          <span className="text-lg">🏷️</span>
          Category
        </label>
        <select
          {...register("theme")}
          className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all bg-white hover:border-gray-300"
        >
          {(Object.keys(THEME_LABELS) as ThemeKey[]).map((k) => (
            <option key={k} value={k}>{THEME_LABELS[k]}</option>
          ))}
        </select>
      </div>

      {/* Ward */}
      <div className="space-y-2">
        <label className="flex items-center gap-2 text-sm font-semibold text-gray-700">
          <span className="text-lg">📍</span>
          Your Ward / Area
        </label>
        <select
          {...register("ward_id")}
          className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all bg-white hover:border-gray-300"
        >
          <option value="">— Select ward (optional) —</option>
          {WARD_OPTIONS.map((w) => (
            <option key={w.value} value={w.value}>{w.label}</option>
          ))}
        </select>
      </div>

      {/* Voice note */}
      <div className="space-y-3">
        <label className="flex items-center gap-2 text-sm font-semibold text-gray-700">
          <span className="text-lg">🎙️</span>
          Voice Note <span className="text-xs font-normal text-gray-500">(optional)</span>
        </label>
        <div className="bg-gradient-to-br from-purple-50 to-primary-50 border-2 border-purple-200 rounded-xl p-4">
          <div className="flex items-center gap-3">
            {!recording ? (
              <button
                type="button"
                onClick={startRecording}
                className="flex items-center gap-2 px-5 py-2.5 bg-white border-2 border-purple-300 rounded-xl text-sm font-semibold text-purple-700 hover:bg-purple-50 hover:border-purple-400 transition-all shadow-sm"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" clipRule="evenodd" />
                </svg>
                Start Recording
              </button>
            ) : (
              <button
                type="button"
                onClick={stopRecording}
                className="flex items-center gap-2 px-5 py-2.5 bg-rose-500 border-2 border-rose-600 rounded-xl text-sm font-semibold text-white hover:bg-rose-600 transition-all shadow-soft animate-pulse"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8 7a1 1 0 00-1 1v4a1 1 0 001 1h4a1 1 0 001-1V8a1 1 0 00-1-1H8z" clipRule="evenodd" />
                </svg>
                Stop Recording
              </button>
            )}
            {audioBlob && (
              <span className="text-xs text-mint-700 font-semibold flex items-center gap-1 bg-mint-100 px-3 py-1.5 rounded-full">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                Voice note ready
              </span>
            )}
          </div>
          {audioBlob && (
            <audio controls src={URL.createObjectURL(audioBlob)} className="mt-3 w-full h-10 rounded-lg" />
          )}
        </div>
      </div>

      {/* Submit */}
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
            <span>Submitting your request...</span>
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
    </form>
  );
}
