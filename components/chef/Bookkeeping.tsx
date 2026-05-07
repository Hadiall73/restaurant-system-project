"use client";
import { useEffect, useState } from "react";
import { useStore } from "@/lib/store";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { TrendingUp, TrendingDown, FileText, RefreshCw, AlertCircle } from "lucide-react";

const FARBEN = ["#f97316", "#3b82f6", "#8b5cf6", "#10b981", "#f59e0b", "#ef4444"];

/** Aktuellen Monat als YYYY-MM ohne UTC-Bug */
function currentMonth() {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}`;
}

function fmt(n: number | undefined | null): string {
  if (n == null || isNaN(n)) return "0,00 €";
  return n.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
}

function fmtPct(n: number | undefined | null): string {
  if (n == null || isNaN(n)) return "0,00 %";
  return n.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " %";
}

function changeMonth(base: string, dir: 1 | -1): string {
  const [y, m] = base.split("-").map(Number);
  let ny = y, nm = m + dir;
  if (nm > 12) { nm = 1; ny++; }
  if (nm < 1)  { nm = 12; ny--; }
  return `${ny}-${String(nm).padStart(2, "0")}`;
}

export default function Bookkeeping() {
  const { restaurant } = useStore();
  const [data, setData]       = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);
  const [month, setMonth]     = useState(currentMonth);

  async function load() {
    if (!restaurant) return;
    setLoading(true);
    setError(null);
    try {
      const res  = await fetch(`/api/bookkeeping?restaurant_id=${restaurant.id}&month=${month}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Unbekannter Fehler");
      setData(json);
    } catch (e: any) {
      setError(e.message || "Laden fehlgeschlagen");
      setData(null);
    }
    setLoading(false);
  }

  useEffect(() => { load(); }, [restaurant?.id, month]);

  const isCurrentMonth = month >= currentMonth();

  // ── Ladezustand ───────────────────────────────────────────────────────────
  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <RefreshCw size={24} className="text-orange-400 animate-spin" />
    </div>
  );

  // ── Fehlerzustand ─────────────────────────────────────────────────────────
  if (error) return (
    <div className="flex flex-col items-center justify-center h-64 gap-3">
      <AlertCircle size={32} className="text-red-400" />
      <p className="text-red-400 font-medium">{error}</p>
      <button onClick={load} className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-sm transition-colors">
        Erneut versuchen
      </button>
    </div>
  );

  if (!data) return null;

  // ── Daten sicher auslesen ─────────────────────────────────────────────────
  const s                = data.summary          || {};
  const entries          = data.entries           || [];
  const wagesByEmployee  = data.wagesByEmployee   || [];
  const expensesByCategory = data.expensesByCategory || {};

  const totalRevenue  = Number(s.totalRevenue  ?? 0);
  const totalExpenses = Number(s.totalExpenses ?? 0);
  const totalWages    = Number(s.totalWages    ?? 0);
  const netRevenue    = Number(s.netRevenue    ?? 0);
  const profit        = Number(s.profit        ?? 0);
  const profitMargin  = Number(s.profitMargin  ?? 0);
  const collectVat    = Number(s.collectVat    ?? 0);
  const inputVat      = Number(s.inputVat      ?? 0);
  const vatPayable    = Number(s.vatPayable    ?? 0);

  const categoryData = Object.entries(expensesByCategory).map(([name, value]) => ({ name, value: Number(value) }));

  const [y, m] = month.split("-").map(Number);
  const monthName = new Date(y, m - 1, 1).toLocaleDateString("de-DE", { month: "long", year: "numeric" });

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold text-white">Buchhaltung</h2>
          <p className="text-gray-400 text-sm mt-1">{monthName} · Alle Zahlen automatisch erfasst</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setMonth(m => changeMonth(m, -1))}
            className="w-9 h-9 bg-gray-800 hover:bg-gray-700 rounded-xl text-white text-lg transition-colors flex items-center justify-center">‹</button>
          <input type="month" value={month} onChange={e => setMonth(e.target.value)}
            max={currentMonth()}
            className="bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-orange-500" />
          <button onClick={() => setMonth(m => changeMonth(m, 1))} disabled={isCurrentMonth}
            className="w-9 h-9 bg-gray-800 hover:bg-gray-700 disabled:opacity-30 rounded-xl text-white text-lg transition-colors flex items-center justify-center">›</button>
          <button onClick={load} className="w-9 h-9 bg-gray-800 hover:bg-gray-700 rounded-xl transition-colors flex items-center justify-center">
            <RefreshCw size={15} className="text-white" />
          </button>
        </div>
      </div>

      {/* Keine Daten */}
      {totalRevenue === 0 && totalExpenses === 0 && entries.length === 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 text-center">
          <FileText size={32} className="text-gray-700 mx-auto mb-3" />
          <p className="text-gray-400">Keine Buchungen in {monthName}</p>
          <p className="text-gray-600 text-sm mt-1">Umsätze aus Gastware importieren oder Ausgaben erfassen</p>
        </div>
      )}

      {/* Hauptkennzahlen */}
      {(totalRevenue > 0 || totalExpenses > 0) && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: "Brutto-Umsatz",  value: fmt(totalRevenue),  sub: `Netto: ${fmt(netRevenue)}`, icon: TrendingUp,   color: "text-green-400",  bg: "bg-green-500/10"  },
              { label: "Ausgaben",       value: fmt(totalExpenses), sub: "inkl. MwSt",                icon: TrendingDown, color: "text-red-400",    bg: "bg-red-500/10"    },
              { label: "Personalkosten", value: fmt(totalWages),    sub: `${wagesByEmployee.length} Mitarbeiter`, icon: TrendingDown, color: "text-orange-400", bg: "bg-orange-500/10" },
              {
                label: "Netto-Gewinn",
                value: fmt(profit),
                sub: fmtPct(profitMargin) + " Marge",
                icon: profit >= 0 ? TrendingUp : TrendingDown,
                color: profit >= 0 ? "text-green-400" : "text-red-400",
                bg: profit >= 0 ? "bg-green-500/10" : "bg-red-500/10",
              },
            ].map(k => (
              <div key={k.label} className={`${k.bg} border border-gray-800 rounded-2xl p-4`}>
                <div className="flex items-center gap-2 mb-2">
                  <k.icon size={15} className={k.color} />
                  <span className="text-gray-400 text-xs">{k.label}</span>
                </div>
                <p className={`text-xl font-bold ${k.color}`}>{k.value}</p>
                <p className="text-gray-500 text-xs mt-0.5">{k.sub}</p>
              </div>
            ))}
          </div>

          {/* MwSt-Box */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-gray-900 border border-orange-500/20 rounded-2xl p-5">
              <p className="text-gray-400 text-sm mb-1">Eingenommene USt (19%)</p>
              <p className="text-2xl font-bold text-orange-400">{fmt(collectVat)}</p>
              <p className="text-gray-500 text-xs mt-1">aus Brutto-Umsatz herausgerechnet</p>
            </div>
            <div className="bg-gray-900 border border-blue-500/20 rounded-2xl p-5">
              <p className="text-gray-400 text-sm mb-1">Vorsteuer (abzugsfähig)</p>
              <p className="text-2xl font-bold text-blue-400">{fmt(inputVat)}</p>
              <p className="text-gray-500 text-xs mt-1">aus Eingangsrechnungen</p>
            </div>
            <div className={`bg-gray-900 border rounded-2xl p-5 ${vatPayable >= 0 ? "border-red-500/20" : "border-green-500/20"}`}>
              <p className="text-gray-400 text-sm mb-1">
                {vatPayable >= 0 ? "USt-Zahllast (ans Finanzamt)" : "Vorsteuerüberhang (Erstattung)"}
              </p>
              <p className={`text-2xl font-bold ${vatPayable >= 0 ? "text-red-400" : "text-green-400"}`}>{fmt(Math.abs(vatPayable))}</p>
              <p className="text-gray-500 text-xs mt-1">USt minus Vorsteuer</p>
            </div>
          </div>

          {/* Hinweis */}
          <div className="bg-yellow-500/5 border border-yellow-500/20 rounded-xl px-4 py-3">
            <p className="text-yellow-400 text-xs">
              ⚠️ <strong>Steuerlicher Hinweis:</strong> Die USt-Berechnung basiert auf 19% für alle Restaurantumsätze (seit Jan. 2024). Für Steuervoranmeldungen bitte immer mit einem Steuerberater abstimmen.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Ausgaben nach Kategorie */}
            {categoryData.length > 0 && (
              <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
                <h3 className="font-semibold text-white mb-4">Ausgaben nach Kategorie</h3>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={categoryData} cx="50%" cy="50%" outerRadius={80} dataKey="value" nameKey="name">
                      {categoryData.map((_, i) => <Cell key={i} fill={FARBEN[i % FARBEN.length]} />)}
                    </Pie>
                    <Tooltip
                      contentStyle={{ background: "#111827", border: "1px solid #1f2937", borderRadius: "12px" }}
                      formatter={(v: any) => [fmt(Number(v)), ""]}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="mt-3 space-y-1">
                  {categoryData.map((c, i) => (
                    <div key={c.name} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full" style={{ background: FARBEN[i % FARBEN.length] }} />
                        <span className="text-gray-400">{c.name}</span>
                      </div>
                      <span className="text-gray-300">{fmt(c.value)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Lohnkosten pro Mitarbeiter */}
            {wagesByEmployee.length > 0 && (
              <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
                <h3 className="font-semibold text-white mb-4">Personalkosten</h3>
                <div className="space-y-3">
                  {wagesByEmployee.map((e: any) => (
                    <div key={e.name} className="flex items-center justify-between py-2 border-b border-gray-800/50 last:border-0">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-orange-500/20 text-orange-400 flex items-center justify-center text-xs font-bold">
                          {e.name?.charAt(0) || "?"}
                        </div>
                        <span className="text-white text-sm">{e.name}</span>
                      </div>
                      <div className="text-right">
                        <p className="text-white text-sm font-medium">{fmt(e.wages)}</p>
                        <p className="text-gray-400 text-xs">{e.hours.toFixed(1)} Std.</p>
                      </div>
                    </div>
                  ))}
                  <div className="flex items-center justify-between pt-2 border-t border-gray-700">
                    <span className="text-gray-300 text-sm font-medium">Gesamt</span>
                    <span className="text-orange-400 font-bold">{fmt(totalWages)}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* Buchungsjournal */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
        <div className="p-5 border-b border-gray-800 flex items-center gap-2">
          <FileText size={18} className="text-orange-400" />
          <h3 className="font-semibold text-white">Buchungsjournal</h3>
          <span className="ml-auto text-gray-500 text-xs">{entries.length} Einträge</span>
        </div>
        <div className="divide-y divide-gray-800/50 max-h-96 overflow-y-auto">
          {entries.length === 0 ? (
            <p className="p-5 text-gray-500 text-sm text-center">Keine Buchungen in {monthName}</p>
          ) : entries.map((e: any) => (
            <div key={e.id} className="px-5 py-3 flex items-center justify-between hover:bg-gray-800/30 transition-colors">
              <div className="min-w-0 mr-4">
                <p className="text-white text-sm truncate">{e.description}</p>
                <p className="text-gray-500 text-xs">{e.entry_date} · {e.reference_type}</p>
              </div>
              <span className={`font-bold text-sm shrink-0 ${e.type === "income" ? "text-green-400" : "text-red-400"}`}>
                {e.type === "income" ? "+" : "−"}{fmt(Number(e.amount))}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
