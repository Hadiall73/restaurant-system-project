"use client";
import { useEffect, useState } from "react";
import { useStore } from "@/lib/store";
import { FileText, Download, Mail, AlertCircle, RefreshCw, Pencil, Check, Building2, Euro, TrendingDown, Users } from "lucide-react";

function fmt(n: number) { return n.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }

function monatsName(m: string) {
  const [y, mo] = m.split("-");
  return new Date(Number(y), Number(mo) - 1, 1).toLocaleDateString("de-DE", { month: "long", year: "numeric" });
}

export default function Steuer() {
  const { restaurant } = useStore();
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Steuerberater E-Mail
  const [taxEmail, setTaxEmail] = useState("");
  const [editingEmail, setEditingEmail] = useState(false);
  const [emailInput, setEmailInput] = useState("");

  useEffect(() => {
    const saved = localStorage.getItem("taxAdvisorEmail");
    if (saved) setTaxEmail(saved);
  }, []);

  function saveTaxEmail() {
    setTaxEmail(emailInput);
    localStorage.setItem("taxAdvisorEmail", emailInput);
    setEditingEmail(false);
  }

  async function load() {
    if (!restaurant) return;
    setLoading(true);
    const res = await fetch(`/api/bookkeeping?restaurant_id=${restaurant.id}&month=${month}`);
    const json = await res.json();
    setData(json);
    setLoading(false);
  }

  useEffect(() => { load(); }, [restaurant, month]);

  function exportCSV() {
    if (!data) return;
    const { summary, wagesByEmployee, expensesByCategory } = data;
    const rows: string[][] = [
      ["Monatsabschluss", monatsName(month), restaurant?.name || ""],
      [],
      ["=== EINNAHMEN ==="],
      ["Umsatz (brutto)", fmt(summary.totalRevenue), "EUR"],
      ["Umsatzsteuer (19%)", fmt(summary.totalRevenue * 0.19), "EUR"],
      ["Nettoumsatz", fmt(summary.totalRevenue / 1.19), "EUR"],
      [],
      ["=== AUSGABEN ==="],
      ["Kategorie", "Betrag (brutto)", "EUR"],
      ...Object.entries(expensesByCategory || {}).map(([cat, val]) => [cat, fmt(Number(val)), "EUR"]),
      ["Summe Ausgaben", fmt(summary.totalExpenses), "EUR"],
      [],
      ["=== PERSONALKOSTEN ==="],
      ["Mitarbeiter", "Stunden", "Lohnkosten"],
      ...(data.wagesByEmployee || []).map((e: any) => [e.name, e.hours.toFixed(2), fmt(e.wages)]),
      ["Summe Personal", "", fmt(summary.totalWages)],
      [],
      ["=== STEUER ==="],
      ["Umsatzsteuer (Einnahmen 19%)", fmt(summary.totalRevenue * 0.19), "EUR"],
      ["Vorsteuer (Ausgaben)", fmt(summary.inputVat), "EUR"],
      ["USt-Zahllast", fmt(summary.vatPayable), "EUR"],
      [],
      ["=== ERGEBNIS ==="],
      ["Gewinn / Verlust", fmt(summary.profit), "EUR"],
      ["Gewinnmarge", `${summary.profitMargin}%`, ""],
    ];
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(";")).join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Monatsabschluss_${restaurant?.name?.replace(/\s+/g, "_")}_${month}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function sendEmail() {
    if (!data || !taxEmail) return;
    const { summary } = data;
    const subject = encodeURIComponent(`Monatsabschluss ${monatsName(month)} – ${restaurant?.name}`);
    const body = encodeURIComponent(
      `Sehr geehrte/r Steuerberater/in,\n\n` +
      `anbei der Monatsabschluss für ${monatsName(month)}.\n\n` +
      `Restaurant: ${restaurant?.name}\n` +
      `Zeitraum: ${monatsName(month)}\n\n` +
      `--- ÜBERSICHT ---\n` +
      `Umsatz (brutto):    ${fmt(summary.totalRevenue)} €\n` +
      `Ausgaben:           ${fmt(summary.totalExpenses)} €\n` +
      `Personalkosten:     ${fmt(summary.totalWages)} €\n` +
      `Gewinn / Verlust:   ${fmt(summary.profit)} €\n` +
      `Gewinnmarge:        ${summary.profitMargin}%\n\n` +
      `--- STEUER ---\n` +
      `Umsatzsteuer (19%): ${fmt(summary.totalRevenue * 0.19)} €\n` +
      `Vorsteuer:          ${fmt(summary.inputVat)} €\n` +
      `USt-Zahllast:       ${fmt(summary.vatPayable)} €\n\n` +
      `Die CSV-Datei (DATEV-kompatibel) wurde separat als Download generiert.\n\n` +
      `Mit freundlichen Grüßen\n${restaurant?.name}`
    );
    window.location.href = `mailto:${taxEmail}?subject=${subject}&body=${body}`;
  }

  const nextDeadline = () => {
    const [y, m] = month.split("-").map(Number);
    const next = new Date(y, m, 10); // USt-Voranmeldung: 10. des Folgemonats
    return next.toLocaleDateString("de-DE");
  };

  if (loading) return <div className="flex items-center justify-center h-64 text-gray-500">Lade Steuerdaten...</div>;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold text-white">Steuer & Finanzamt</h2>
          <p className="text-gray-400 text-sm mt-1">Monatlicher Abschluss für den Steuerberater</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <input type="month" value={month} onChange={e => setMonth(e.target.value)}
            className="bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-orange-500" />
          <button onClick={load} className="bg-gray-800 hover:bg-gray-700 p-2 rounded-xl transition-colors">
            <RefreshCw size={16} className="text-white" />
          </button>
          <button onClick={exportCSV}
            className="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors">
            <Download size={15} /> CSV (DATEV)
          </button>
          <button onClick={sendEmail} disabled={!taxEmail}
            className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-40 disabled:cursor-not-allowed text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors">
            <Mail size={15} /> An Steuerberater
          </button>
        </div>
      </div>

      {/* Steuerberater E-Mail */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 flex items-center gap-4">
        <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center shrink-0">
          <Mail size={18} className="text-blue-400" />
        </div>
        <div className="flex-1">
          <p className="text-gray-400 text-xs mb-1">Steuerberater E-Mail</p>
          {editingEmail ? (
            <div className="flex items-center gap-2">
              <input autoFocus type="email" value={emailInput} onChange={e => setEmailInput(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") saveTaxEmail(); if (e.key === "Escape") setEditingEmail(false); }}
                placeholder="steuerberater@kanzlei.de"
                className="flex-1 bg-gray-800 border border-orange-500 rounded-lg px-3 py-1.5 text-white text-sm focus:outline-none" />
              <button onClick={saveTaxEmail} className="text-green-400 hover:text-green-300"><Check size={16} /></button>
              <button onClick={() => setEditingEmail(false)} className="text-red-400 hover:text-red-300 text-lg leading-none">×</button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <p className="text-white text-sm font-medium">{taxEmail || <span className="text-gray-500 italic">Noch nicht hinterlegt</span>}</p>
              <button onClick={() => { setEmailInput(taxEmail); setEditingEmail(true); }}
                className="text-gray-500 hover:text-orange-400 transition-colors"><Pencil size={13} /></button>
            </div>
          )}
        </div>
        {!taxEmail && (
          <p className="text-yellow-500 text-xs text-right">E-Mail hinterlegen um<br />direkt senden zu können</p>
        )}
      </div>

      {/* Fälligkeit */}
      {data && (
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4 flex items-start gap-3">
          <AlertCircle size={18} className="text-amber-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-amber-400 font-medium text-sm">USt-Voranmeldung fällig: {nextDeadline()}</p>
            <p className="text-gray-300 text-sm mt-0.5">
              Zahllast <strong className="text-white">{fmt(data.summary.vatPayable)} €</strong> für {monatsName(month)} beim Finanzamt anmelden.
            </p>
          </div>
        </div>
      )}

      {/* KPI Karten */}
      {data && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: "Umsatz (brutto)", value: fmt(data.summary.totalRevenue) + " €", icon: Euro, color: "text-green-400", bg: "bg-green-500/10" },
            { label: "Ausgaben", value: fmt(data.summary.totalExpenses) + " €", icon: TrendingDown, color: "text-red-400", bg: "bg-red-500/10" },
            { label: "Personalkosten", value: fmt(data.summary.totalWages) + " €", icon: Users, color: "text-orange-400", bg: "bg-orange-500/10" },
            { label: "Gewinn / Verlust", value: fmt(data.summary.profit) + " €", icon: Building2, color: data.summary.profit >= 0 ? "text-green-400" : "text-red-400", bg: data.summary.profit >= 0 ? "bg-green-500/10" : "bg-red-500/10" },
          ].map(k => (
            <div key={k.label} className={`${k.bg} border border-gray-800 rounded-2xl p-5`}>
              <div className="flex items-center gap-2 mb-2">
                <k.icon size={15} className={k.color} />
                <span className="text-gray-400 text-xs">{k.label}</span>
              </div>
              <p className={`text-xl font-bold ${k.color}`}>{k.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Steuer Übersicht */}
      {data && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-gray-900 border border-red-500/20 rounded-2xl p-5">
            <p className="text-gray-400 text-sm mb-1">Umsatzsteuer (19%)</p>
            <p className="text-3xl font-bold text-red-400">{fmt(data.summary.totalRevenue * 0.19)} €</p>
            <p className="text-gray-500 text-xs mt-1">aus Einnahmen</p>
          </div>
          <div className="bg-gray-900 border border-green-500/20 rounded-2xl p-5">
            <p className="text-gray-400 text-sm mb-1">Vorsteuer (abzugsfähig)</p>
            <p className="text-3xl font-bold text-green-400">{fmt(data.summary.inputVat)} €</p>
            <p className="text-gray-500 text-xs mt-1">aus Ausgaben</p>
          </div>
          <div className="bg-gray-900 border border-orange-500/20 rounded-2xl p-5">
            <p className="text-gray-400 text-sm mb-1">USt-Zahllast ans Finanzamt</p>
            <p className="text-3xl font-bold text-orange-400">{fmt(data.summary.vatPayable)} €</p>
            <p className="text-gray-500 text-xs mt-1">bis {nextDeadline()}</p>
          </div>
        </div>
      )}

      {/* Ausgaben nach Kategorie */}
      {data && Object.keys(data.expensesByCategory || {}).length > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
          <h3 className="font-semibold text-white mb-4">Ausgaben nach Kategorie</h3>
          <div className="space-y-2">
            {Object.entries(data.expensesByCategory as Record<string, number>)
              .sort(([, a], [, b]) => b - a)
              .map(([cat, val]) => {
                const total = data.summary.totalExpenses || 1;
                const pct = Math.round((val / total) * 100);
                return (
                  <div key={cat} className="flex items-center gap-3">
                    <span className="text-gray-300 text-sm w-40 truncate">{cat}</span>
                    <div className="flex-1 bg-gray-800 rounded-full h-2">
                      <div className="bg-orange-500 h-2 rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-white text-sm font-medium w-24 text-right">{fmt(val)} €</span>
                    <span className="text-gray-500 text-xs w-8 text-right">{pct}%</span>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* Personalkosten */}
      {data && data.wagesByEmployee?.length > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
          <h3 className="font-semibold text-white mb-4">Personalkosten {monatsName(month)}</h3>
          <div className="space-y-2">
            {data.wagesByEmployee.map((e: any) => (
              <div key={e.name} className="flex items-center justify-between py-2 border-b border-gray-800/50 last:border-0">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-orange-500/20 text-orange-400 flex items-center justify-center text-xs font-bold">
                    {e.name?.charAt(0)}
                  </div>
                  <span className="text-white text-sm">{e.name}</span>
                </div>
                <div className="text-right">
                  <p className="text-white text-sm font-medium">{fmt(e.wages)} €</p>
                  <p className="text-gray-400 text-xs">{e.hours.toFixed(1)} Std.</p>
                </div>
              </div>
            ))}
            <div className="flex items-center justify-between pt-2">
              <span className="text-gray-400 text-sm font-medium">Gesamt Personalkosten</span>
              <span className="text-orange-400 font-bold">{fmt(data.summary.totalWages)} €</span>
            </div>
          </div>
        </div>
      )}

      {/* Buchungsjournal */}
      {data && (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
          <div className="p-5 border-b border-gray-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText size={18} className="text-orange-400" />
              <h3 className="font-semibold text-white">Buchungsjournal</h3>
            </div>
            <button onClick={exportCSV} className="flex items-center gap-1.5 text-gray-400 hover:text-white text-xs transition-colors">
              <Download size={13} /> CSV herunterladen
            </button>
          </div>
          <div className="divide-y divide-gray-800/50 max-h-80 overflow-y-auto">
            {data.entries.length === 0 ? (
              <p className="p-6 text-gray-500 text-sm text-center">Noch keine Buchungen in diesem Monat</p>
            ) : data.entries.map((e: any) => (
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
      )}

      {/* Hinweise */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
        <h3 className="font-semibold text-white mb-4">Wichtige Hinweise</h3>
        <div className="space-y-3">
          {[
            "USt-Voranmeldung: immer bis zum 10. des Folgemonats beim Finanzamt einreichen (ELSTER).",
            "Alle Belege für Wareneinkauf aufbewahren — als Vorsteuer abziehbar (korrekte Rechnung mit USt-Nr. nötig).",
            "Personalkosten inkl. Sozialabgaben vollständig als Betriebsausgabe absetzbar.",
            "CSV-Export ist DATEV-kompatibel — direkt an deinen Steuerberater per E-Mail schicken.",
          ].map((tip, i) => (
            <div key={i} className="flex items-start gap-3 bg-gray-800/50 rounded-xl p-3">
              <div className="w-5 h-5 rounded-full bg-orange-500/20 text-orange-400 flex items-center justify-center text-xs font-bold shrink-0">{i + 1}</div>
              <p className="text-gray-300 text-sm">{tip}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
