// Investors.tsx — mobile optimized, desktop untouched

import { useEffect, useMemo, useRef, useState } from "react";
import { Download, Send, MessageCircle, X, PieChart as PieIcon } from "lucide-react";
import { motion } from "framer-motion";
import {
  LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip,
  ResponsiveContainer, Pie, Cell, PieChart as RePieChart
} from "recharts";

import ChatMessage from "../components/ChatMessage";
import QuestionChips from "../components/QuestionChips";
import type { ChatMessage as Msg } from "../lib/types";
import { askLLM, downloadReport } from "../lib/chatClient";

function n(x: any, d = 2) {
  const num = typeof x === "number" ? x : parseFloat(x);
  return Number.isFinite(num) ? parseFloat(num.toFixed(d)) : 0;
}

async function loadLocalContext() {
  const apiUrl = import.meta.env.VITE_API_URL as string;
  try {
    const r = await fetch(`${apiUrl}/context`);
    if (r.ok) return await r.json();
  } catch {}

  const ctx: any = {};
  try {
    const a = await fetch(`${apiUrl}/sector-summary`);
    if (a.ok) ctx.sectors = await a.json();
  } catch {}
  try {
    const b = await fetch(`${apiUrl}/scores`);
    if (b.ok) ctx.issuers = await b.json();
  } catch {}

  return ctx;
}

const COLORS = ["#22c55e", "#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6"];
const SUGGESTIONS = [
  "Which sector is safest to invest in 2025?",
  "What are the top 3 performing IPOs in Technology?",
  "Summarize risk trends across sectors.",
  "How does inflation impact IPO performance?",
];

