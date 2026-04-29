"use client";
import { useEffect, useState } from "react";
import { useStore } from "@/lib/store";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { TrendingUp, TrendingDown, FileText, Download, RefreshCw } from "lucide-react";

const FARBEN = ["#f97316", "#3b82f6", "#8b5cf6", "#10b981", "#f59e0b", "#ef4444"];

export default function Bookkeeping() {
  const { restaurant } = useStore();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));

  async function load() {
    if (!restaurant) return;
    setLoading(true);
    const res = await fetch(`/api/bookkeeping?restaurant_id=${restaurant.id}&month=${month}`);
    const json = await res.json();
    setData(json);
    setLoading(false);
  }

  useEffect(() => { load(); }, [restaurant, month]);

  if (loading) return <div className="flex items-center justify-center h-64 text-gray-500">Lade Buchhaltung...</div>;
  if (!data) return null;

  const { summary, expensesByCategory, wagesByEmployee, entries } = data;

  const categoryData = Object.entries(expensesByCategory || {}).map(([name, value]) => ({ name, value }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold text-white">Automatische Buchhaltung</h2>
          <p className="text-gray-400 text-sm mt-1">Alle Einnahmen & Ausgaben automatisch erfasst</p>
        </div>
        <div className="flex items-center gap-2">
          <input type="month" value={month} onChange={e => setMonth(e.target.value)}
            className="bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-orange-500" />
          <button onClick={load} className="bg-gray-800 hover:bg-gray-700 p-2 rounded-xl transition-colors"><RefreshCw size={16} className="text-white" /></button>
          <button className="border border-gray-700 hover:bg-gray-800 text-white px-3 py-2 rounded-xl text-sm flex items-center gap-2 transition-colors">
            <Download size={16} /> Export
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Umsatz", value: `${summary.totalRevenue.toLocaleString("de-DE", { minimumFractionDigits: 2 })} €`, icon: TrendingUp, color: "text-green-400", bg: "bg-green-500/10" },
          { label: "Ausgaben", value: `${summary.totalExpenses.toLocaleString("de-DE", { minimumFractionDigits: 2 })} €`, icon: TrendingDown, color: "text-red-400", bg: "bg-red-500/10" },
          { label: "Personal", value: `${summary.totalWages.toLocaleString("de-DE", { minimumFractionDigits: 2 })} €`, icon: TrendingDown, color: "text-orange-400", bg: "bg-orange-500/10" },
          { label: "Gewinn", value: `${summary.profit.toLocaleString("de-DE", { minimumFractionDigits: 2 })} €`, icon: summary.profit >= 0 ? TrendingUp : TrendingDown, color: summary.profit >= 0 ? "text-green-400" : "text-red-400", bg: summary.profit >= 0 ? "bg-green-500/10" : "bg-red-500/10" },
        ].map(k => (
          <div key={k.label} className={`${k.bg} border border-gray-800 rounded-2xl p-5`}>
            <div className="flex items-center gap-2 mb-2">
              <k.icon size={16} className={k.color} />
              <span className="text-gray-400 text-sm">{k.label}</span>
            </div>
            <p className={`text-2xl font-bold ${k.color}`}>{k.value}</p>
          </div>
        ))}
      </div>

      {/* Tax info */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gray-900 border border-red-500/20 rounded-2xl p-5">
          <p className="text-gray-400 text-sm mb-1">USt-Zahllast</p>
          <p className="text-3xl font-bold text-red-400">{summary.vatPayable.toLocaleString("de-DE", { minimumFractionDigits: 2 })} €</p>
          <p className="text-gray-500 text-xs mt-1">Umsatzsteuer abzügl. Vorsteuer</p>
        </div>
        <div className="bg-gray-900 border border-green-500/20 rounded-2xl p-5">
          <p className="text-gray-400 text-sm mb-1">Vorsteuer (abzugsfähig)</p>
          <p className="text-3xl font-bold text-green-400">{summary.inputVat.toLocaleString("de-DE", { minimumFractionDigits: 2 })} €</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
          <p className="text-gray-400 text-sm mb-1">Gewinnmarge</p>
          <p className={`text-3xl font-bold ${summary.profitMargin >= 0 ? "text-green-400" : "text-red-400"}`}>{summary.profitMargin}%</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Expense breakdown */}
        {categoryData.length > 0 && (
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
            <h3 className="font-semibold text-white mb-4">Ausgaben nach Kategorie</h3>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={categoryData} cx="50%" cy="50%" outerRadius={80} dataKey="value" nameKey="name">
                  {categoryData.map((_, i) => <Cell key={i} fill={FARBEN[i % FARBEN.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ background: "#111827", border: "1px solid #1f2937", borderRadius: "12px" }} formatter={(v) => `${Number(v).toFixed(2)} €`} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Wages per employee */}
        {wagesByEmployee?.length > 0 && (
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
            <h3 className="font-semibold text-white mb-4">Lohnkosten Mitarbeiter</h3>
            <div className="space-y-3">
              {wagesByEmployee.map((e: any) => (
                <div key={e.name} className="flex items-center justify-between py-2 border-b border-gray-800/50 last:border-0">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-orange-500/20 text-orange-400 flex items-center justify-center text-xs font-bold">{e.name?.charAt(0)}</div>
                    <span className="text-white text-sm">{e.name}</span>
                  </div>
                  <div className="text-right">
                    <p className="text-white text-sm font-medium">{e.wages.toFixed(2)} €</p>
                    <p className="text-gray-400 text-xs">{e.hours.toFixed(1)}h</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Journal */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
        <div className="p-5 border-b border-gray-800 flex items-center gap-2">
          <FileText size={18} className="text-orange-400" />
          <h3 className="font-semibold text-white">Buchungsjournal (automatisch)</h3>
        </div>
        <div className="divide-y divide-gray-800/50 max-h-80 overflow-y-auto">
          {entries.length === 0 ? (
            <p className="p-5 text-gray-500 text-sm">Noch keine Buchungen in diesem Monat</p>
          ) : entries.map((e: any) => (
            <div key={e.id} className="px-5 py-3 flex items-center justify-between hover:bg-gray-800/30 transition-colors">
              <div>
                <p className="text-white text-sm">{e.description}</p>
                <p className="text-gray-400 text-xs">{e.entry_date} · {e.reference_type}</p>
              </div>
              <span className={`font-bold text-sm ${e.type === "income" ? "text-green-400" : "text-red-400"}`}>
                {e.type === "income" ? "+" : "-"}{Number(e.amount).toFixed(2)} €
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
