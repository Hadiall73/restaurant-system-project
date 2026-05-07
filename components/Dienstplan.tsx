"use client";
import { mitarbeiter, dienstplan } from "@/lib/demoData";
import { Users, Clock, Euro, CheckCircle, AlertTriangle, TrendingDown } from "lucide-react";

const TAGE = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

export default function Dienstplan() {
  const gesamtSoll = mitarbeiter.reduce((s, m) => s + m.sollStunden, 0);
  const gesamtIst  = mitarbeiter.reduce((s, m) => s + m.stunden, 0);
  const fehlstunden = gesamtSoll - gesamtIst;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Dienstplan</h2>
          <p className="text-gray-400 text-sm mt-1">KW 18 · automatisch generiert</p>
        </div>
        <button className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors">
          Exportieren
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
          <div className="flex items-center gap-3 mb-2">
            <Users size={18} className="text-orange-400" />
            <span className="text-gray-400 text-sm">Mitarbeiter</span>
          </div>
          <p className="text-3xl font-bold text-white">{mitarbeiter.length}</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
          <div className="flex items-center gap-3 mb-2">
            <Clock size={18} className="text-blue-400" />
            <span className="text-gray-400 text-sm">Soll-Stunden</span>
          </div>
          <p className="text-3xl font-bold text-white">{gesamtSoll}h</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
          <div className="flex items-center gap-3 mb-2">
            <Clock size={18} className="text-green-400" />
            <span className="text-gray-400 text-sm">Ist-Stunden</span>
          </div>
          <p className="text-3xl font-bold text-white">{gesamtIst}h</p>
        </div>
        <div className={`border rounded-2xl p-5 ${fehlstunden > 0 ? "bg-red-500/10 border-red-500/30" : "bg-green-500/10 border-green-500/30"}`}>
          <div className="flex items-center gap-3 mb-2">
            <Euro size={18} className="text-green-400" />
            <span className="text-gray-400 text-sm">Personalkosten</span>
          </div>
          <p className="text-3xl font-bold text-white">
            {mitarbeiter.reduce((s, m) => s + m.stunden * m.lohn, 0).toLocaleString("de-DE")} €
          </p>
        </div>
      </div>

      {/* Mitarbeiter Stunden — Soll vs Ist */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
        <h3 className="font-semibold text-white mb-4">Soll / Ist Stunden — Aktuelle Woche</h3>
        <div className="space-y-4">
          {mitarbeiter.map((m) => {
            const prozent = Math.min(Math.round((m.stunden / m.sollStunden) * 100), 100);
            const fehl = m.sollStunden - m.stunden;
            const fertig = fehl <= 0;
            return (
              <div key={m.id}>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-orange-500/20 text-orange-400 flex items-center justify-center text-xs font-bold">
                      {m.name.charAt(0)}
                    </div>
                    <span className="text-white text-sm font-medium">{m.name}</span>
                    <span className="text-gray-500 text-xs">{m.rolle}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-gray-400 text-xs">
                      {m.stunden}h / {m.sollStunden}h
                    </span>
                    {fertig ? (
                      <span className="flex items-center gap-1 text-green-400 text-xs font-medium">
                        <CheckCircle size={12} /> Erfüllt
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-red-400 text-xs font-medium">
                        <TrendingDown size={12} /> -{fehl}h fehlen
                      </span>
                    )}
                  </div>
                </div>
                <div className="w-full bg-gray-800 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full transition-all ${fertig ? "bg-green-500" : prozent >= 75 ? "bg-yellow-500" : "bg-red-500"}`}
                    style={{ width: `${prozent}%` }}
                  />
                </div>
                <div className="flex justify-between mt-0.5">
                  <span className="text-gray-600 text-xs">{prozent}% absolviert</span>
                  <span className="text-gray-600 text-xs">{m.lohn} €/h · {(m.stunden * m.lohn).toFixed(2)} € bisher</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Gesamt-Warnung */}
        {fehlstunden > 0 && (
          <div className="mt-5 flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
            <AlertTriangle size={16} className="text-red-400 shrink-0" />
            <p className="text-red-400 text-sm">
              Gesamt <strong>{fehlstunden}h</strong> Soll-Stunden noch nicht absolviert diese Woche.
            </p>
          </div>
        )}
      </div>

      {/* Wochenplan Tabelle */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
        <div className="p-5 border-b border-gray-800">
          <h3 className="font-semibold text-white">Wochenplan</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800">
                <th className="text-left px-5 py-3 text-gray-400 font-medium">Mitarbeiter</th>
                {TAGE.map((t) => (
                  <th key={t} className={`px-3 py-3 text-center text-gray-400 font-medium ${t === "Sa" || t === "So" ? "text-orange-400" : ""}`}>{t}</th>
                ))}
                <th className="px-3 py-3 text-center text-gray-400 font-medium">Soll</th>
              </tr>
            </thead>
            <tbody>
              {dienstplan.map((row, i) => {
                const ma = mitarbeiter.find((m) => m.name === row.mitarbeiter);
                return (
                  <tr key={i} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors">
                    <td className="px-5 py-3 font-medium text-white">{row.mitarbeiter}</td>
                    {[row.mo, row.di, row.mi, row.do, row.fr, row.sa, row.so].map((schicht, j) => (
                      <td key={j} className="px-3 py-3 text-center">
                        {schicht === "-" ? (
                          <span className="text-gray-700">–</span>
                        ) : (
                          <span className="bg-orange-500/20 text-orange-300 px-2 py-1 rounded-lg text-xs font-medium">{schicht}</span>
                        )}
                      </td>
                    ))}
                    <td className="px-3 py-3 text-center">
                      <span className="text-blue-400 text-xs font-medium">{ma?.sollStunden ?? "–"}h</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
