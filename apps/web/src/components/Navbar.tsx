import Link from "next/link";
import { clsx } from "clsx";

interface NavItem {
  href: string;
  label: string;
  icon?: string;
}

const NAV: NavItem[] = [
  { href: "/",          label: "Home",      icon: "🏠" },
  { href: "/submit",    label: "Submit",    icon: "✍️" },
  { href: "/dashboard", label: "Dashboard", icon: "📊" },
];

export default function Navbar({ active }: { active?: string }) {
  return (
    <header className="border-b border-gray-200/50 bg-white/80 backdrop-blur-md sticky top-0 z-50 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-3 group">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-primary-500 to-purple-500 rounded-xl blur opacity-50 group-hover:opacity-75 transition-opacity"></div>
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
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={clsx(
                  "px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 flex items-center gap-2",
                  active === item.href
                    ? "bg-gradient-to-r from-primary-50 to-purple-50 text-primary-700 shadow-sm"
                    : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                )}
              >
                <span className="hidden sm:inline">{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            ))}
            
            {/* MP Login Button */}
            <Link
              href="/login"
              className="ml-2 px-5 py-2 bg-gradient-to-r from-primary-600 to-primary-700 text-white text-sm font-semibold rounded-xl hover:from-primary-700 hover:to-primary-800 transition-all duration-200 shadow-soft hover:shadow-glow-blue transform hover:scale-105 flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              <span className="hidden sm:inline">MP Login</span>
            </Link>
          </nav>
        </div>
      </div>
    </header>
  );
}
