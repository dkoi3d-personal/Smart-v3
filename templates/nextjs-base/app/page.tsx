/**
 * Homepage - Root Route (/)
 *
 * This file handles localhost:3000/
 * Modify this to be your app's main landing page.
 */
export default function HomePage() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="text-center px-4">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 mb-6">
          <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h1 className="text-4xl font-bold text-slate-900 mb-3">
          Ready to Build
        </h1>
        <p className="text-lg text-slate-600 mb-6 max-w-md">
          Your Next.js app is running. Start building your features!
        </p>
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-white rounded-full shadow-sm border border-slate-200">
          <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
          <code className="text-sm text-slate-600">localhost:3000</code>
        </div>
      </div>
    </main>
  );
}
