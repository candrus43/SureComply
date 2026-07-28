import { Shield } from "lucide-react";

export function LandingNav() {
  return (
    <nav className="border-b border-zinc-800">
      <div className="max-w-7xl mx-auto px-6 flex items-center justify-between h-16">
        <div className="flex items-center gap-2">
          <Shield className="w-5 h-5 text-emerald-400" />
          <span className="font-semibold text-lg text-white">SureComply</span>
        </div>
        <div className="flex items-center gap-4">
          <a
            href="/login"
            className="text-sm text-zinc-400 hover:text-white transition-colors"
          >
            Sign in
          </a>
          <a
            href="/signup"
            className="text-sm px-4 py-2 rounded-lg bg-emerald-500 text-black font-medium hover:bg-emerald-400 transition-colors"
          >
            Get Started
          </a>
        </div>
      </div>
    </nav>
  );
}
