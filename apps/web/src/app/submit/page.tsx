import Navbar from "@/components/Navbar";
import SubmissionForm from "@/components/SubmissionForm";

export default function SubmitPage() {
  return (
    <>
      <Navbar active="/submit" />
      <main className="min-h-[calc(100vh-56px)] bg-gray-50 py-12 px-4">
        <div className="max-w-xl mx-auto">
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-gray-900 mb-1">Submit a Development Request</h1>
            <p className="text-gray-500 text-sm">
              Tell us what your community needs. You can write, speak, or attach a photo.
              We accept submissions in any language.
            </p>
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
            <SubmissionForm />
          </div>

          <div className="mt-6 bg-blue-50 border border-blue-100 rounded-xl p-4 text-xs text-blue-700 space-y-1">
            <p className="font-semibold">How your submission is processed:</p>
            <ol className="list-decimal list-inside space-y-1 text-blue-600">
              <li>Language detected automatically — translated to English for analysis</li>
              <li>AI extracts the theme and scores urgency</li>
              <li>Clustered with similar requests to measure demand</li>
              <li>Cross-referenced with census and infrastructure data</li>
              <li>Ranked on your MP&apos;s priority dashboard</li>
            </ol>
          </div>
        </div>
      </main>
    </>
  );
}
