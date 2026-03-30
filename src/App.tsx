import Header from "./components/Header";
import Hero from "./components/Hero";
import RainGrid from "./components/RainGrid";
import { AuthProvider } from "./state/auth";

export default function App() {
  return (
    <AuthProvider>
      <main className="min-h-screen selection:bg-emerald-100 selection:text-emerald-900">
        {/* Background subtle texture/gradient */}
        <div className="fixed inset-0 -z-10 bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:32px_32px] opacity-[0.15]" />
        <div className="fixed inset-0 -z-10 bg-gradient-to-b from-transparent via-emerald-50/5 to-transparent" />

        <Header />

        <div className="max-w-screen-sm mx-auto">
          <Hero />
          <RainGrid />
        </div>

        {/* Footer hint */}
        <footer className="fixed bottom-8 left-0 right-0 flex justify-center pointer-events-none">
          <p className="text-[10px] tracking-[0.3em] text-stone-400 uppercase font-light">
            Changsha • Spring Rain
          </p>
        </footer>
      </main>
    </AuthProvider>
  );
}