export default function Investors() {
  const [context, setContext] = useState<any>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loadingChat, setLoadingChat] = useState(false);
  const [openChat, setOpenChat] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  function pushMessage(role: "user" | "bot", content: string) {
    setMessages(prev => [...prev, { id: crypto.randomUUID(), role, content }]);
  }

  async function handleSend(e?: any) {
    e?.preventDefault();
    const text = input.trim();
    if (!text) return;
    setInput("");
    pushMessage("user", text);
    setLoadingChat(true);

    try {
      const reply = await askLLM(text);
      pushMessage("bot", reply);
    } catch {
      pushMessage("bot", "⚠️ Unable to reach the model.");
    } finally {
      setLoadingChat(false);
      queueMicrotask(() =>
        listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" })
      );
    }
  }

  useEffect(() => {
    (async () => setContext(await loadLocalContext()))();
  }, []);

  const sectors = context?.sectors || [];
  const issuers = context?.issuers || [];

  const topSectors = useMemo(() => (
    [...sectors]
      .filter((s: any) => Number.isFinite(s.sector_priority))
      .sort((a: any, b: any) => b.sector_priority - a.sector_priority)
      .slice(0, 4)
  ), [sectors]);

  const avgRiskMix = useMemo(() => {
    const total = Math.max(sectors.length, 1);
    return [
      { name: "Low Risk", value: sectors.reduce((s: any, x: any) => s + (x.Low_pct || 0), 0) / total },
      { name: "Moderate Risk", value: sectors.reduce((s: any, x: any) => s + (x.Moderate_pct || 0), 0) / total },
      { name: "High Risk", value: sectors.reduce((s: any, x: any) => s + (x.High_pct || 0), 0) / total },
    ];
  }, [sectors]);

  const sectorReturns = useMemo(() => (
    sectors
      .filter((s: any) => Number.isFinite(s.mean_return))
      .map((s: any) => ({
        name: s.sector,
        priority: n(s.sector_priority),
        return: n(s.mean_return)
      }))
  ), [sectors]);

  const ipoLeaders = useMemo(() => (
    [...issuers]
      .filter((x: any) => Number.isFinite(x.priority_score_0_100))
      .sort((a: any, b: any) => b.priority_score_0_100 - a.priority_score_0_100)
      .slice(0, 6)
  ), [issuers]);

  return (
    <div className="min-h-screen bg-black text-white">

      {/* HEADER */}
      <div className="sticky top-0 bg-black/80 backdrop-blur-xl px-4 sm:px-6 py-4 sm:py-6 border-b border-white/5 z-10">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-4xl font-bold">Investor Dashboard</h1>
            <p className="text-white/60 text-xs sm:text-sm">
              Sector health • Market signals • IPO performance
            </p>
          </div>

          <button
            className="bg-white text-black px-4 py-2 rounded-xl font-semibold flex items-center gap-2 text-sm sm:text-base"
            onClick={() => downloadReport("investor")}
          >
            <Download size={18} />
            Report
          </button>
        </div>
      </div>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-8 sm:space-y-10">

        {/* TOP CARDS */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {topSectors.map((s: any, i: number) => (
            <div key={i} className="bg-neutral-900 p-5 rounded-2xl border border-white/5 space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-sm text-white/60">{s.sector}</h3>
                <PieIcon size={16} className="text-cyan-300" />
              </div>
              <p className="text-3xl font-bold text-cyan-300">{n(s.sector_priority)}</p>
              <p className="text-xs text-white/50">Avg return: {n(s.mean_return)}%</p>
            </div>
          ))}
        </section>

        {/* CHARTS */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-6">

          <div className="bg-neutral-900 p-6 rounded-2xl border border-white/5">
            <h2 className="text-xl font-semibold mb-4">Risk Composition</h2>
            <div className="h-56 sm:h-64">
              <ResponsiveContainer>
                <RePieChart>
                  <Pie data={avgRiskMix} dataKey="value" nameKey="name" innerRadius="50%" outerRadius="80%">
                    {avgRiskMix.map((_, i) => (
                      <Cell key={i} fill={COLORS[i]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ background: "#111", border: "1px solid #333" }} />
                </RePieChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-neutral-900 p-6 rounded-2xl border border-white/5">
            <h2 className="text-xl font-semibold mb-4">Priority vs Returns</h2>
            <div className="h-56 sm:h-64">
              <ResponsiveContainer>
                <LineChart data={sectorReturns}>
                  <CartesianGrid stroke="#1f2937" />
                  <XAxis dataKey="name" tick={{ fill: "#cbd5e1" }} />
                  <YAxis tick={{ fill: "#cbd5e1" }} />
                  <Tooltip contentStyle={{ background: "#111", border: "1px solid #333" }} />
                  <Line type="monotone" dataKey="priority" stroke="#38bdf8" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="return" stroke="#8b5cf6" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

        </section>

        {/* TABLE */}
        <section className="bg-neutral-900 p-6 rounded-2xl border border-white/5">
          <h2 className="text-xl font-semibold mb-4">Top Indian IPOs</h2>

          <div className="overflow-x-auto">
            <table className="min-w-full text-xs sm:text-sm">
              <thead className="text-white/60">
                <tr>
                  <th className="py-2 pr-4 text-left">#</th>
                  <th className="py-2 pr-4 text-left">Issuer</th>
                  <th className="py-2 pr-4 text-left">Sector</th>
                  <th className="py-2 pr-4 text-left">Score</th>
                </tr>
              </thead>
              <tbody>
                {ipoLeaders.map((r: any, i: number) => (
                  <tr key={i} className="border-t border-white/10">
                    <td className="py-2 pr-4 text-white/70">{i + 1}</td>
                    <td className="py-2 pr-4">{r.issuer_name}</td>
                    <td className="py-2 pr-4 text-white/70">{r.sector}</td>
                    <td className="py-2 pr-4 font-semibold text-cyan-300">{n(r.priority_score_0_100)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

      </main>

      {/* FLOATING BUTTON */}
      <button
        onClick={() => setOpenChat(true)}
        className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 bg-white text-black px-3 sm:px-4 py-2 rounded-full shadow-xl flex items-center gap-2 text-sm sm:text-base font-semibold hover:bg-neutral-200 transition z-50"
      >
        <MessageCircle size={18} />
        Insight Advisor
      </button>

      {/* CHAT MODAL */}
      {openChat && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50"
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-neutral-950 w-[95%] sm:w-[700px] max-h-[90vh] sm:max-h-[80vh] rounded-2xl border border-white/10 p-4 sm:p-6 flex flex-col"
          >
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold">AI Insights Assistant</h2>
              <button onClick={() => setOpenChat(false)}>
                <X size={22} className="text-white/60 hover:text-white" />
              </button>
            </div>

            <QuestionChips suggestions={SUGGESTIONS} onPick={(q) => setInput(q)} />

            <div
              ref={listRef}
              className="mt-4 p-4 flex-1 overflow-y-auto bg-neutral-900 rounded-xl border border-white/5 space-y-3"
            >
              {messages.length === 0 ? (
                <p className="text-white/50">Ask anything about sectors, returns, or IPO signals.</p>
              ) : (
                messages.map((m) => <ChatMessage key={m.id} msg={m} />)
              )}
              {loadingChat && <p className="text-white/60">Thinking…</p>}
            </div>

            <form onSubmit={handleSend} className="mt-4 flex items-end gap-2">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                className="w-full resize-none bg-neutral-900 border border-white/10 rounded-xl p-3 text-sm focus:ring-1 focus:ring-white/20 outline-none"
                rows={2}
                placeholder="Ask a question…"
              />

              <button
                type="submit"
                disabled={!input.trim() || loadingChat}
                className="bg-white text-black px-4 py-2 rounded-xl font-semibold flex items-center gap-2 disabled:opacity-40"
              >
                <Send size={18} />
                Send
              </button>
            </form>
          </motion.div>
        </motion.div>
      )}
    </div>
  );
}
