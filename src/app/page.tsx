import ImportSection from "@/components/import/ImportSection";

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6 py-16 bg-[#070714]">
      {/* Subtle radial glow */}
      <div
        className="pointer-events-none fixed inset-0 z-0"
        style={{
          background:
            "radial-gradient(ellipse 60% 40% at 50% 50%, rgba(109,40,217,0.07) 0%, transparent 70%)",
        }}
      />

      <div className="relative z-10 w-full max-w-lg flex flex-col items-center gap-8">
        <div className="text-center space-y-3">
          <div className="text-4xl">🌌</div>
          <h1 className="text-2xl font-semibold tracking-tight text-white/90">
            Book Constellation
          </h1>
          <p className="text-sm text-white/40 max-w-xs mx-auto leading-relaxed">
            Import your library and explore it as an interactive constellation —
            each book a star, each shared theme a thread of light.
          </p>
        </div>

        <div className="w-full rounded-2xl border border-white/8 bg-white/[0.025] p-6 backdrop-blur-sm">
          <ImportSection />
        </div>

        <p className="text-xs text-white/20">
          Your library stays in your browser — nothing is uploaded.
        </p>
      </div>
    </main>
  );
}
