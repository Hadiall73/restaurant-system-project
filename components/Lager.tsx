"use client";
import { lagerbestand } from "@/lib/demoData";
import { AlertTriangle, CheckCircle, ShoppingCart } from "lucide-react";

export default function Lager() {
  const kritisch = lagerbestand.filter((a) => a.menge < a.minimum);
  const ok = lagerbestand.filter((a) => a.menge >= a.minimum);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Wareneinkauf & Lager</h2>
          <p className="text-gray-400 text-sm mt-1">Automatische Bestellvorschläge</p>
        </div>
        <button className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-xl text-sm font-medium flex items-center gap-2 transition-colors">
          <ShoppingCart size={16} />
          Alle bestellen
        </button>
      </div>

      {kritisch.length > 0 && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle size={18} className="text-red-400" />
            <h3 className="font-semibold text-red-400">{kritisch.length} Artikel unter Mindestbestand!</h3>
          </div>
          <div className="space-y-2">
            {kritisch.map((a) => (
              <div key={a.artikel} className="flex items-center justify-between bg-red-500/5 rounded-xl px-4 py-3">
                <div>
                  <p className="text-white font-medium text-sm">{a.artikel}</p>
                  <p className="text-gray-400 text-xs">{a.lieferant}</p>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="text-red-400 text-sm font-medium">{a.menge} {a.einheit}</p>
                    <p className="text-gray-500 text-xs">Min: {a.minimum} {a.einheit}</p>
                  </div>
                  <button className="bg-orange-500 hover:bg-orange-600 text-white px-3 py-1.5 rounded-lg text-xs font-medium transition-colors">
                    Bestellen
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
        <div className="p-5 border-b border-gray-800">
          <h3 className="font-semibold text-white">Gesamter Lagerbestand</h3>
        </div>
        <div className="divide-y divide-gray-800/50">
          {lagerbestand.map((a) => {
            const istKritisch = a.menge < a.minimum;
            const prozent = Math.min((a.menge / (a.minimum * 2)) * 100, 100);
            return (
              <div key={a.artikel} className="px-5 py-4 hover:bg-gray-800/30 transition-colors">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    {istKritisch
                      ? <AlertTriangle size={16} className="text-red-400 shrink-0" />
                      : <CheckCircle size={16} className="text-green-400 shrink-0" />
                    }
                    <div>
                      <p className="text-white text-sm font-medium">{a.artikel}</p>
                      <p className="text-gray-400 text-xs">{a.lieferant} · {a.preis.toFixed(2)} €/{a.einheit}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`text-sm font-medium ${istKritisch ? "text-red-400" : "text-white"}`}>
                      {a.menge} {a.einheit}
                    </p>
                    <p className="text-gray-500 text-xs">Min: {a.minimum}</p>
                  </div>
                </div>
                <div className="w-full bg-gray-800 rounded-full h-1.5">
                  <div
                    className={`h-1.5 rounded-full transition-all ${istKritisch ? "bg-red-500" : "bg-green-500"}`}
                    style={{ width: `${prozent}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
