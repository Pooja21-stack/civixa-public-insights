import Link from "next/link";
import Navbar from "@/components/Navbar";

export default function Home() {
  return (
    <>
      <Navbar active="/" />
      <main className="min-h-[calc(100vh-56px)] bg-gradient-to-b from-gray-50 to-white flex flex-col items-center justify-center px-4 py-20">
        <div className="max-w-2xl w-full text-center space-y-6">
          <div className="inline-block bg-blue-50 text-blue-700 text-xs font-semibold px-3 py-1 rounded-full tracking-wide uppercase mb-2">
            Hackathon Demo Build
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 leading-tight">
            Your voice shapes your constituency
          </h1>
          <p className="text-lg text-gray-500 max-w-lg mx-auto">
            Submit development requests in any language — voice, text, or photo.
            AI surfaces recurring needs and ranks them for your MP to act on.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center pt-2">
            <Link
              href="/submit"
              className="px-7 py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition text-sm shadow-sm"
            >
              Submit a Request →
            </Link>
            <Link
              href="/dashboard"
              className="px-7 py-3 bg-white border border-gray-300 text-gray-800 rounded-xl font-semibold hover:bg-gray-50 transition text-sm"
            >
              View MP Dashboard
            </Link>
          </div>

          {/* Feature pills */}
          <div className="flex flex-wrap justify-center gap-2 pt-6">
            {[
              "🗣️ Multilingual",
              "🎙️ Voice submissions",
              "💬 WhatsApp",
              "🗺️ Demand heatmap",
              "🤖 AI-ranked priorities",
              "📄 PDF report",
            ].map((f) => (
              <span key={f} className="text-xs bg-white border border-gray-200 text-gray-600 px-3 py-1 rounded-full">
                {f}
              </span>
            ))}
          </div>
        </div>
      </main>
    </>
  );
}
