"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import Navbar from "@/components/Navbar";

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem("token") || localStorage.getItem("token");
}

export default function Home() {
  const [loggedIn, setLoggedIn] = useState(false);

  useEffect(() => {
    setLoggedIn(!!getToken());
  }, []);

  return (
    <>
      <Navbar active="/" />
      <main className="min-h-[calc(100vh-56px)] bg-gradient-hero relative overflow-hidden">
        {/* Decorative background elements */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-20 left-10 w-72 h-72 bg-primary-200/30 rounded-full blur-3xl animate-pulse-soft"></div>
          <div className="absolute bottom-20 right-10 w-96 h-96 bg-mint-200/30 rounded-full blur-3xl animate-pulse-soft" style={{ animationDelay: '1s' }}></div>
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-rose-100/20 rounded-full blur-3xl"></div>
        </div>

        <div className="relative z-10 flex flex-col items-center justify-center px-4 py-20 min-h-[calc(100vh-56px)]">
          <div className="max-w-4xl w-full text-center space-y-8 animate-fade-in">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 bg-white/80 backdrop-blur-sm border border-primary-200 text-primary-700 text-xs font-semibold px-4 py-2 rounded-full shadow-soft animate-slide-down">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-primary-500"></span>
              </span>
              Live · AI-Powered Civic Engagement
            </div>

            {/* Hero Title */}
            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold text-gray-900 leading-tight animate-slide-up">
              Your voice shapes
              <span className="block mt-2 bg-gradient-to-r from-primary-600 via-purple-600 to-rose-600 bg-clip-text text-transparent">
                your constituency
              </span>
            </h1>

            {/* Subtitle */}
            <p className="text-lg sm:text-xl text-gray-600 max-w-2xl mx-auto leading-relaxed animate-slide-up" style={{ animationDelay: '0.1s' }}>
              Submit development requests in <span className="font-semibold text-primary-600">any language</span> — voice, text, or photo.
              AI surfaces recurring needs and ranks them for your MP to act on.
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4 animate-slide-up" style={{ animationDelay: '0.2s' }}>
              <Link
                href="/submit"
                className="group px-8 py-4 bg-gradient-to-r from-primary-600 to-primary-700 text-white rounded-2xl font-semibold hover:from-primary-700 hover:to-primary-800 transition-all duration-300 text-base shadow-soft hover:shadow-glow-blue transform hover:scale-105"
              >
                <span className="flex items-center justify-center gap-2">
                  Submit a Request
                  <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </span>
              </Link>
              {loggedIn ? (
                <Link
                  href="/dashboard"
                  className="px-8 py-4 bg-white/80 backdrop-blur-sm border-2 border-gray-200 text-gray-800 rounded-2xl font-semibold hover:bg-white hover:border-primary-300 transition-all duration-300 text-base shadow-soft hover:shadow-soft-lg transform hover:scale-105"
                >
                  View MP Dashboard
                </Link>
              ) : (
                <Link
                  href="/login"
                  className="px-8 py-4 bg-white/80 backdrop-blur-sm border-2 border-gray-200 text-gray-800 rounded-2xl font-semibold hover:bg-white hover:border-primary-300 transition-all duration-300 text-base shadow-soft hover:shadow-soft-lg transform hover:scale-105 flex items-center justify-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  MP Login
                </Link>
              )}
            </div>

            {/* Feature Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 pt-12 max-w-3xl mx-auto animate-slide-up" style={{ animationDelay: '0.3s' }}>
              {[
                { icon: "🗣️", label: "Multilingual", color: "from-primary-50 to-primary-100 border-primary-200" },
                { icon: "🎙️", label: "Voice Input", color: "from-purple-50 to-purple-100 border-purple-200" },
                { icon: "💬", label: "WhatsApp", color: "from-mint-50 to-mint-100 border-mint-200" },
                { icon: "🗺️", label: "Heatmap", color: "from-rose-50 to-rose-100 border-rose-200" },
                { icon: "🤖", label: "AI-Ranked", color: "from-amber-50 to-amber-100 border-amber-200" },
                { icon: "📄", label: "PDF Reports", color: "from-primary-50 to-primary-100 border-primary-200" },
              ].map((feature, idx) => (
                <div
                  key={feature.label}
                  className={`bg-gradient-to-br ${feature.color} border backdrop-blur-sm rounded-2xl p-4 text-center hover:scale-105 transition-transform duration-300 card-hover shadow-soft`}
                  style={{ animationDelay: `${0.4 + idx * 0.05}s` }}
                >
                  <div className="text-3xl mb-2">{feature.icon}</div>
                  <div className="text-sm font-semibold text-gray-700">{feature.label}</div>
                </div>
              ))}
            </div>

            {/* Trust Indicators */}
            <div className="flex flex-wrap items-center justify-center gap-6 pt-8 text-sm text-gray-500 animate-fade-in" style={{ animationDelay: '0.5s' }}>
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-mint-600" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <span className="font-medium">Secure & Anonymous</span>
              </div>
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-primary-600" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />
                </svg>
                <span className="font-medium">Community Driven</span>
              </div>
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-purple-600" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd" />
                </svg>
                <span className="font-medium">AI-Powered Insights</span>
              </div>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
