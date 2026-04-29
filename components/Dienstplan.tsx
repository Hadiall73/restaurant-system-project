"use client";
import { mitarbeiter, dienstplan } from "@/lib/demoData";
import { Users, Clock, Euro } from "lucide-react";

const TAGE = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

export default function Dienstplan() {
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

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
            <span className="text-gray-400 text-sm">Gesamtstunden</span>
          </div>
          <p className="text-3xl font-bold text-white">{mitarbeiter.reduce((s, m) => s + m.stunden, 0)}h</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
          <div className="flex items-center gap-3 mb-2">
            <Euro size={18} className="text-green-400" />
            <span className="text-gray-400 text-sm">Personalkosten</span>
          </div>
          <p className="text-3xl font-bold text-white">
            {mitarbeiter.reduce((s, m) => s + m.stunden * m.lohn, 0).toLocaleString("de-DE")} €
          </p>
        </div>
      </div>

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
              </tr>
            </thead>
            <tbody>
              {dienstplan.map((row, i) => (
                <tr key={i} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors">
                  <td className="px-5 py-3 font-medium text-white">{row.mitarbeiter}</td>
                  {[row.mo, row.di, row.mi, row.do, row.fr, row.sa, row.so].map((schicht, j) => (
                    <td key={j} className="px-3 py-3 text-center">
                      {schicht === "-" ? (
                        <span className="text-gray-700">-</span>
                      ) : (
                        <span className="bg-orange-500/20 text-orange-300 px-2 py-1 rounded-lg text-xs font-medium">{schicht}</span>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
        <h3 className="font-semibold text-white mb-4">Mitarbeiter Übersicht</h3>
        <div className="space-y-3">
          {mitarbeiter.map((m) => (
            <div key={m.id} className="flex items-center justify-between py-2 border-b border-gray-800/50 last:border-0">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-orange-500/20 text-orange-400 flex items-center justify-center text-xs font-bold">
                  {m.name.charAt(0)}
                </div>
                <div>
                  <p className="text-white text-sm font-medium">{m.name}</p>
                  <p className="text-gray-400 text-xs">{m.rolle}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-white text-sm font-medium">{m.stunden}h / Woche</p>
                <p className="text-gray-400 text-xs">{m.lohn} €/h · {(m.stunden * m.lohn).toLocaleString("de-DE")} €</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
