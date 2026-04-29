"use client";
import { umsatzWoche, umsatzMonat, steuerdaten } from "@/lib/demoData";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";

const FARBEN = ["#f97316", "#3b82f6", "#8b5cf6", "#10b981", "#f59e0b"];

export default function Finanzen() {
  const gesamtUmsatz = umsatzWoche.reduce((s, d) => s + d.umsatz, 0);
  const gesamtKosten = umsatzWoche.reduce((s, d) => s + d.kosten, 0);
  const gewinn = gesamtUmsatz - gesamtKosten;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white">Finanzen & Controlling</h2>
        <p className="text-gray-400 text-sm mt-1">Übersicht dieser Woche</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { label: "Umsatz", wert: gesamtUmsatz, farbe: "text-white" },
          { label: "Kosten", wert: gesamtKosten, farbe: "text-red-400" },
          { label: "Gewinn", wert: gewinn, farbe: "text-green-400" },
        ].map((item) => (
          <div key={item.label} className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
            <p className="text-gray-400 text-sm mb-2">{item.label}</p>
            <p className={`text-3xl font-bold ${item.farbe}`}>{item.wert.toLocaleString("de-DE")} €</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
          <h3 className="font-semibold text-white mb-4">Umsatz vs. Kosten (Woche)</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={umsatzWoche}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
              <XAxis dataKey="tag" stroke="#6b7280" tick={{ fontSize: 12 }} />
              <YAxis stroke="#6b7280" tick={{ fontSize: 12 }} tickFormatter={(v) => `${v}€`} />
              <Tooltip
                contentStyle={{ background: "#111827", border: "1px solid #1f2937", borderRadius: "12px" }}
                formatter={(value) => [`${Number(value).toLocaleString("de-DE")} €`]}
              />
              <Bar dataKey="umsatz" name="Umsatz" fill="#f97316" radius={[4, 4, 0, 0]} />
              <Bar dataKey="kosten" name="Kosten" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
          <h3 className="font-semibold text-white mb-4">Ausgaben nach Kategorie</h3>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={steuerdaten.ausgaben} cx="50%" cy="50%" outerRadius={80} dataKey="betrag" nameKey="kategorie" label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`} labelLine={false}>
                {steuerdaten.ausgaben.map((_, i) => (
                  <Cell key={i} fill={FARBEN[i % FARBEN.length]} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ background: "#111827", border: "1px solid #1f2937", borderRadius: "12px" }} formatter={(v) => `${Number(v).toLocaleString("de-DE")} €`} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
        <h3 className="font-semibold text-white mb-4">Monatsverlauf</h3>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={umsatzMonat}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
            <XAxis dataKey="woche" stroke="#6b7280" tick={{ fontSize: 12 }} />
            <YAxis stroke="#6b7280" tick={{ fontSize: 12 }} tickFormatter={(v) => `${v}€`} />
            <Tooltip contentStyle={{ background: "#111827", border: "1px solid #1f2937", borderRadius: "12px" }} formatter={(v) => `${Number(v).toLocaleString("de-DE")} €`} />
            <Bar dataKey="umsatz" name="Umsatz" fill="#f97316" radius={[4, 4, 0, 0]} />
            <Bar dataKey="kosten" name="Kosten" fill="#3b82f6" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
