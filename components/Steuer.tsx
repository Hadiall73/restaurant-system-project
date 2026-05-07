"use client";
import { useEffect, useState } from "react";
import { useStore } from "@/lib/store";
import { FileText, Download, Mail, AlertCircle, RefreshCw, Pencil, Check, ChevronLeft, ChevronRight, Printer } from "lucide-react";

// ── Hilfsfunktionen ──────────────────────────────────────────────────────────
function fmt(n: number | null | undefined): string {
  if (n == null || isNaN(n)) return "0,00";
  return n.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtE(n: number | null | undefined): string { return fmt(n) + " €"; }
function currentMonth() {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}`;
}
function currentYear() { return new Date().getFullYear(); }
function changeMonth(base: string, dir: 1 | -1): string {
  const [y, m] = base.split("-").map(Number);
  let ny = y, nm = m + dir;
  if (nm > 12) { nm = 1; ny++; }
  if (nm < 1) { nm = 12; ny--; }
  return `${ny}-${String(nm).padStart(2, "0")}`;
}
function monthEnd(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  return `${y}-${String(m).padStart(2, "0")}-${String(new Date(y, m, 0).getDate()).padStart(2, "0")}`;
}
function monatsName(m: string) {
  const [y, mo] = m.split("-").map(Number);
  return new Date(y, mo - 1, 1).toLocaleDateString("de-DE", { month: "long", year: "numeric" });
}
function fristUStVA(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return new Date(y, m, 10).toLocaleDateString("de-DE"); // 10. des Folgemonats
}

// EÜR-Kategorienzuordnung (Betriebsausgaben nach § 4 EStG)
const EUER_MAP: Record<string, { kz: string; label: string }> = {
  "Wareneinkauf":   { kz: "Kz 26", label: "Wareneinkauf / Bezogene Waren" },
  "Personal":       { kz: "Kz 29", label: "Löhne und Gehälter" },
  "Energie":        { kz: "Kz 62", label: "Kosten für Strom, Gas, Wasser" },
  "Miete":          { kz: "Kz 62", label: "Miete / Pacht für Geschäftsräume" },
  "Reparaturen":    { kz: "Kz 27", label: "Instandhaltung / Reparaturen" },
  "Versicherung":   { kz: "Kz 46", label: "Versicherungsbeiträge" },
  "Marketing":      { kz: "Kz 57", label: "Werbekosten / Marketing" },
  "Buchhaltung":    { kz: "Kz 57", label: "Steuerberatung / Buchführung" },
  "Betriebsmittel": { kz: "Kz 57", label: "Sonstige Betriebsausgaben" },
  "Sonstiges":      { kz: "Kz 57", label: "Sonstige Betriebsausgaben" },
};

function getEuerKz(cat: string) {
  return EUER_MAP[cat] || { kz: "Kz 57", label: cat };
}

// ── Kennzahl-Row Komponente ───────────────────────────────────────────────────
function KzRow({ kz, label, value, bold = false, highlight = false }: {
  kz: string; label: string; value: string; bold?: boolean; highlight?: boolean;
}) {
  return (
    <div className={`flex items-center justify-between py-2.5 px-4 border-b border-gray-800/50 last:border-0 ${highlight ? "bg-orange-500/10" : ""}`}>
      <div className="flex items-center gap-3">
        <span className="text-xs font-mono bg-gray-800 text-orange-400 px-2 py-0.5 rounded border border-gray-700 w-14 text-center shrink-0">{kz}</span>
        <span className={`text-sm ${bold ? "text-white font-semibold" : "text-gray-300"}`}>{label}</span>
      </div>
      <span className={`font-mono text-sm shrink-0 ml-4 ${bold ? "text-white font-bold" : "text-gray-200"} ${highlight ? "text-orange-400 font-bold" : ""}`}>{value} €</span>
    </div>
  );
}

// ── Hauptkomponente ───────────────────────────────────────────────────────────
export default function Steuer() {
  const { restaurant } = useStore();
  const [tab, setTab]     = useState<"ustva" | "euer" | "bwa">("ustva");
  const [month, setMonth] = useState(currentMonth);
  const [year, setYear]   = useState(currentYear);
  const [data, setData]   = useState<any>(null);
  const [yearData, setYearData] = useState<any[]>([]);
  const [loading, setLoading]   = useState(true);
  const [taxEmail, setTaxEmail] = useState("");
  const [editEmail, setEditEmail] = useState(false);
  const [emailInput, setEmailInput] = useState("");

  useEffect(() => {
    const saved = localStorage.getItem("taxAdvisorEmail");
    if (saved) setTaxEmail(saved);
  }, []);

  async function load() {
    if (!restaurant) return;
    setLoading(true);
    const res  = await fetch(`/api/bookkeeping?restaurant_id=${restaurant.id}&month=${month}`);
    const json = await res.json();
    setData(json);
    setLoading(false);
  }

  async function loadYear() {
    if (!restaurant) return;
    const promises = Array.from({ length: 12 }, (_, i) => {
      const m = `${year}-${String(i + 1).padStart(2, "0")}`;
      return fetch(`/api/bookkeeping?restaurant_id=${restaurant.id}&month=${m}`).then(r => r.json()).then(d => ({ month: m, ...d }));
    });
    const results = await Promise.all(promises);
    setYearData(results);
  }

  useEffect(() => { load(); }, [restaurant?.id, month]);
  useEffect(() => { if (tab === "euer" || tab === "bwa") loadYear(); }, [tab, year, restaurant?.id]);

  // ── Berechnungen ─────────────────────────────────────────────────────────────
  const s = data?.summary || {};
  const totalRevenue  = Number(s.totalRevenue  || 0);
  const totalExpenses = Number(s.totalExpenses || 0);
  const totalWages    = Number(s.totalWages    || 0);
  const netRevenue    = Number(s.netRevenue    || 0);    // Netto-Umsatz (÷1.19)
  const collectVat    = Number(s.collectVat    || 0);    // USt aus Erlösen (×19/119)
  const inputVat      = Number(s.inputVat      || 0);    // Vorsteuer
  const vatPayable    = Number(s.vatPayable    || 0);    // Zahllast
  const profit        = Number(s.profit        || 0);
  const expensesCat   = data?.expensesByCategory || {};

  // UStVA Kennzahlen
  const kz81  = Math.round(netRevenue * 100) / 100;         // Nettoumsatz 19%
  const kz511 = Math.round(collectVat * 100) / 100;         // USt daraus
  const kz66  = Math.round(inputVat * 100) / 100;           // Vorsteuer
  const kz83  = Math.round(vatPayable * 100) / 100;         // Zahllast

  // EÜR Jahreszahlen
  const yearRevenue  = yearData.reduce((s, m) => s + Number(m.summary?.totalRevenue  || 0), 0);
  const yearExpenses = yearData.reduce((s, m) => s + Number(m.summary?.totalExpenses || 0), 0);
  const yearWages    = yearData.reduce((s, m) => s + Number(m.summary?.totalWages    || 0), 0);
  const yearNetRev   = yearData.reduce((s, m) => s + Number(m.summary?.netRevenue    || 0), 0);
  const yearProfit   = yearNetRev - yearData.reduce((s, m) => s + Number(m.summary?.totalExpensesNet || (m.summary?.totalExpenses || 0) / 1.19), 0) - yearWages;

  // EÜR Ausgaben nach Kategorie (Jahreskumuliert)
  const yearExpCat: Record<string, number> = {};
  yearData.forEach(m => {
    Object.entries(m.expensesByCategory || {}).forEach(([cat, val]) => {
      yearExpCat[cat] = (yearExpCat[cat] || 0) + Number(val);
    });
  });

  // ── PDF Export UStVA ─────────────────────────────────────────────────────────
  async function exportUStVA_PDF() {
    const { default: jsPDF } = await import("jspdf");
    const doc = new jsPDF({ unit: "mm", format: "a4" });
    const W = 210;
    const gray = (v: number): [number, number, number] => [v, v, v];

    // Header
    doc.setFillColor(31, 41, 55);
    doc.rect(0, 0, W, 30, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(16); doc.setFont("helvetica", "bold");
    doc.text("Umsatzsteuer-Voranmeldung (USt 1 A)", 14, 13);
    doc.setFontSize(10); doc.setFont("helvetica", "normal");
    doc.text(`Anmeldezeitraum: ${monatsName(month)}`, 14, 22);
    doc.text(`Fälligkeit: ${fristUStVA(month)}`, W - 14, 22, { align: "right" });

    // Unternehmensdaten
    let y = 38;
    doc.setFillColor(249, 250, 251);
    doc.roundedRect(14, y, W - 28, 22, 3, 3, "F");
    doc.setTextColor(...gray(30)); doc.setFontSize(9); doc.setFont("helvetica", "bold");
    doc.text("UNTERNEHMEN", 19, y + 7);
    doc.setFontSize(11); doc.setFont("helvetica", "bold");
    doc.text(restaurant?.name || "Restaurant", 19, y + 15);
    doc.setFontSize(9); doc.setFont("helvetica", "normal"); doc.setTextColor(...gray(100));
    doc.text(`Erstellt am: ${new Date().toLocaleDateString("de-DE")}`, W - 19, y + 15, { align: "right" });

    y += 30;

    const section = (title: string) => {
      doc.setFillColor(249, 115, 22);
      doc.rect(14, y, W - 28, 8, "F");
      doc.setTextColor(255, 255, 255); doc.setFontSize(9); doc.setFont("helvetica", "bold");
      doc.text(title, 19, y + 5.5);
      y += 8;
    };

    const row = (kz: string, label: string, value: string, isTotal = false) => {
      if (isTotal) { doc.setFillColor(55, 65, 81); doc.rect(14, y, W - 28, 9, "F"); }
      else if (y % 18 < 9) { doc.setFillColor(249, 250, 251); doc.rect(14, y, W - 28, 9, "F"); }
      doc.setTextColor(isTotal ? 255 : 30, isTotal ? 255 : 30, isTotal ? 255 : 30);
      doc.setFontSize(isTotal ? 10 : 9);
      doc.setFont("helvetica", isTotal ? "bold" : "normal");
      doc.text(kz, 19, y + 6);
      doc.text(label, 45, y + 6);
      doc.text(value + " €", W - 19, y + 6, { align: "right" });
      doc.setDrawColor(229, 231, 235); doc.setLineWidth(0.1);
      doc.line(14, y + 9, W - 14, y + 9);
      y += 9;
    };

    // Abschnitt A: Lieferungen und sonstige Leistungen
    section("A. STEUERPFLICHTIGE UMSÄTZE");
    row("Kz 81", "Lieferungen / Leistungen 19 % (Nettobetrag)", fmt(kz81));
    row("Kz 511", "Umsatzsteuer 19 %", fmt(kz511));

    y += 4;

    // Abschnitt B: Vorsteuer
    section("B. ABZIEHBARE VORSTEUERBETRÄGE");
    row("Kz 66", "Vorsteuerbeträge aus Rechnungen (§ 15 UStG)", fmt(kz66));

    y += 4;

    // Abschnitt C: Zahllast
    section("C. VERBLEIBENDE UMSATZSTEUER-VORAUSZAHLUNG");
    row("Kz 83", vatPayable >= 0 ? "Umsatzsteuer-Vorauszahlung" : "Überschuss (Erstattung)", fmt(Math.abs(kz83)), true);

    y += 12;

    // Wichtiger Hinweis
    doc.setFillColor(254, 247, 237);
    doc.roundedRect(14, y, W - 28, 28, 3, 3, "F");
    doc.setDrawColor(249, 115, 22); doc.setLineWidth(0.5);
    doc.line(14, y, 14, y + 28);
    doc.setTextColor(249, 115, 22); doc.setFontSize(8); doc.setFont("helvetica", "bold");
    doc.text("WICHTIGER HINWEIS", 19, y + 7);
    doc.setTextColor(...gray(60)); doc.setFontSize(8); doc.setFont("helvetica", "normal");
    doc.text(`Anmeldezeitraum: ${monatsName(month)}`, 19, y + 13);
    doc.text(`Abgabefrist: ${fristUStVA(month)} (10. des Folgemonats)`, 19, y + 18);
    doc.text("Einreichung über ELSTER-Portal: www.elster.de", 19, y + 23);

    y += 35;

    // Unterschrift
    doc.setDrawColor(...gray(180)); doc.setLineWidth(0.3);
    doc.line(14, y + 15, 90, y + 15);
    doc.line(120, y + 15, W - 14, y + 15);
    doc.setTextColor(...gray(150)); doc.setFontSize(8);
    doc.text("Datum, Unterschrift", 14, y + 20);
    doc.text("Steuerberater-Stempel", 120, y + 20);

    // Footer
    doc.setFillColor(31, 41, 55);
    doc.rect(0, 282, W, 15, "F");
    doc.setTextColor(...gray(150)); doc.setFontSize(7);
    doc.text(`${restaurant?.name} · UStVA ${monatsName(month)} · Erstellt mit Restaurant-System`, W / 2, 290, { align: "center" });

    doc.save(`UStVA_${month}_${restaurant?.name?.replace(/\s+/g, "_")}.pdf`);
  }

  // ── PDF Export EÜR ──────────────────────────────────────────────────────────
  async function exportEUER_PDF() {
    const { default: jsPDF } = await import("jspdf");
    const doc = new jsPDF({ unit: "mm", format: "a4" });
    const W = 210;
    const gray = (v: number): [number, number, number] => [v, v, v];

    // Header
    doc.setFillColor(31, 41, 55);
    doc.rect(0, 0, W, 30, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(16); doc.setFont("helvetica", "bold");
    doc.text("Einnahmenüberschussrechnung (EÜR)", 14, 13);
    doc.setFontSize(10); doc.setFont("helvetica", "normal");
    doc.text(`Wirtschaftsjahr ${year} · ${restaurant?.name}`, 14, 22);
    doc.text(`Erstellt: ${new Date().toLocaleDateString("de-DE")}`, W - 14, 22, { align: "right" });

    let y = 38;
    const gray30 = gray(30);
    const gray150 = gray(150);

    const section = (title: string) => {
      doc.setFillColor(249, 115, 22);
      doc.rect(14, y, W - 28, 8, "F");
      doc.setTextColor(255, 255, 255); doc.setFontSize(9); doc.setFont("helvetica", "bold");
      doc.text(title, 19, y + 5.5);
      y += 8;
    };

    const row = (kz: string, label: string, value: string, isTotal = false, isNeg = false) => {
      if (isTotal) { doc.setFillColor(55, 65, 81); doc.rect(14, y, W - 28, 9, "F"); }
      else if ((y % 18) < 9) { doc.setFillColor(249, 250, 251); doc.rect(14, y, W - 28, 9, "F"); }
      doc.setTextColor(...(isTotal ? [255, 255, 255] as [number,number,number] : gray30));
      doc.setFontSize(isTotal ? 10 : 9);
      doc.setFont("helvetica", isTotal ? "bold" : "normal");
      doc.text(kz, 19, y + 6);
      doc.text(label, 50, y + 6);
      if (isNeg) doc.setTextColor(239, 68, 68);
      else if (isTotal) doc.setTextColor(255, 255, 255);
      doc.text(value + " €", W - 19, y + 6, { align: "right" });
      doc.setDrawColor(229, 231, 235); doc.setLineWidth(0.1);
      doc.line(14, y + 9, W - 14, y + 9);
      y += 9;
    };

    section("I. BETRIEBSEINNAHMEN");
    row("Kz 14", "Betriebseinnahmen (Bruttoumsatz)", fmt(yearRevenue));
    row("Kz 22", "Enthaltene Umsatzsteuer (19%)", fmt(yearRevenue - yearNetRev));
    row("",     "Nettoumsatz", fmt(yearNetRev), true);

    y += 4;
    section("II. BETRIEBSAUSGABEN");

    // Ausgaben nach Kategorie
    Object.entries(yearExpCat).sort(([,a],[,b]) => b-a).forEach(([cat, val]) => {
      const info = getEuerKz(cat);
      row(info.kz, info.label !== cat ? `${cat} (${info.label})` : cat, fmt(val));
    });

    // Personalkosten
    row("Kz 29", "Löhne und Gehälter (Personalkosten)", fmt(yearWages));
    const totalBA = yearExpenses + yearWages;
    row("", "Summe Betriebsausgaben", fmt(totalBA), true, false);

    y += 4;
    section("III. GEWINN / VERLUST");
    const gewinn = yearNetRev - (yearExpenses / 1.19) - yearWages; // Netto-Netto
    row("Kz 61", yearProfit >= 0 ? "Gewinn (§ 4 Abs. 3 EStG)" : "Verlust (§ 4 Abs. 3 EStG)", fmt(Math.abs(gewinn)), true, gewinn < 0);

    y += 12;

    // Quartalszahlen Tabelle
    doc.setFillColor(31, 41, 55);
    doc.rect(14, y, W - 28, 8, "F");
    doc.setTextColor(255, 255, 255); doc.setFontSize(9); doc.setFont("helvetica", "bold");
    doc.text("IV. QUARTALSZAHLEN", 19, y + 5.5);
    y += 8;

    const quarters = ["Q1 (Jan–Mär)", "Q2 (Apr–Jun)", "Q3 (Jul–Sep)", "Q4 (Okt–Dez)"];
    doc.setFontSize(8); doc.setFont("helvetica", "bold");
    doc.setTextColor(...gray30);
    doc.text("Quartal", 19, y + 5); doc.text("Umsatz", 90, y + 5); doc.text("Ausgaben", 135, y + 5); doc.text("Ergebnis", W - 19, y + 5, { align: "right" });
    doc.setLineWidth(0.3); doc.setDrawColor(229, 231, 235);
    doc.line(14, y + 8, W - 14, y + 8);
    y += 8;

    for (let q = 0; q < 4; q++) {
      const qMonths = yearData.slice(q * 3, q * 3 + 3);
      const qRev = qMonths.reduce((s, m) => s + Number(m.summary?.totalRevenue || 0), 0);
      const qExp = qMonths.reduce((s, m) => s + Number(m.summary?.totalExpenses || 0) + Number(m.summary?.totalWages || 0), 0);
      const qRes = qRev / 1.19 - qExp / 1.19;
      if (q % 2 === 0) { doc.setFillColor(249, 250, 251); doc.rect(14, y, W - 28, 8, "F"); }
      doc.setFont("helvetica", "normal"); doc.setFontSize(8.5);
      doc.setTextColor(...gray30);
      doc.text(quarters[q], 19, y + 5.5);
      doc.text(fmt(qRev) + " €", 90, y + 5.5);
      doc.text(fmt(qExp) + " €", 135, y + 5.5);
      doc.setTextColor(...(qRes >= 0 ? [22, 163, 74] as [number,number,number] : [239, 68, 68] as [number,number,number]));
      doc.text(fmt(qRes) + " €", W - 19, y + 5.5, { align: "right" });
      y += 8;
    }

    // Footer
    doc.setFillColor(31, 41, 55);
    doc.rect(0, 282, W, 15, "F");
    doc.setTextColor(...gray150); doc.setFontSize(7);
    doc.text(`${restaurant?.name} · EÜR ${year} · Erstellt mit Restaurant-System`, W / 2, 290, { align: "center" });

    doc.save(`EÜR_${year}_${restaurant?.name?.replace(/\s+/g, "_")}.pdf`);
  }

  // ── DATEV CSV Export ─────────────────────────────────────────────────────────
  function exportDATEV() {
    if (!data) return;
    const rows: string[][] = [
      ["EXTF", "700", "21", "Buchungsstapel", "1", "", "", "", "", ""],
      ["Buchungsjahr", String(year), "Buchungsmonat", month.split("-")[1], "Erstellt", new Date().toLocaleDateString("de-DE"), "", "", "", ""],
      [],
      ["Umsatz (ohne Soll/Haben-Kz)", "Soll/Haben-Kennzeichen", "WKZ", "Kurs", "Basis-Umsatz", "Basis-WKZ",
       "Konto", "Gegenkonto", "Belegdatum", "Buchungstext"],
    ];

    // Umsatz
    rows.push([
      fmt(netRevenue), "H", "EUR", "1,00", "", "", "8400", "1200",
      `${monthEnd(month).replace(/-/g, "")}`, `Umsatz ${monatsName(month)}`
    ]);

    // Ausgaben
    Object.entries(expensesCat).forEach(([cat, val]) => {
      const info = getEuerKz(cat);
      rows.push([
        fmt(Number(val)), "S", "EUR", "1,00", "", "", "4980", "1600",
        `${monthEnd(month).replace(/-/g, "")}`, `${cat} ${monatsName(month)}`
      ]);
    });

    // Löhne
    if (totalWages > 0) {
      rows.push([
        fmt(totalWages), "S", "EUR", "1,00", "", "", "4100", "1600",
        `${monthEnd(month).replace(/-/g, "")}`, `Löhne ${monatsName(month)}`
      ]);
    }

    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(";")).join("\r\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `DATEV_${month}_${restaurant?.name?.replace(/\s+/g, "_")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function sendEmail() {
    if (!data || !taxEmail) return;
    const subject = encodeURIComponent(`Monatsbuchhaltung ${monatsName(month)} – ${restaurant?.name}`);
    const body = encodeURIComponent(
      `Sehr geehrte/r Steuerberater/in,\n\nanbei die Buchhaltungsunterlagen für ${monatsName(month)}.\n\n` +
      `RESTAURANT: ${restaurant?.name}\nZEITRAUM: ${monatsName(month)}\n\n` +
      `=== UST-VORANMELDUNG (USt 1 A) ===\n` +
      `Kz 81  Nettoumsatz 19%:          ${fmt(kz81)} €\n` +
      `Kz 511 Umsatzsteuer 19%:         ${fmt(kz511)} €\n` +
      `Kz 66  Abziehbare Vorsteuer:     ${fmt(kz66)} €\n` +
      `Kz 83  USt-Zahllast:             ${fmt(kz83)} €\n` +
      `       Fälligkeit:               ${fristUStVA(month)}\n\n` +
      `=== EÜR ÜBERSICHT ===\n` +
      `Brutto-Umsatz:    ${fmt(totalRevenue)} €\n` +
      `Netto-Umsatz:     ${fmt(netRevenue)} €\n` +
      `Betriebsausgaben: ${fmt(totalExpenses)} €\n` +
      `Personalkosten:   ${fmt(totalWages)} €\n` +
      `Netto-Gewinn:     ${fmt(profit)} €\n\n` +
      `Die DATEV-kompatible CSV-Datei und die PDF-Formulare können separat heruntergeladen werden.\n\n` +
      `Mit freundlichen Grüßen\n${restaurant?.name}`
    );
    window.open(`mailto:${taxEmail}?subject=${subject}&body=${body}`);
  }

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold text-white">Steuer & Finanzamt</h2>
          <p className="text-gray-400 text-sm mt-1">Offizielle Formulare · DATEV-Export · Steuerberater-Versand</p>
        </div>
      </div>

      {/* Steuerberater E-Mail */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 flex items-center gap-4">
        <Mail size={18} className="text-blue-400 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-gray-400 text-xs mb-0.5">Steuerberater E-Mail</p>
          {editEmail ? (
            <div className="flex items-center gap-2">
              <input autoFocus type="email" value={emailInput} onChange={e => setEmailInput(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") { setTaxEmail(emailInput); localStorage.setItem("taxAdvisorEmail", emailInput); setEditEmail(false); } if (e.key === "Escape") setEditEmail(false); }}
                placeholder="steuerberater@kanzlei.de"
                className="flex-1 bg-gray-800 border border-orange-500 rounded-lg px-3 py-1.5 text-white text-sm focus:outline-none" />
              <button onClick={() => { setTaxEmail(emailInput); localStorage.setItem("taxAdvisorEmail", emailInput); setEditEmail(false); }} className="text-green-400 hover:text-green-300"><Check size={16} /></button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <p className="text-white text-sm font-medium">{taxEmail || <span className="text-gray-500 italic text-xs">Noch nicht hinterlegt</span>}</p>
              <button onClick={() => { setEmailInput(taxEmail); setEditEmail(true); }} className="text-gray-500 hover:text-orange-400"><Pencil size={13} /></button>
            </div>
          )}
        </div>
        <button onClick={sendEmail} disabled={!taxEmail || !data}
          className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white px-3 py-2 rounded-xl text-xs font-medium transition-colors shrink-0">
          <Mail size={14} /> Senden
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 bg-gray-900 border border-gray-800 rounded-2xl p-1.5">
        {([["ustva", "USt-Voranmeldung"], ["euer", "EÜR (Jahresabschluss)"], ["bwa", "BWA"]] as const).map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)}
            className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-all ${tab === k ? "bg-orange-500 text-white shadow-lg" : "text-gray-400 hover:text-white"}`}>
            {l}
          </button>
        ))}
      </div>

      {/* ── TAB: UStVA ─────────────────────────────────────────────────────────── */}
      {tab === "ustva" && (
        <div className="space-y-4">
          {/* Monatsnavigation */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <button onClick={() => setMonth(m => changeMonth(m, -1))} className="w-9 h-9 bg-gray-800 hover:bg-gray-700 rounded-xl text-white flex items-center justify-center transition-colors">
                <ChevronLeft size={16} />
              </button>
              <input type="month" value={month} onChange={e => setMonth(e.target.value)} max={currentMonth()}
                className="bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-orange-500" />
              <button onClick={() => setMonth(m => changeMonth(m, 1))} disabled={month >= currentMonth()} className="w-9 h-9 bg-gray-800 hover:bg-gray-700 disabled:opacity-30 rounded-xl text-white flex items-center justify-center transition-colors">
                <ChevronRight size={16} />
              </button>
              <button onClick={load} className="w-9 h-9 bg-gray-800 hover:bg-gray-700 rounded-xl flex items-center justify-center transition-colors">
                <RefreshCw size={15} className="text-white" />
              </button>
            </div>
            <div className="flex gap-2">
              <button onClick={exportUStVA_PDF} className="flex items-center gap-1.5 bg-orange-500 hover:bg-orange-600 text-white px-3 py-2 rounded-xl text-xs font-medium transition-colors">
                <Printer size={14} /> PDF (USt 1 A)
              </button>
              <button onClick={exportDATEV} className="flex items-center gap-1.5 bg-gray-800 hover:bg-gray-700 border border-gray-700 text-white px-3 py-2 rounded-xl text-xs font-medium transition-colors">
                <Download size={14} /> DATEV CSV
              </button>
            </div>
          </div>

          {/* Fälligkeitshinweis */}
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 flex items-start gap-3">
            <AlertCircle size={18} className="text-amber-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-amber-400 font-semibold text-sm">Abgabefrist: {fristUStVA(month)}</p>
              <p className="text-gray-300 text-sm mt-0.5">
                USt-Voranmeldung für {monatsName(month)} über <strong className="text-white">ELSTER</strong> einreichen.
                {vatPayable > 0 && <> Zahllast: <strong className="text-orange-400">{fmtE(vatPayable)}</strong></>}
              </p>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center h-32"><RefreshCw className="animate-spin text-orange-400" /></div>
          ) : (
            <>
              {/* Offizielles UStVA-Formular */}
              <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
                <div className="bg-gray-800 px-5 py-3 border-b border-gray-700">
                  <p className="text-white font-bold text-sm">Umsatzsteuer-Voranmeldung · {monatsName(month)}</p>
                  <p className="text-gray-400 text-xs">Formular USt 1 A – automatisch berechnet</p>
                </div>

                {/* Abschnitt A */}
                <div className="px-0">
                  <div className="bg-gray-800/60 px-5 py-2.5">
                    <p className="text-orange-400 text-xs font-bold uppercase tracking-wider">A. Steuerpflichtige Umsätze</p>
                  </div>
                  <KzRow kz="Kz 81" label="Lieferungen und sonstige Leistungen 19 % (Nettobetrag)" value={fmt(kz81)} />
                  <KzRow kz="Kz 511" label="Steuer aus Kz 81 (19 %)" value={fmt(kz511)} bold />

                  {/* Abschnitt B */}
                  <div className="bg-gray-800/60 px-5 py-2.5 border-t border-gray-700">
                    <p className="text-blue-400 text-xs font-bold uppercase tracking-wider">B. Abziehbare Vorsteuerbeträge (§ 15 UStG)</p>
                  </div>
                  <KzRow kz="Kz 66" label="Vorsteuer aus Eingangsrechnungen (§ 15 Abs. 1 Nr. 1 UStG)" value={fmt(kz66)} />

                  {/* Abschnitt C */}
                  <div className="bg-gray-800/60 px-5 py-2.5 border-t border-gray-700">
                    <p className={`text-xs font-bold uppercase tracking-wider ${vatPayable >= 0 ? "text-red-400" : "text-green-400"}`}>
                      C. Verbleibende Umsatzsteuer-Vorauszahlung
                    </p>
                  </div>
                  <KzRow kz="Kz 83"
                    label={vatPayable >= 0 ? "Umsatzsteuer-Vorauszahlung (ans Finanzamt)" : "Überschuss (Erstattung vom Finanzamt)"}
                    value={fmt(Math.abs(kz83))} bold highlight />
                </div>
              </div>

              {/* ELSTER Hinweis */}
              <div className="bg-blue-500/10 border border-blue-500/20 rounded-2xl p-4">
                <p className="text-blue-300 text-sm font-semibold mb-2">So reichst du die UStVA ein:</p>
                <ol className="text-gray-400 text-sm space-y-1.5 list-decimal list-inside">
                  <li>Gehe zu <a href="https://www.elster.de" target="_blank" className="text-blue-400 underline">elster.de</a> und melde dich an</li>
                  <li>Formulare → Umsatzsteuer-Voranmeldung → {monatsName(month)}</li>
                  <li>Trage die Kennzahlen aus diesem Formular ein (Kz 81, 511, 66, 83)</li>
                  <li>Absenden — fertig. Frist: <strong className="text-white">{fristUStVA(month)}</strong></li>
                </ol>
                <p className="text-gray-600 text-xs mt-3">Alternativ: PDF herunterladen und an deinen Steuerberater schicken.</p>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── TAB: EÜR ───────────────────────────────────────────────────────────── */}
      {tab === "euer" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <button onClick={() => setYear(y => y - 1)} className="w-9 h-9 bg-gray-800 hover:bg-gray-700 rounded-xl text-white flex items-center justify-center"><ChevronLeft size={16} /></button>
              <span className="text-white font-bold text-lg px-2">{year}</span>
              <button onClick={() => setYear(y => y + 1)} disabled={year >= currentYear()} className="w-9 h-9 bg-gray-800 hover:bg-gray-700 disabled:opacity-30 rounded-xl text-white flex items-center justify-center"><ChevronRight size={16} /></button>
            </div>
            <button onClick={exportEUER_PDF} className="flex items-center gap-1.5 bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors">
              <Printer size={15} /> PDF EÜR {year}
            </button>
          </div>

          {/* EÜR Formular */}
          <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
            <div className="bg-gray-800 px-5 py-3 border-b border-gray-700">
              <p className="text-white font-bold text-sm">Einnahmenüberschussrechnung (Anlage EÜR) · {year}</p>
              <p className="text-gray-400 text-xs">Gewinnermittlung nach § 4 Abs. 3 EStG</p>
            </div>

            {/* I. Betriebseinnahmen */}
            <div className="bg-gray-800/60 px-5 py-2.5">
              <p className="text-green-400 text-xs font-bold uppercase tracking-wider">I. Betriebseinnahmen</p>
            </div>
            <KzRow kz="Kz 14" label="Betriebseinnahmen (Bruttoumsatz inkl. USt)" value={fmt(yearRevenue)} />
            <KzRow kz=""      label="abzügl. enthaltene Umsatzsteuer (19%)" value={`– ${fmt(yearRevenue - yearNetRev)}`} />
            <KzRow kz="Kz 22" label="Nettoumsatz (Betriebseinnahmen ohne USt)" value={fmt(yearNetRev)} bold />

            {/* II. Betriebsausgaben */}
            <div className="bg-gray-800/60 px-5 py-2.5 border-t border-gray-700">
              <p className="text-red-400 text-xs font-bold uppercase tracking-wider">II. Betriebsausgaben</p>
            </div>
            {Object.entries(yearExpCat).sort(([,a],[,b]) => b-a).map(([cat, val]) => {
              const info = getEuerKz(cat);
              return <KzRow key={cat} kz={info.kz} label={cat} value={fmt(val)} />;
            })}
            <KzRow kz="Kz 29" label="Löhne und Gehälter (Personalkosten)" value={fmt(yearWages)} />
            <KzRow kz="" label="Summe Betriebsausgaben" value={fmt(yearExpenses + yearWages)} bold />

            {/* III. Gewinn */}
            <div className={`bg-gray-800/60 px-5 py-2.5 border-t border-gray-700`}>
              <p className={`text-xs font-bold uppercase tracking-wider ${yearProfit >= 0 ? "text-green-400" : "text-red-400"}`}>III. Gewinn / Verlust</p>
            </div>
            <KzRow
              kz="Kz 61"
              label={yearProfit >= 0 ? "Gewinn (§ 4 Abs. 3 EStG)" : "Verlust (§ 4 Abs. 3 EStG)"}
              value={fmt(Math.abs(yearProfit))}
              bold highlight
            />
          </div>

          <div className="bg-yellow-500/5 border border-yellow-500/20 rounded-xl px-4 py-3">
            <p className="text-yellow-400 text-xs">
              ⚠️ Die EÜR wird jährlich mit der Einkommensteuererklärung eingereicht. Abgabefrist: <strong>31. Juli</strong> des Folgejahres (mit Steuerberater: 28. Februar des übernächsten Jahres).
            </p>
          </div>
        </div>
      )}

      {/* ── TAB: BWA ───────────────────────────────────────────────────────────── */}
      {tab === "bwa" && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <button onClick={() => setYear(y => y - 1)} className="w-9 h-9 bg-gray-800 hover:bg-gray-700 rounded-xl text-white flex items-center justify-center"><ChevronLeft size={16} /></button>
            <span className="text-white font-bold text-lg px-2">BWA {year}</span>
            <button onClick={() => setYear(y => y + 1)} disabled={year >= currentYear()} className="w-9 h-9 bg-gray-800 hover:bg-gray-700 disabled:opacity-30 rounded-xl text-white flex items-center justify-center"><ChevronRight size={16} /></button>
          </div>

          <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
            <div className="bg-gray-800 px-5 py-3 border-b border-gray-700">
              <p className="text-white font-bold text-sm">Betriebswirtschaftliche Auswertung · {year}</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs min-w-[640px]">
                <thead>
                  <tr className="border-b border-gray-700 bg-gray-800/50">
                    <th className="px-4 py-3 text-left text-gray-400 font-medium">Monat</th>
                    <th className="px-3 py-3 text-right text-gray-400 font-medium">Umsatz</th>
                    <th className="px-3 py-3 text-right text-gray-400 font-medium">Ausgaben</th>
                    <th className="px-3 py-3 text-right text-gray-400 font-medium">Personal</th>
                    <th className="px-3 py-3 text-right text-gray-400 font-medium">Ergebnis</th>
                    <th className="px-3 py-3 text-right text-gray-400 font-medium">Marge</th>
                  </tr>
                </thead>
                <tbody>
                  {yearData.map((md, i) => {
                    const rev  = Number(md.summary?.totalRevenue  || 0);
                    const exp  = Number(md.summary?.totalExpenses || 0);
                    const wage = Number(md.summary?.totalWages    || 0);
                    const net  = Number(md.summary?.netRevenue    || 0);
                    const res  = Number(md.summary?.profit        || 0);
                    const marge = net > 0 ? ((res / net) * 100) : 0;
                    const [, m] = md.month.split("-").map(Number);
                    const mName = new Date(year, m - 1, 1).toLocaleDateString("de-DE", { month: "short" });
                    return (
                      <tr key={md.month} className={`border-b border-gray-800/50 hover:bg-gray-800/30 ${i % 2 === 0 ? "bg-gray-900" : "bg-gray-800/20"}`}>
                        <td className="px-4 py-2.5 text-gray-300 font-medium">{mName}</td>
                        <td className="px-3 py-2.5 text-right text-green-400 font-mono">{rev > 0 ? fmt(rev) : "–"}</td>
                        <td className="px-3 py-2.5 text-right text-red-400 font-mono">{exp > 0 ? fmt(exp) : "–"}</td>
                        <td className="px-3 py-2.5 text-right text-orange-400 font-mono">{wage > 0 ? fmt(wage) : "–"}</td>
                        <td className={`px-3 py-2.5 text-right font-mono font-semibold ${res > 0 ? "text-green-400" : res < 0 ? "text-red-400" : "text-gray-600"}`}>
                          {rev > 0 ? (res >= 0 ? "+" : "") + fmt(res) : "–"}
                        </td>
                        <td className={`px-3 py-2.5 text-right font-mono ${marge >= 15 ? "text-green-400" : marge >= 5 ? "text-yellow-400" : marge < 0 ? "text-red-400" : "text-gray-500"}`}>
                          {rev > 0 ? marge.toFixed(1) + "%" : "–"}
                        </td>
                      </tr>
                    );
                  })}
                  {/* Jahressumme */}
                  <tr className="bg-gray-700/50 border-t-2 border-gray-600 font-bold">
                    <td className="px-4 py-3 text-white">Gesamt {year}</td>
                    <td className="px-3 py-3 text-right text-green-400 font-mono">{fmt(yearRevenue)}</td>
                    <td className="px-3 py-3 text-right text-red-400 font-mono">{fmt(yearExpenses)}</td>
                    <td className="px-3 py-3 text-right text-orange-400 font-mono">{fmt(yearWages)}</td>
                    <td className={`px-3 py-3 text-right font-mono ${yearProfit >= 0 ? "text-green-400" : "text-red-400"}`}>{(yearProfit >= 0 ? "+" : "") + fmt(yearProfit)}</td>
                    <td className="px-3 py-3 text-right text-gray-400 font-mono">
                      {yearNetRev > 0 ? ((yearProfit / yearNetRev) * 100).toFixed(1) + "%" : "–"}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
