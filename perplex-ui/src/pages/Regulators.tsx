import { useEffect, useMemo, useState } from "react";
import { Download, PieChart as PieIcon, BarChart2 } from "lucide-react";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip as RTooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  LineChart,
  Line,
  Legend
} from "recharts";
import { downloadReport } from "../lib/chatClient";

const ACCENT_COLORS = ["#22c55e", "#f59e0b", "#ef4444"];
const LINE_A = "#38bdf8";
const LINE_B = "#8b5cf6";

const Card = ({ children }: any) => (
  <div className="rounded-2xl bg-neutral-900 border border-white/5 p-4 sm:p-6">
    {children}
  </div>
);

function n(x: any, d = 2) {
  const num = typeof x === "number" ? x : parseFloat(x);
  return Number.isFinite(num) ? parseFloat(num.toFixed(d)) : 0;
}

function safe(x: any, fb = "-") {
  return x === undefined || x === null ? fb : String(x);
}

function normalizeSectors(rows: any[] = []) {
  return rows.map((r) => ({
    sector: safe(r.sector),
    sector_priority: n(r.sector_priority, 1),
    mean_return: n(r.mean_return, 1),
    Low_pct: n(r.Low_pct, 1),
    Moderate_pct: n(r.Moderate_pct, 1),
    High_pct: n(r.High_pct, 1),
  }));
}

function normalizeIssuers(rows: any[] = []) {
  return rows.map((r) => ({
    issuer_name: safe(r.issuer_name),
    sector: safe(r.sector),
    issue_year: n(r.issue_year, 0),
    priority_score_0_100: n(r.priority_score_0_100, 1),
  }));
}

async function loadData() {
  const apiUrl = import.meta.env.VITE_API_URL as string;

  try {
    const r = await fetch(`${apiUrl}/context`);
    if (r.ok) {
      const ctx = await r.json();
      return {
        sectors: normalizeSectors(ctx.sectors),
        issuers: normalizeIssuers(ctx.issuers),
      };
    }
  } catch {}

  const [sec, iss] = await Promise.allSettled([
    fetch(`${apiUrl}/sector-summary`),
    fetch(`${apiUrl}/scores`)
  ]);

  let sectors: any[] = [];
  let issuers: any[] = [];

  if (sec.status === "fulfilled" && sec.value.ok)
    sectors = normalizeSectors(await sec.value.json());

  if (iss.status === "fulfilled" && iss.value.ok)
    issuers = normalizeIssuers(await iss.value.json());

  return { sectors, issuers };
}

