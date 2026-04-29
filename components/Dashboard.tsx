"use client";
import { kpiDaten, umsatzWoche } from "@/lib/demoData";
import { TrendingUp, TrendingDown, Users, Star, Euro, ShoppingBag } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

function KpiKarte({ titel, wert, einheit, trend, icon: Icon, farbe }: {
  titel: string; wert: string | number; einheit?: string; trend?: number;
  icon: React.ElementType; farbe: string;
}) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
      <div className="flex items-start justify-between mb-4">
        <div className={`p-2.5 rounded-xl ${farbe}`}>
          <Icon size={18} className="text-white" />
        </div>
        {trend !== undefined && (
          <div className={`flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full ${trend >= 0 ? "bg-green-500/10 text-green-400" : "bg-red-500/10 text-red-400"}`}>
            {trend >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
            {Math.abs(trend)}%
          </div>
        )}
      </div>
      <p className="text-gray-400 text-sm mb-1">{titel}</p>
      <p className="text-2xl font-bold text-white">
        {wert}{einheit && <span className="text-sm font-normal text-gray-400 ml-1">{einheit}</span>}
      </p>
    </div>
  );
}

export default function Dashboard() {
  const belegung = Math.round((kpiDaten.offeneTische / kpiDaten.gesamtTische) * 100);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white">Dashboard</h2>
        <p className="text-gray-400 text-sm mt-1">Montag, 28. April 2026</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiKarte titel="Heute Umsatz" wert={`${kpiDaten.tagesUmsatz.toLocaleString("de-DE")} €`} trend={12} icon={Euro} farbe="bg-orange-500" />
        <KpiKarte titel="Diese Woche" wert={`${kpiDaten.wochenUmsatz.toLocaleString("de-DE")} €`} trend={8} icon={TrendingUp} farbe="bg-blue-500" />
        <KpiKarte titel="Ø Bon" wert={`${kpiDaten.durchschnittsBon} €`} trend={3} icon={ShoppingBag} farbe="bg-purple-500" />
        <KpiKarte titel="Bewertung" wert={kpiDaten.zufriedenheit} einheit="/ 5" icon={Star} farbe="bg-yellow-500" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-gray-900 border border-gray-800 rounded-2xl p-5">
          <h3 className="font-semibold text-white mb-4">Umsatz diese Woche</h3>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={umsatzWoche}>
              <defs>
                <linearGradient id="umsatzGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f97316" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="kostenGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
              <XAxis dataKey="tag" stroke="#6b7280" tick={{ fontSize: 12 }} />
              <YAxis stroke="#6b7280" tick={{ fontSize: 12 }} tickFormatter={(v) => `${v}€`} />
              <Tooltip
                contentStyle={{ background: "#111827", border: "1px solid #1f2937", borderRadius: "12px" }}
                labelStyle={{ color: "#f9fafb" }}
                formatter={(value) => [`${Number(value).toLocaleString("de-DE")} €`]}
              />
              <Area type="monotone" dataKey="umsatz" name="Umsatz" stroke="#f97316" fill="url(#umsatzGrad)" strokeWidth={2} />
              <Area type="monotone" dataKey="kosten" name="Kosten" stroke="#3b82f6" fill="url(#kostenGrad)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
          <div className="flex gap-4 mt-2">
            <div className="flex items-center gap-2 text-xs text-gray-400"><span className="w-3 h-0.5 bg-orange-500 inline-block" /> Umsatz</div>
            <div className="flex items-center gap-2 text-xs text-gray-400"><span className="w-3 h-0.5 bg-blue-500 inline-block" /> Kosten</div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-white">Tischbelegung</h3>
              <Users size={16} className="text-gray-400" />
            </div>
            <div className="text-3xl font-bold text-white mb-1">{kpiDaten.offeneTische} / {kpiDaten.gesamtTische}</div>
            <p className="text-gray-400 text-sm mb-3">Tische belegt</p>
            <div className="w-full bg-gray-800 rounded-full h-2">
              <div className="bg-orange-500 h-2 rounded-full transition-all" style={{ width: `${belegung}%` }} />
            </div>
            <p className="text-xs text-gray-400 mt-1">{belegung}% Auslastung</p>
          </div>

          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
            <h3 className="font-semibold text-white mb-3">Gewinnmarge</h3>
            <div className="text-3xl font-bold text-green-400 mb-1">{kpiDaten.gewinnMarge}%</div>
            <p className="text-gray-400 text-sm">Diese Woche</p>
            <div className="w-full bg-gray-800 rounded-full h-2 mt-3">
              <div className="bg-green-500 h-2 rounded-full" style={{ width: `${kpiDaten.gewinnMarge}%` }} />
            </div>
          </div>

          <div className="bg-orange-500/10 border border-orange-500/20 rounded-2xl p-4">
            <p className="text-orange-400 text-xs font-medium mb-1">KI Hinweis</p>
            <p className="text-sm text-gray-300">Freitag & Samstag bringen 45% des Wochenumsatzes. Mehr Personal einplanen!</p>
          </div>
        </div>
      </div>
    </div>
  );
}
