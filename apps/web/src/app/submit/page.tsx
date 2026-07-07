import Navbar from "@/components/Navbar";
import SubmissionForm from "@/components/SubmissionForm";

export default function SubmitPage() {
  return (
    <>
      <Navbar active="/submit" />
      <main className="min-h-[calc(100vh-64px)] bg-gradient-to-br from-primary-50/30 via-white to-mint-50/30 py-12 px-4">
        <div className="max-w-2xl mx-auto">
          {/* Header */}
          <div className="mb-8 text-center animate-slide-down">
            <div className="inline-flex items-center gap-2 bg-white/80 backdrop-blur-sm border border-primary-200 text-primary-700 text-xs font-semibold px-4 py-2 rounded-full shadow-soft mb-4">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-primary-500"></span>
              </span>
              Your Voice Matters
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-3">
              Submit a Development Request
            </h1>
            <p className="text-gray-600 text-base max-w-xl mx-auto leading-relaxed">
              Tell us what your community needs. You can write, speak, or attach a photo.
              We accept submissions in <span className="font-semibold text-primary-600">any language</span>.
            </p>
          </div>

          {/* Form Card */}
          <div className="bg-white/80 backdrop-blur-sm rounded-3xl border-2 border-gray-200 p-8 shadow-soft-lg animate-slide-up">
            <SubmissionForm />
          </div>

          {/* Info Card */}
          <div className="mt-8 bg-gradient-to-br from-primary-50 to-purple-50 border-2 border-primary-200 rounded-2xl p-6 shadow-soft animate-slide-up" style={{ animationDelay: '0.1s' }}>
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-10 h-10 bg-primary-600 rounded-xl flex items-center justify-center text-white text-lg shadow-soft">
                🤖
              </div>
              <div className="flex-1">
                <p className="font-semibold text-gray-900 mb-3 text-sm">How your submission is processed:</p>
                <ol className="space-y-2 text-sm text-gray-700">
                  {[
                    "Language detected automatically — translated to English for analysis",
                    "AI extracts the theme and scores urgency",
                    "Clustered with similar requests to measure demand",
                    "Cross-referenced with census and infrastructure data",
                    "Ranked on your MP's priority dashboard"
                  ].map((step, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="flex-shrink-0 w-5 h-5 bg-primary-100 text-primary-700 rounded-full flex items-center justify-center text-xs font-bold mt-0.5">
                        {idx + 1}
                      </span>
                      <span className="flex-1">{step}</span>
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          </div>

          {/* Multiple Submission Channels Info */}
          <div className="mt-8 bg-gradient-to-br from-purple-50 to-primary-50 border-2 border-purple-200 rounded-2xl p-6 shadow-soft animate-slide-up" style={{ animationDelay: '0.2s' }}>
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 bg-purple-600 rounded-xl flex items-center justify-center text-white text-lg shadow-soft">
                📱
              </div>
              <div>
                <h3 className="font-bold text-gray-900 mb-1">Multiple Ways to Submit</h3>
                <p className="text-sm text-gray-600">Choose the most convenient method for you</p>
              </div>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Web Submission */}
              <div className="bg-white/80 backdrop-blur-sm border-2 border-primary-200 rounded-xl p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">🌐</span>
                  <span className="font-bold text-primary-700">Web Form</span>
                </div>
                <p className="text-xs text-gray-600 leading-relaxed">
                  Submit directly through this website form with text, voice recording, or photos.
                </p>
                <div className="pt-2">
                  <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-semibold border-2 bg-primary-100 text-primary-700 border-primary-200">
                    <span className="text-sm">🌐</span>
                    <span>Web</span>
                  </span>
                </div>
              </div>

              {/* WhatsApp Submission */}
              <div className="bg-white/80 backdrop-blur-sm border-2 border-mint-200 rounded-xl p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">💬</span>
                  <span className="font-bold text-mint-700">WhatsApp</span>
                </div>
                <p className="text-xs text-gray-600 leading-relaxed">
                  Send your request via WhatsApp to our official bot number. Text or voice messages accepted.
                </p>
                <div className="pt-2">
                  <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-semibold border-2 bg-mint-100 text-mint-700 border-mint-200">
                    <span className="text-sm">💬</span>
                    <span>WhatsApp</span>
                  </span>
                </div>
                <p className="text-xs text-mint-700 font-semibold mt-2">
                   📞 +91 99999 99999
                </p>
              </div>

              {/* Voice Call Submission */}
              <div className="bg-white/80 backdrop-blur-sm border-2 border-purple-200 rounded-xl p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">🎙️</span>
                  <span className="font-bold text-purple-700">Voice Call</span>
                </div>
                <p className="text-xs text-gray-600 leading-relaxed">
                  Call our helpline and leave a voice message. AI will transcribe and process your request.
                </p>
                <div className="pt-2">
                  <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-semibold border-2 bg-purple-100 text-purple-700 border-purple-200">
                    <span className="text-sm">🎙️</span>
                    <span>Voice</span>
                  </span>
                </div>
                <p className="text-xs text-purple-700 font-semibold mt-2">
                   📞 1800-000-0000
                </p>
              </div>
            </div>

            <div className="mt-4 bg-white/60 backdrop-blur-sm border border-purple-200 rounded-lg p-3 text-xs text-gray-700">
              <p className="font-semibold mb-1">💡 All channels are equal:</p>
              <p>Regardless of how you submit, your request receives the same AI analysis and priority ranking on the MP dashboard.</p>
            </div>
          </div>

          {/* Trust Indicators */}
          <div className="mt-6 flex flex-wrap items-center justify-center gap-4 text-xs text-gray-500 animate-fade-in" style={{ animationDelay: '0.3s' }}>
            <div className="flex items-center gap-1.5">
              <svg className="w-4 h-4 text-mint-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <span className="font-medium">100% Anonymous</span>
            </div>
            <div className="flex items-center gap-1.5">
              <svg className="w-4 h-4 text-primary-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
              </svg>
              <span className="font-medium">Secure & Encrypted</span>
            </div>
            <div className="flex items-center gap-1.5">
              <svg className="w-4 h-4 text-purple-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <span className="font-medium">AI-Verified</span>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
