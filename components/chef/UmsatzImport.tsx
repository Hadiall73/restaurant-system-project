"use client";
import { useState, useRef } from "react";
import { useStore } from "@/lib/store";
import { supabase } from "@/lib/supabase";
import { Upload, FileText, CheckCircle, AlertCircle, X, ChevronDown, Search } from "lucide-react";
import toast from "react-hot-toast";

// ─── Kassensystem-Profile ────────────────────────────────────────────────────
type PosProfile = {
  name: string;
  logo: string;
  color: string;
  hint: string;
  steps: string[];
  colMap: Record<string, string[]>;
};

const POS_SYSTEMS: Record<string, PosProfile> = {
  gastware: {
    name: "Gastware",
    logo: "GW",
    color: "bg-blue-500",
    hint: "Weit verbreitet in deutschen Restaurants",
    steps: [
      "Gastware öffnen → Auswertungen / Berichte",
      "Zeitraum auswählen (z.B. letzter Monat)",
      "Export als CSV oder TXT",
      "Datei hier hochladen",
    ],
    colMap: {
      date:           ["datum", "belegdatum", "buchungsdatum", "tag", "date"],
      amount:         ["betrag", "umsatz", "bruttobetrag", "gesamt", "summe", "total"],
      payment_method: ["zahlungsart", "zahlungsmittel", "zahlung", "kasse"],
      table_number:   ["tisch", "tischnr", "tischnummer", "raum"],
      tip:            ["trinkgeld", "trinkgelder"],
      notes:          ["notiz", "hinweis", "bemerkung", "beschreibung"],
    },
  },
  vectron: {
    name: "Vectron",
    logo: "VC",
    color: "bg-red-500",
    hint: "Sehr beliebt in Gastronomie & Bäckereien",
    steps: [
      "Vectron Commander / POS öffnen",
      "Berichte → Tagesbericht oder Umsatzbericht",
      "Zeitraum einstellen",
      "Exportieren als CSV (Trennzeichen: Semikolon)",
      "Datei hier hochladen",
    ],
    colMap: {
      date:           ["datum", "buchungsdatum", "belegdatum", "date", "tag", "geschäftstag"],
      amount:         ["umsatz", "brutto", "betrag", "gesamtbetrag", "summe", "total", "netto"],
      payment_method: ["zahlart", "zahlungsart", "zahlmittel", "zahlung", "bezahlart"],
      table_number:   ["tisch", "tischnummer", "bon", "bonnummer"],
      tip:            ["trinkgeld", "tip", "zuschlag"],
      notes:          ["text", "info", "kommentar", "artikel", "bemerkung"],
    },
  },
  orderbird: {
    name: "orderbird",
    logo: "OB",
    color: "bg-green-500",
    hint: "iPad-Kassensystem für Restaurants",
    steps: [
      "orderbird Back Office öffnen (app.orderbird.com)",
      "Berichte → Verkaufsberichte",
      "Zeitraum filtern",
      "Als CSV exportieren",
      "Datei hier hochladen",
    ],
    colMap: {
      date:           ["date", "datum", "created_at", "transaction_date", "verkaufsdatum"],
      amount:         ["total", "amount", "revenue", "gross_total", "betrag", "umsatz", "gesamtbetrag"],
      payment_method: ["payment_method", "payment_type", "zahlungsart", "payment"],
      table_number:   ["table", "table_number", "tisch", "table_name"],
      tip:            ["tip", "gratuity", "trinkgeld"],
      notes:          ["note", "comment", "description", "notiz"],
    },
  },
  ready2order: {
    name: "ready2order",
    logo: "R2O",
    color: "bg-purple-500",
    hint: "Österreichisches POS-System, in Deutschland weit verbreitet",
    steps: [
      "ready2order Dashboard öffnen (app.ready2order.com)",
      "Berichte → Umsatzberichte",
      "Datum auswählen",
      "Export → CSV herunterladen",
      "Datei hier hochladen",
    ],
    colMap: {
      date:           ["datum", "date", "buchungsdatum", "rechnungsdatum", "created"],
      amount:         ["gesamtbetrag", "betrag", "total", "brutto", "umsatz", "summe"],
      payment_method: ["zahlungsmethode", "zahlungsart", "payment_method", "bezahlmethode"],
      table_number:   ["tisch", "tischnummer", "table", "table_id"],
      tip:            ["trinkgeld", "tip"],
      notes:          ["notiz", "kommentar", "note", "anmerkung"],
    },
  },
  lightspeed: {
    name: "Lightspeed (Gastrofix)",
    logo: "LS",
    color: "bg-cyan-500",
    hint: "Ehemals Gastrofix – cloud-basiertes POS-System",
    steps: [
      "Lightspeed Restaurant öffnen",
      "Berichte → Umsatz",
      "Filter: Zeitraum einstellen",
      "Exportieren → CSV",
      "Datei hier hochladen",
    ],
    colMap: {
      date:           ["date", "business_date", "receipt_date", "created_at", "datum"],
      amount:         ["total", "net_total", "gross_total", "revenue", "amount", "sales_total"],
      payment_method: ["payment_type", "tender", "payment_method", "zahlungsart"],
      table_number:   ["table_number", "table", "cover", "tisch"],
      tip:            ["tip", "gratuity", "tip_amount"],
      notes:          ["note", "description", "server", "kellner"],
    },
  },
  sumup: {
    name: "SumUp",
    logo: "SU",
    color: "bg-orange-500",
    hint: "Kartenlesegerät & POS-App",
    steps: [
      "SumUp Dashboard öffnen (me.sumup.com)",
      "Transaktionen → Alle Transaktionen",
      "Zeitraum auswählen",
      "CSV exportieren",
      "Datei hier hochladen",
    ],
    colMap: {
      date:           ["datum", "date", "transaktionsdatum", "transaction_date", "erstellt", "created_at"],
      amount:         ["betrag", "amount", "total", "verkaufspreis", "gesamtbetrag", "umsatz"],
      payment_method: ["zahlungsart", "payment_type", "type", "transaktionstyp"],
      table_number:   ["beschreibung", "description", "referenz", "reference"],
      tip:            ["trinkgeld", "tip"],
      notes:          ["beschreibung", "description", "notiz", "bemerkung"],
    },
  },
  zettle: {
    name: "Zettle (PayPal)",
    logo: "ZT",
    color: "bg-blue-400",
    hint: "Ehemals iZettle – von PayPal übernommen",
    steps: [
      "Zettle Dashboard öffnen (my.zettle.com)",
      "Berichte → Zahlungen oder Verkäufe",
      "Datumsbereich auswählen",
      "CSV herunterladen",
      "Datei hier hochladen",
    ],
    colMap: {
      date:           ["datum", "date", "zahlungsdatum", "payment_date", "time"],
      amount:         ["betrag", "amount", "total", "verkaufssumme", "gesamtbetrag"],
      payment_method: ["zahlungsmethode", "payment_method", "type", "kartenmarke"],
      table_number:   ["beschreibung", "description", "referenznummer"],
      tip:            ["trinkgeld", "tip", "gratuity"],
      notes:          ["notiz", "note", "produkt", "product"],
    },
  },
  square: {
    name: "Square",
    logo: "SQ",
    color: "bg-gray-600",
    hint: "US-amerikanisches POS-System",
    steps: [
      "Square Dashboard öffnen (squareup.com)",
      "Berichte → Transaktionen",
      "Datum filtern",
      "Exportieren als CSV",
      "Datei hier hochladen",
    ],
    colMap: {
      date:           ["date", "created_at", "transaction_date", "local_date"],
      amount:         ["total_collected", "net_total", "gross_sales", "total", "amount"],
      payment_method: ["payment_type", "tender_type", "card_brand"],
      table_number:   ["location", "description", "item_name"],
      tip:            ["tip_amount", "tip"],
      notes:          ["description", "note", "item_name", "location_name"],
    },
  },
  korona: {
    name: "KORONA POS",
    logo: "KO",
    color: "bg-yellow-500",
    hint: "Deutsches Cloud-POS-System",
    steps: [
      "KORONA Office öffnen (office.retailcloud.de)",
      "Berichte → Kassenumsätze",
      "Zeitraum einstellen",
      "Exportieren als CSV",
      "Datei hier hochladen",
    ],
    colMap: {
      date:           ["buchungsdatum", "datum", "date", "belegdatum", "kassendatum"],
      amount:         ["umsatz", "betrag", "gesamtbetrag", "bruttobetrag", "total"],
      payment_method: ["zahlungsart", "zahlmittel", "bezahlung", "payment"],
      table_number:   ["kassennummer", "kasse", "bon", "bonnr"],
      tip:            ["trinkgeld"],
      notes:          ["kassenbeschreibung", "bemerkung", "notiz"],
    },
  },
  gastronovi: {
    name: "Gastronovi",
    logo: "GN",
    color: "bg-indigo-500",
    hint: "Deutsches Restaurant-Managementsystem",
    steps: [
      "Gastronovi Office öffnen",
      "Controlling → Umsatzberichte",
      "Zeitraum und Filter einstellen",
      "CSV exportieren",
      "Datei hier hochladen",
    ],
    colMap: {
      date:           ["datum", "buchungsdatum", "rechnungsdatum", "belegdatum"],
      amount:         ["bruttoumsatz", "umsatz", "betrag", "gesamtbetrag", "summe"],
      payment_method: ["zahlungsart", "zahlungsmittel", "payment"],
      table_number:   ["tisch", "tischnr", "bereich"],
      tip:            ["trinkgeld"],
      notes:          ["anmerkung", "notiz", "beschreibung"],
    },
  },
  lina: {
    name: "Lina-Kasse",
    logo: "LK",
    color: "bg-pink-500",
    hint: "Deutsche Kassensoftware für Gastronomie",
    steps: [
      "Lina Kassensoftware öffnen",
      "Auswertungen → Tages- oder Monatsberichte",
      "Zeitraum auswählen",
      "Export als CSV",
      "Datei hier hochladen",
    ],
    colMap: {
      date:           ["datum", "belegdatum", "buchungsdatum", "tag"],
      amount:         ["betrag", "umsatz", "summe", "brutto", "gesamt"],
      payment_method: ["zahlart", "zahlungsart", "zahlung"],
      table_number:   ["tisch", "tischnummer", "bon"],
      tip:            ["trinkgeld"],
      notes:          ["text", "notiz", "bemerkung"],
    },
  },
  micros: {
    name: "Oracle MICROS",
    logo: "MC",
    color: "bg-red-700",
    hint: "Enterprise POS-System (Simphony / 3700)",
    steps: [
      "MICROS RES / Simphony öffnen",
      "Manager Reports → Revenue Report",
      "Zeitraum einstellen",
      "Export als CSV oder TXT",
      "Datei hier hochladen",
    ],
    colMap: {
      date:           ["business_date", "date", "check_date", "transaction_date"],
      amount:         ["net_sales", "gross_sales", "total", "check_total", "revenue"],
      payment_method: ["tender_media", "payment_type", "payment", "media_type"],
      table_number:   ["table_num", "table_number", "check_number", "table"],
      tip:            ["tip", "gratuity"],
      notes:          ["server", "employee", "revenue_center", "description"],
    },
  },
  sides: {
    name: "SIDES (Lieferando POS)",
    logo: "SI",
    color: "bg-orange-600",
    hint: "Restaurant-POS von Lieferando",
    steps: [
      "SIDES Dashboard öffnen",
      "Berichte → Umsatzberichte",
      "Zeitraum filtern",
      "Als CSV exportieren",
      "Datei hier hochladen",
    ],
    colMap: {
      date:           ["date", "order_date", "created_at", "datum"],
      amount:         ["total", "order_total", "revenue", "amount", "umsatz"],
      payment_method: ["payment_method", "payment_type", "zahlungsart"],
      table_number:   ["table", "table_number", "tisch"],
      tip:            ["tip", "trinkgeld"],
      notes:          ["note", "channel", "platform", "quelle"],
    },
  },
  other: {
    name: "Anderes System / Manuell",
    logo: "??",
    color: "bg-gray-500",
    hint: "Universeller Import – Spalten manuell zuordnen",
    steps: [
      "CSV oder TXT-Datei aus deinem Kassensystem exportieren",
      "Achte auf: Datum, Betrag, Zahlungsart",
      "Datei hier hochladen",
      "Spalten manuell zuordnen",
    ],
    colMap: {
      date:           ["datum", "date", "belegdatum", "buchungsdatum", "tag", "created_at", "transaction_date", "business_date"],
      amount:         ["betrag", "umsatz", "bruttobetrag", "nettobetrag", "gesamt", "summe", "total", "amount", "revenue", "gross_sales", "net_sales"],
      payment_method: ["zahlungsart", "zahlungsmittel", "zahlung", "payment", "kasse", "bezahlung", "payment_method", "payment_type", "tender"],
      table_number:   ["tisch", "tischnr", "tischnummer", "table", "raum", "table_number"],
      tip:            ["trinkgeld", "tip", "trinkgelder", "gratuity", "tip_amount"],
      notes:          ["notiz", "hinweis", "bemerkung", "note", "beschreibung", "description", "comment"],
    },
  },
};

