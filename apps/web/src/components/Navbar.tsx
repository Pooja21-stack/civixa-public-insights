import Link from "next/link";
import { clsx } from "clsx";

interface NavItem {
  href: string;
  label: string;
}

const NAV: NavItem[] = [
  { href: "/",          label: "Home"       },
  { href: "/submit",    label: "Submit"     },
  { href: "/dashboard", label: "Dashboard"  },
];

export default function Navbar({ active }: { active?: string }) {
  return (
    <header className="border-b border-gray-200 bg-white sticky top-0 z-30">
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <span className="text-lg font-bold text-blue-600">CivIxa</span>
          <span className="text-sm text-gray-400 hidden sm:inline">Public Insights</span>
        </Link>
        <nav className="flex items-center gap-1">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={clsx(
                "px-3 py-1.5 rounded-md text-sm font-medium transition",
                active === item.href
                  ? "bg-blue-50 text-blue-700"
                  : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
              )}
            >
              {item.label}
            </Link>
          ))}
          <Link
            href="/dashboard"
            className="ml-2 px-3 py-1.5 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition"
          >
            MP Login
          </Link>
        </nav>
      </div>
    </header>
  );
}