export default function Regulators() {
  const [loading, setLoading] = useState(true);
  const [sectors, setSectors] = useState<any[]>([]);
  const [issuers, setIssuers] = useState<any[]>([]);
  const [selectedSector, setSelectedSector] = useState("All");

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const { sectors, issuers } = await loadData();
        setSectors(sectors);
        setIssuers(issuers);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const riskMix = useMemo(() => {
    const count = Math.max(sectors.length, 1);
    return [
      { risk: "Low", value: n(sectors.reduce((s, x) => s + (x.Low_pct ?? 0), 0) / count) },
      { risk: "Moderate", value: n(sectors.reduce((s, x) => s + (x.Moderate_pct ?? 0), 0) / count) },
      { risk: "High", value: n(sectors.reduce((s, x) => s + (x.High_pct ?? 0), 0) / count) },
    ];
  }, [sectors]);

  const pvr = useMemo(
    () =>
      sectors.map((s) => ({
        name: s.sector,
        priority: s.sector_priority,
        returnPct: s.mean_return,
      })),
    [sectors]
  );

  const ipo = useMemo(() => {
    const list =
      selectedSector === "All"
        ? issuers
        : issuers.filter((x) => x.sector === selectedSector);

    return [...list]
      .sort((a, b) => b.priority_score_0_100 - a.priority_score_0_100)
      .slice(0, 10);
  }, [issuers, selectedSector]);

  return (
    <div className="min-h-screen bg-black text-white">

      {/* HEADER */}
      <div className="sticky top-0 z-20 bg-black/80 backdrop-blur-xl px-4 sm:px-6 py-4 sm:py-6 border-b border-white/5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-4xl font-bold tracking-tight">
              Regulatory Dashboard
            </h1>
            <p className="mt-1 text-white/60 text-xs sm:text-sm">
              Sector stability • Risk signals • Oversight metrics
            </p>
          </div>

          <button
            onClick={async () => {
              try { await downloadReport("regulator"); } catch {}
            }}
            className="bg-white text-black px-4 py-2 rounded-xl font-semibold flex items-center gap-2 text-sm sm:text-base"
          >
            <Download size={18} />
            Report
          </button>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-8 sm:space-y-12">

        <section className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8">

          {/* RISK PIE */}
          <Card>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg sm:text-xl font-semibold">Risk Composition</h2>
              <PieIcon size={18} className="text-sky-300" />
            </div>

            <div className="h-56 sm:h-72">
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={riskMix} dataKey="value" nameKey="risk" innerRadius="55%" outerRadius="80%">
                    {riskMix.map((_, i) => (
                      <Cell key={i} fill={ACCENT_COLORS[i]} />
                    ))}
                  </Pie>
                  <RTooltip contentStyle={{ background: "#111", border: "1px solid #333" }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </Card>

          {/* VOLATILITY */}
          <Card>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg sm:text-xl font-semibold">Sector Volatility</h2>
              <BarChart2 size={18} className="text-indigo-300" />
            </div>

            <div className="h-56 sm:h-72">
              <ResponsiveContainer>
                <BarChart
                  data={sectors.map((s) => ({
                    name: s.sector,
                    volatility: n(s.mean_return ?? 0),
                  }))}
                  layout="vertical"
                >
                  <CartesianGrid stroke="#1f2937" />
                  <XAxis type="number" tick={{ fill: "#cbd5e1" }} />
                  <YAxis type="category" dataKey="name" tick={{ fill: "#cbd5e1" }} width={100} />
                  <RTooltip contentStyle={{ background: "#111", border: "1px solid #333" }} />
                  <Bar dataKey="volatility" fill="#38bdf8" radius={[4, 4, 4, 4]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </section>

        {/* Priority vs Return */}
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg sm:text-xl font-semibold">Priority vs Return</h2>
          </div>

          <div className="h-64 sm:h-80">
            <ResponsiveContainer>
              <LineChart data={pvr}>
                <CartesianGrid stroke="#1f2937" />
                <XAxis dataKey="name" tick={{ fill: "#cbd5e1" }} />
                <YAxis tick={{ fill: "#cbd5e1" }} />
                <RTooltip contentStyle={{ background: "#111", border: "1px solid #333" }} />
                <Line type="monotone" dataKey="priority" stroke={LINE_A} strokeWidth={3} dot={false} />
                <Line type="monotone" dataKey="returnPct" stroke={LINE_B} strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* IPO TABLE */}
        <Card>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
            <h2 className="text-lg sm:text-xl font-semibold">IPO Rankings</h2>

            <select
              value={selectedSector}
              onChange={(e) => setSelectedSector(e.target.value)}
              className="px-3 py-2 bg-neutral-950 border border-white/10 rounded-xl text-xs sm:text-sm"
            >
              <option value="All">All sectors</option>
              {Array.from(new Set(sectors.map((s) => s.sector))).map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-xs sm:text-sm">
              <thead className="text-white/60">
                <tr className="text-left">
                  <th className="py-2 pr-4">#</th>
                  <th className="py-2 pr-4">Issuer</th>
                  <th className="py-2 pr-4">Sector</th>
                  <th className="py-2 pr-4">Year</th>
                  <th className="py-2 pr-4">Score</th>
                </tr>
              </thead>

              <tbody>
                {ipo.map((r, i) => (
                  <tr key={i} className="border-t border-white/10">
                    <td className="py-2 pr-4 text-white/70">{i + 1}</td>
                    <td className="py-2 pr-4">{r.issuer_name}</td>
                    <td className="py-2 pr-4 text-white/70">{r.sector}</td>
                    <td className="py-2 pr-4 text-white/70">{r.issue_year || "-"}</td>
                    <td className="py-2 pr-4 font-semibold text-cyan-300">
                      {r.priority_score_0_100.toFixed(1)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

      </main>
    </div>
  );
}
