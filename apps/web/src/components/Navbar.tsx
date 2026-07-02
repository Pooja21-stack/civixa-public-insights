"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { clsx } from "clsx";

// Public nav — citizens only
const PUBLIC_NAV = [
  { href: "/",       label: "Home",   icon: "🏠" },
  { href: "/submit", label: "Submit", icon: "✍️" },
];

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem("token") || localStorage.getItem("token");
}

export default function Navbar({ active }: { active?: string }) {
  const pathname      = usePathname();
  const router        = useRouter();
  const currentActive = active ?? pathname;
  const isDashboard   = currentActive.startsWith("/dashboard");

  // Auth state — false on first render (SSR), updated after mount
  const [loggedIn, setLoggedIn] = useState(false);

  useEffect(() => {
    // Run on mount and whenever the route changes
    setLoggedIn(!!getToken());
  }, [pathname]);

  function handleLogout() {
    localStorage.removeItem("token");
    sessionStorage.removeItem("token");
    setLoggedIn(false);
    router.push("/");
  }

  return (
    <header className="border-b border-gray-200/50 bg-white/80 backdrop-blur-md sticky top-0 z-50 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">

          {/* Logo */}
          <Link href="/" className="flex items-center gap-3 group">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-primary-500 to-purple-500 rounded-xl blur opacity-50 group-hover:opacity-75 transition-opacity" />
              <div className="relative bg-gradient-to-r from-primary-600 to-purple-600 text-white w-10 h-10 rounded-xl flex items-center justify-center font-bold text-lg shadow-soft">
                C
              </div>
            </div>
            <div className="flex flex-col">
              <span className="text-xl font-bold bg-gradient-to-r from-primary-600 to-purple-600 bg-clip-text text-transparent">
                CivIxa
              </span>
              <span className="text-xs text-gray-500 hidden sm:block -mt-1">Public Insights</span>
            </div>
          </Link>

          {/* Navigation */}
          <nav className="flex items-center gap-2">

            {/* Public links — always visible */}
            {PUBLIC_NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={clsx(
                  "px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 flex items-center gap-2",
                  currentActive === item.href
                    ? "bg-gradient-to-r from-primary-50 to-purple-50 text-primary-700 shadow-sm"
                    : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                )}
              >
                <span className="hidden sm:inline">{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            ))}

            {/* Dashboard — only when logged in */}
            {loggedIn && (
              <Link
                href="/dashboard"
                className={clsx(
                  "px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 flex items-center gap-2",
                  currentActive.startsWith("/dashboard")
                    ? "bg-gradient-to-r from-primary-50 to-purple-50 text-primary-700 shadow-sm"
                    : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                )}
              >
                <span className="hidden sm:inline">📊</span>
                <span>Dashboard</span>
              </Link>
            )}

            {/* Auth area */}
            {loggedIn ? (
              /* Logout button — replaces MP Login */
              <button
                onClick={handleLogout}
                className="ml-2 px-4 py-2 text-sm font-semibold rounded-xl transition-all duration-200 flex items-center gap-2 bg-gray-100 text-gray-700 hover:bg-gray-200 shadow-soft"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                <span className="hidden sm:inline">Logout</span>
              </button>
            ) : (
              /* MP Login button — only when logged out */
              <Link
                href="/login"
                className={clsx(
                  "ml-2 px-5 py-2 text-sm font-semibold rounded-xl transition-all duration-200 flex items-center gap-2 shadow-soft hover:scale-105 transform",
                  currentActive === "/login"
                    ? "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    : "bg-gradient-to-r from-primary-600 to-primary-700 text-white hover:from-primary-700 hover:to-primary-800 hover:shadow-glow-blue"
                )}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                <span className="hidden sm:inline">MP Login</span>
              </Link>
            )}

          </nav>
        </div>
      </div>
    </header>
  );
}