// ─── CSV-Parser ───────────────────────────────────────────────────────────────
function parseCSV(text: string): { headers: string[]; rows: string[][] } {
  const firstLine = text.split("\n")[0];
  const sep = firstLine.includes(";") ? ";" : firstLine.includes("\t") ? "\t" : ",";
  const lines = text.split("\n").filter(l => l.trim());
  const headers = lines[0].split(sep).map(h => h.replace(/"/g, "").trim());
  const rows = lines.slice(1).map(l =>
    l.split(sep).map(c => c.replace(/"/g, "").trim())
  ).filter(r => r.some(c => c));
  return { headers, rows };
}

function detectColumn(headers: string[], colMap: Record<string, string[]>, field: string): number {
  const candidates = colMap[field] || [];
  for (const h of headers) {
    const clean = h.toLowerCase().trim().replace(/[^a-zäöüß0-9]/g, "");
    for (const c of candidates) {
      if (clean.includes(c.replace(/[^a-zäöüß0-9]/g, ""))) return headers.indexOf(h);
    }
  }
  return -1;
}

function parseAmount(str: string): number {
  if (!str) return 0;
  const clean = str.replace(/[€$£\s]/g, "").replace(/\.(?=\d{3}[,.])/g, "").replace(",", ".");
  return parseFloat(clean) || 0;
}

function parseDate(str: string): string | null {
  if (!str) return null;
  // DD.MM.YYYY oder DD.MM.YY
  const de = str.match(/^(\d{1,2})\.(\d{1,2})\.(\d{2,4})/);
  if (de) {
    let y = parseInt(de[3]);
    if (y < 100) y += 2000;
    return `${y}-${String(parseInt(de[2])).padStart(2,"0")}-${String(parseInt(de[1])).padStart(2,"0")}`;
  }
  // ISO YYYY-MM-DD
  const iso = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  // MM/DD/YYYY (Square)
  const us = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (us) return `${us[3]}-${String(parseInt(us[1])).padStart(2,"0")}-${String(parseInt(us[2])).padStart(2,"0")}`;
  return null;
}

type Mapping = { date: number; amount: number; payment_method: number; table_number: number; tip: number; notes: number };

const FIELD_LABELS: Record<string, string> = {
  date: "Datum *", amount: "Betrag *", payment_method: "Zahlungsart",
  table_number: "Tischnummer", tip: "Trinkgeld", notes: "Notiz",
};

// ─── Hauptkomponente ──────────────────────────────────────────────────────────
export default function UmsatzImport() {
  const { restaurant, profile } = useStore();
  const fileRef = useRef<HTMLInputElement>(null);
  const [selectedPos, setSelectedPos] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [step, setStep] = useState<"select" | "upload" | "map" | "done">("select");
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows]       = useState<string[][]>([]);
  const [mapping, setMapping] = useState<Mapping>({ date:-1, amount:-1, payment_method:-1, table_number:-1, tip:-1, notes:-1 });
  const [importing, setImporting] = useState(false);
  const [result, setResult]   = useState<{ ok: number; skip: number; errors: string[] } | null>(null);
  const [fileName, setFileName] = useState("");

  const posKeys = Object.keys(POS_SYSTEMS).filter(k =>
    !search || POS_SYSTEMS[k].name.toLowerCase().includes(search.toLowerCase())
  );

  function selectPos(key: string) {
    setSelectedPos(key);
    setStep("upload");
  }

  function handleFile(file: File) {
    if (!file || !selectedPos) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      try {
        const { headers: h, rows: r } = parseCSV(text);
        setHeaders(h);
        setRows(r);
        const colMap = POS_SYSTEMS[selectedPos].colMap;
        const m: Mapping = {
          date:           detectColumn(h, colMap, "date"),
          amount:         detectColumn(h, colMap, "amount"),
          payment_method: detectColumn(h, colMap, "payment_method"),
          table_number:   detectColumn(h, colMap, "table_number"),
          tip:            detectColumn(h, colMap, "tip"),
          notes:          detectColumn(h, colMap, "notes"),
        };
        setMapping(m);
        setStep("map");
      } catch {
        toast.error("Datei konnte nicht gelesen werden");
      }
    };
    reader.readAsText(file, "utf-8");
  }

  async function doImport() {
    if (!restaurant || !profile || !selectedPos) return;
    if (mapping.date === -1 || mapping.amount === -1) {
      toast.error("Datum und Betrag müssen zugeordnet sein");
      return;
    }
    setImporting(true);
    let ok = 0, skip = 0;
    const errors: string[] = [];

    for (const row of rows) {
      const rawDate   = row[mapping.date] || "";
      const rawAmount = row[mapping.amount] || "";
      const date      = parseDate(rawDate);
      const amount    = parseAmount(rawAmount);

      if (!date || amount <= 0) {
        skip++;
        if (!date) errors.push(`Ungültiges Datum: "${rawDate}"`);
        continue;
      }

      const payRaw = mapping.payment_method >= 0 ? (row[mapping.payment_method] || "").toLowerCase() : "";
      const payment_method =
        payRaw.includes("bar") || payRaw.includes("cash") || payRaw.includes("bargeld") ? "cash" :
        payRaw.includes("karte") || payRaw.includes("card") || payRaw.includes("ec") ||
        payRaw.includes("visa") || payRaw.includes("master") || payRaw.includes("kredit") ? "card" : "card";

      const tip = mapping.tip >= 0 ? parseAmount(row[mapping.tip] || "0") : 0;
      const table_number = mapping.table_number >= 0 ? (parseInt(row[mapping.table_number]) || null) : null;
      const posName = POS_SYSTEMS[selectedPos].name;
      const notes = mapping.notes >= 0 ? (row[mapping.notes] || posName + " Import") : posName + " Import";

      const { error } = await supabase.from("sales").insert({
        restaurant_id: restaurant.id,
        amount,
        tip: tip || 0,
        payment_method,
        table_number,
        notes: notes || posName + " Import",
        recorded_at: new Date(date + "T12:00:00").toISOString(),
        recorded_by: profile.id,
      });

      if (error) { skip++; errors.push(`Fehler bei ${rawDate}: ${error.message}`); }
      else ok++;
    }

    setResult({ ok, skip, errors });
    setStep("done");
    setImporting(false);
    if (ok > 0) toast.success(`${ok} Umsätze aus ${POS_SYSTEMS[selectedPos].name} importiert!`);
  }

  function reset() {
    setStep("select");
    setSelectedPos(null);
    setHeaders([]);
    setRows([]);
    setResult(null);
    setFileName("");
    setSearch("");
    if (fileRef.current) fileRef.current.value = "";
  }

  const pos = selectedPos ? POS_SYSTEMS[selectedPos] : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Kassensystem Import</h2>
          <p className="text-gray-400 text-sm mt-1">
            Umsätze aus deinem Kassensystem importieren — {Object.keys(POS_SYSTEMS).length - 1} Systeme unterstützt
          </p>
        </div>
        {step !== "select" && (
          <button onClick={reset} className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm rounded-xl transition-colors flex items-center gap-2">
            <X size={14} /> Neu starten
          </button>
        )}
      </div>

      {/* Schritt-Indikator */}
      <div className="flex items-center gap-2 text-xs">
        {["System wählen", "Datei hochladen", "Spalten prüfen", "Fertig"].map((s, i) => {
          const stepIdx = step === "select" ? 0 : step === "upload" ? 1 : step === "map" ? 2 : 3;
          return (
            <div key={s} className="flex items-center gap-2">
              <div className={`w-5 h-5 rounded-full flex items-center justify-center font-bold text-xs ${i <= stepIdx ? "bg-orange-500 text-white" : "bg-gray-800 text-gray-500"}`}>{i + 1}</div>
              <span className={i <= stepIdx ? "text-white" : "text-gray-500"}>{s}</span>
              {i < 3 && <span className="text-gray-700">›</span>}
            </div>
          );
        })}
      </div>

      {/* ── Schritt 1: Kassensystem auswählen ───────────────────────────────── */}
      {step === "select" && (
        <div className="space-y-4">
          {/* Suche */}
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Kassensystem suchen..."
              className="w-full bg-gray-900 border border-gray-800 rounded-xl pl-9 pr-4 py-2.5 text-sm text-white focus:outline-none focus:border-orange-500"
            />
          </div>

          {/* Gitter mit Kassensystemen */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {posKeys.map(key => {
              const p = POS_SYSTEMS[key];
              return (
                <button
                  key={key}
                  onClick={() => selectPos(key)}
                  className="bg-gray-900 border border-gray-800 hover:border-orange-500 rounded-2xl p-4 text-left transition-all group hover:bg-gray-800/50"
                >
                  <div className={`w-10 h-10 ${p.color} rounded-xl flex items-center justify-center text-white font-bold text-sm mb-3 group-hover:scale-105 transition-transform`}>
                    {p.logo}
                  </div>
                  <p className="text-white text-sm font-semibold">{p.name}</p>
                  <p className="text-gray-500 text-xs mt-1 leading-tight">{p.hint}</p>
                </button>
              );
            })}
          </div>

          {posKeys.length === 0 && (
            <div className="text-center py-8 text-gray-500 text-sm">
              Kein System gefunden. Wähle „Anderes System / Manuell".
            </div>
          )}
        </div>
      )}

      {/* ── Schritt 2: Datei hochladen ───────────────────────────────────────── */}
      {step === "upload" && pos && (
        <div className="space-y-4">
          {/* Systeminfo */}
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 flex items-center gap-3">
            <div className={`w-10 h-10 ${pos.color} rounded-xl flex items-center justify-center text-white font-bold text-sm shrink-0`}>
              {pos.logo}
            </div>
            <div>
              <p className="text-white font-semibold">{pos.name}</p>
              <p className="text-gray-400 text-xs">{pos.hint}</p>
            </div>
          </div>

          {/* Anleitung */}
          <div className="bg-blue-500/10 border border-blue-500/20 rounded-2xl p-4">
            <p className="text-blue-300 text-sm font-semibold mb-2">So exportierst du aus {pos.name}:</p>
            <ol className="text-gray-400 text-sm space-y-1.5 list-decimal list-inside">
              {pos.steps.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ol>
          </div>

          {/* Upload-Bereich */}
          <div
            onClick={() => fileRef.current?.click()}
            onDragOver={e => e.preventDefault()}
            onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
            className="border-2 border-dashed border-gray-700 hover:border-orange-500 rounded-2xl p-10 text-center cursor-pointer transition-colors group"
          >
            <Upload size={36} className="text-gray-600 group-hover:text-orange-400 mx-auto mb-3 transition-colors" />
            <p className="text-white font-semibold">CSV-Datei hier ablegen</p>
            <p className="text-gray-500 text-sm mt-1">oder klicken · CSV, TXT, XLSX</p>
            <input ref={fileRef} type="file" accept=".csv,.txt,.xlsx" className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
          </div>
        </div>
      )}

      {/* ── Schritt 3: Spalten zuordnen ─────────────────────────────────────── */}
      {step === "map" && pos && (
        <div className="space-y-4">
          {/* Datei-Info */}
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 flex items-center gap-3">
            <FileText size={18} className="text-orange-400 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-white text-sm font-medium truncate">{fileName}</p>
              <p className="text-gray-400 text-xs">{rows.length} Zeilen · {pos.name}</p>
            </div>
            <button onClick={() => setStep("upload")} className="p-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white">
              <X size={14} />
            </button>
          </div>

          {/* Mapping */}
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
            <h3 className="text-white font-semibold mb-4">Spalten zuordnen</h3>
            <div className="grid grid-cols-1 gap-3">
              {(Object.keys(FIELD_LABELS) as (keyof Mapping)[]).map(field => (
                <div key={field} className="flex items-center gap-3">
                  <span className={`text-sm w-36 shrink-0 ${field === "date" || field === "amount" ? "text-white font-medium" : "text-gray-400"}`}>
                    {FIELD_LABELS[field]}
                  </span>
                  <div className="relative flex-1">
                    <select
                      value={mapping[field]}
                      onChange={e => setMapping(prev => ({ ...prev, [field]: parseInt(e.target.value) }))}
                      className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white appearance-none focus:outline-none focus:border-orange-500"
                    >
                      <option value={-1}>— nicht importieren —</option>
                      {headers.map((h, i) => (
                        <option key={i} value={i}>{h} (z.B.: {rows[0]?.[i] || "–"})</option>
                      ))}
                    </select>
                    <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                  </div>
                  {(field === "date" || field === "amount") && mapping[field] === -1 && (
                    <AlertCircle size={16} className="text-red-400 shrink-0" />
                  )}
                  {mapping[field] >= 0 && (
                    <CheckCircle size={16} className="text-green-400 shrink-0" />
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Vorschau */}
          <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
            <div className="p-4 border-b border-gray-800 flex items-center justify-between">
              <h3 className="text-white font-semibold text-sm">Vorschau (erste 5 Zeilen)</h3>
              <span className="text-gray-500 text-xs">{rows.length} Zeilen gesamt</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-800">
                    {headers.map((h, i) => {
                      const mapped = Object.values(mapping).includes(i);
                      return (
                        <th key={i} className={`px-3 py-2 text-left font-medium whitespace-nowrap ${mapped ? "text-orange-400" : "text-gray-500"}`}>
                          {h}
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, 5).map((row, ri) => (
                    <tr key={ri} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                      {row.map((cell, ci) => (
                        <td key={ci} className={`px-3 py-2 whitespace-nowrap max-w-32 truncate ${Object.values(mapping).includes(ci) ? "text-white" : "text-gray-600"}`}>
                          {cell || "–"}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex gap-3">
            <button onClick={() => setStep("upload")} className="flex-1 py-3 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm font-medium transition-colors">
              Zurück
            </button>
            <button
              onClick={doImport}
              disabled={importing || mapping.date === -1 || mapping.amount === -1}
              className="flex-1 py-3 rounded-xl bg-orange-500 hover:bg-orange-600 disabled:opacity-40 text-white text-sm font-semibold transition-colors"
            >
              {importing
                ? `Importiere... (${rows.length} Zeilen)`
                : `${rows.length} Zeilen importieren`}
            </button>
          </div>
        </div>
      )}

      {/* ── Schritt 4: Ergebnis ──────────────────────────────────────────────── */}
      {step === "done" && result && pos && (
        <div className="space-y-4">
          <div className={`rounded-2xl p-5 border ${result.ok > 0 ? "bg-green-500/10 border-green-500/20" : "bg-red-500/10 border-red-500/20"}`}>
            <div className="flex items-center gap-3 mb-4">
              {result.ok > 0
                ? <CheckCircle size={24} className="text-green-400" />
                : <AlertCircle size={24} className="text-red-400" />}
              <div>
                <h3 className="text-white font-bold">Import abgeschlossen</h3>
                <p className="text-gray-400 text-xs">{pos.name} · {fileName}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-black/20 rounded-xl p-3 text-center">
                <p className="text-green-400 text-2xl font-bold">{result.ok}</p>
                <p className="text-gray-400 text-xs">Erfolgreich importiert</p>
              </div>
              <div className="bg-black/20 rounded-xl p-3 text-center">
                <p className={`text-2xl font-bold ${result.skip > 0 ? "text-red-400" : "text-gray-500"}`}>{result.skip}</p>
                <p className="text-gray-400 text-xs">Übersprungen</p>
              </div>
            </div>
            {result.ok > 0 && (
              <p className="text-green-400 text-xs mt-3 text-center">
                ✓ Umsätze erscheinen jetzt in der Buchhaltung
              </p>
            )}
          </div>

          {result.errors.length > 0 && (
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
              <p className="text-gray-400 text-sm font-medium mb-2">Hinweise ({result.errors.length}):</p>
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {result.errors.map((e, i) => (
                  <p key={i} className="text-red-400 text-xs">{e}</p>
                ))}
              </div>
            </div>
          )}

          <button onClick={reset} className="w-full py-3 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-semibold transition-colors">
            Weiteren Import starten
          </button>
        </div>
      )}
    </div>
  );
}
