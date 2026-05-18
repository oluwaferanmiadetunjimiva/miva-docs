import ContinueWithSSOButton from "./_components/continue-with-sso-button";

export default function Page() {
  return (
    <main className="flex h-screen w-full overflow-hidden bg-gray-50 text-gray-900 selection:bg-indigo-100 selection:text-indigo-900">
      {/* SSO overlay (static mock) */}
      <div
        id="sso-overlay"
        className="fixed inset-0 z-100 flex flex-col items-center justify-center overflow-hidden bg-gray-50 p-4 transition-opacity duration-500 selection:bg-indigo-100 selection:text-indigo-900"
      >
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-size-[24px_24px]" />
        <div className="pointer-events-none absolute top-1/4 right-0 left-0 m-auto h-[300px] w-[300px] rounded-full bg-indigo-500 opacity-20 blur-[100px]" />

        <div className="relative z-10 flex w-full max-w-[400px] flex-col items-center rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-xl">
          <div className="mb-6 flex items-center justify-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-600 text-base font-bold tracking-tighter text-white shadow-sm">
              MD
            </div>
            <span className="text-xl font-semibold tracking-tight text-gray-900">Miva Docs</span>
          </div>

          <div className="mb-5 rounded-full border border-indigo-100 bg-indigo-50 px-2.5 py-1 text-[10px] font-bold tracking-wider text-indigo-600 uppercase shadow-sm">
            Internal Documentation Hub
          </div>

          <h1 className="mb-2 text-2xl font-semibold tracking-tight text-gray-900">Sign in to continue</h1>

          <p className="mb-8 text-sm leading-relaxed text-gray-500">
            Access internal API documentation, request playgrounds, and engineering resources.
          </p>



          <ContinueWithSSOButton />
        </div>

        <div className="absolute bottom-8 text-xs font-medium tracking-wide text-gray-400">For internal use only</div>
      </div>
    </main>
  );
}
