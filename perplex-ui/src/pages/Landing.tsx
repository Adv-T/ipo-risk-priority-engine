import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'

export default function Landing() {
  return (
    <div className="min-h-screen bg-black text-white px-4 sm:px-6 py-12 md:py-16 flex items-center justify-center">
      <div className="max-w-6xl w-full space-y-16 md:space-y-24">

        {/* Hero */}
        <header className="text-center space-y-5 md:space-y-6">
          <h1 className="text-3xl sm:text-4xl md:text-7xl font-extrabold tracking-tight leading-tight md:leading-[1.1]">
            IPO Risk & Sector Analysis
            <span className="text-white/40 font-light"> (beta)</span>
          </h1>

          <p className="max-w-xl md:max-w-2xl mx-auto text-base sm:text-lg md:text-xl text-white/60 leading-relaxed">
            An ML-driven cross-sectional analysis of success and 
            risk profiling of IPOs in emerging markets.
          </p>
        </header>

        {/* Sections */}
        <div className="grid gap-6 md:gap-10 md:grid-cols-2">

          {/* Investors */}
          <Link
            to="/investors"
            className="group rounded-2xl bg-neutral-900 p-6 sm:p-8 border border-white/5 hover:border-white/15 transition-all duration-300"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-2 sm:space-y-3">
                <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight">
                  Investors
                </h2>
                <p className="text-white/60 text-sm sm:text-sm leading-relaxed max-w-sm">
                  Gain sector insights, assess risk profiles, and access 
                  data-driven investment briefs.
                </p>
              </div>
              <ArrowRight className="mt-1 shrink-0 opacity-50 group-hover:translate-x-1 group-hover:opacity-100 transition duration-300" />
            </div>
          </Link>

          {/* Regulators */}
          <Link
            to="/regulators"
            className="group rounded-2xl bg-neutral-900 p-6 sm:p-8 border border-white/5 hover:border-white/15 transition-all duration-300"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-2 sm:space-y-3">
                <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight">
                  Regulators
                </h2>
                <p className="text-white/60 text-sm sm:text-sm leading-relaxed max-w-sm">
                  Review data-backed compliance insights and 
                  download the latest regulatory report.
                </p>
              </div>
              <ArrowRight className="mt-1 shrink-0 opacity-50 group-hover:translate-x-1 group-hover:opacity-100 transition duration-300" />
            </div>
          </Link>
        </div>

        {/* Footer */}
        <footer className="text-center text-xs sm:text-sm md:text-xs text-white/40 leading-relaxed max-w-2xl md:max-w-3xl mx-auto px-2">
          This beta release currently evaluates IPO risk and priority scoring
  across three sectors — Manufacturing, Technology, and Financial Services.
  Please note that backend services are hosted on a free-tier infrastructure
  and may experience a brief cold-start delay after periods of inactivity.
  Additional sector coverage and performance optimizations are planned in
  future iterations.
        </footer>

      </div>
    </div>
  )
}
