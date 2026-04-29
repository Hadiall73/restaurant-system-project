"use client";
import { useState, useRef } from "react";
import { Upload, FileText, CheckCircle, AlertCircle, Loader2, Trash2 } from "lucide-react";

interface Rechnung {
  id: number;
  dateiname: string;
  lieferant: string;
  datum: string;
  betrag_brutto: number;
  betrag_netto: number;
  mwst_betrag: number;
  mwst_prozent: number;
  kategorie: string;
  rechnungsnummer: string;
  artikel: string[];
}

const KATEGORIE_FARBEN: Record<string, string> = {
  Wareneinkauf: "bg-orange-500/20 text-orange-300",
  Personal: "bg-blue-500/20 text-blue-300",
  Miete: "bg-purple-500/20 text-purple-300",
  Energie: "bg-yellow-500/20 text-yellow-300",
  Sonstiges: "bg-gray-500/20 text-gray-300",
};

export default function Rechnungen() {
  const [rechnungen, setRechnungen] = useState<Rechnung[]>([]);
  const [laden, setLaden] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const [drag, setDrag] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function verarbeite(datei: File) {
    if (!datei.type.includes("pdf") && !datei.type.includes("image")) {
      setFehler("Nur PDF oder Bild-Dateien erlaubt");
      return;
    }

    setLaden(true);
    setFehler(null);

    const form = new FormData();
    form.append("datei", datei);

    try {
      const res = await fetch("/api/rechnung", { method: "POST", body: form });
      const data = await res.json();

      if (!res.ok || !data.erfolg) {
        setFehler(data.error || "Fehler beim Lesen der Rechnung");
        return;
      }

      setRechnungen((prev) => [
        { id: Date.now(), dateiname: datei.name, ...data.daten },
        ...prev,
      ]);
    } catch {
      setFehler("Verbindungsfehler — API Key prüfen");
    } finally {
      setLaden(false);
    }
  }

  function onDateiWahl(e: React.ChangeEvent<HTMLInputElement>) {
    const datei = e.target.files?.[0];
    if (datei) verarbeite(datei);
    e.target.value = "";
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDrag(false);
    const datei = e.dataTransfer.files[0];
    if (datei) verarbeite(datei);
  }

  const gesamtBrutto = rechnungen.reduce((s, r) => s + r.betrag_brutto, 0);
  const gesamtMwst = rechnungen.reduce((s, r) => s + r.mwst_betrag, 0);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white">Rechnungen</h2>
        <p className="text-gray-400 text-sm mt-1">PDF hochladen — KI liest automatisch aus</p>
      </div>

      {/* Upload Zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        className={`
          border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all
          ${drag ? "border-orange-500 bg-orange-500/10" : "border-gray-700 hover:border-gray-500 hover:bg-gray-800/30"}
          ${laden ? "pointer-events-none opacity-60" : ""}
        `}
      >
        <input ref={inputRef} type="file" accept=".pdf,image/*" className="hidden" onChange={onDateiWahl} />
        {laden ? (
          <div className="flex flex-col items-center gap-3">
            <Loader2 size={40} className="text-orange-400 animate-spin" />
            <p className="text-gray-300 font-medium">KI analysiert Rechnung...</p>
            <p className="text-gray-500 text-sm">Lieferant, Betrag, MwSt werden extrahiert</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3">
            <div className="w-14 h-14 rounded-2xl bg-orange-500/20 flex items-center justify-center">
              <Upload size={24} className="text-orange-400" />
            </div>
            <div>
              <p className="text-white font-medium">Rechnung hier ablegen</p>
              <p className="text-gray-400 text-sm mt-1">oder klicken zum Auswählen · PDF oder Foto</p>
            </div>
          </div>
        )}
      </div>

      {fehler && (
        <div className="flex items-center gap-3 bg-red-500/10 border border-red-500/20 rounded-xl p-4">
          <AlertCircle size={18} className="text-red-400 shrink-0" />
          <p className="text-red-300 text-sm">{fehler}</p>
        </div>
      )}

      {/* Zusammenfassung */}
      {rechnungen.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
            <p className="text-gray-400 text-sm mb-2">Rechnungen gesamt</p>
            <p className="text-3xl font-bold text-white">{rechnungen.length}</p>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
            <p className="text-gray-400 text-sm mb-2">Gesamtbetrag (Brutto)</p>
            <p className="text-3xl font-bold text-white">{gesamtBrutto.toLocaleString("de-DE", { minimumFractionDigits: 2 })} €</p>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
            <p className="text-gray-400 text-sm mb-2">Vorsteuer (abziehbar)</p>
            <p className="text-3xl font-bold text-green-400">{gesamtMwst.toLocaleString("de-DE", { minimumFractionDigits: 2 })} €</p>
          </div>
        </div>
      )}

      {/* Rechnungsliste */}
      {rechnungen.length > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
          <div className="p-5 border-b border-gray-800 flex items-center justify-between">
            <h3 className="font-semibold text-white">Eingelesene Rechnungen</h3>
            <div className="flex items-center gap-2 text-green-400 text-sm">
              <CheckCircle size={14} />
              KI automatisch ausgelesen
            </div>
          </div>
          <div className="divide-y divide-gray-800/50">
            {rechnungen.map((r) => (
              <div key={r.id} className="p-5 hover:bg-gray-800/30 transition-colors">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gray-800 flex items-center justify-center shrink-0">
                      <FileText size={18} className="text-orange-400" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-white font-medium">{r.lieferant}</p>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${KATEGORIE_FARBEN[r.kategorie] || KATEGORIE_FARBEN.Sonstiges}`}>
                          {r.kategorie}
                        </span>
                      </div>
                      <p className="text-gray-400 text-xs mt-0.5">
                        {r.datum} · Nr: {r.rechnungsnummer || "—"} · {r.dateiname}
                      </p>
                      {r.artikel?.length > 0 && (
                        <p className="text-gray-500 text-xs mt-1">{r.artikel.slice(0, 3).join(", ")}{r.artikel.length > 3 ? "..." : ""}</p>
                      )}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-white font-bold">{r.betrag_brutto.toLocaleString("de-DE", { minimumFractionDigits: 2 })} €</p>
                    <p className="text-gray-400 text-xs">{r.betrag_netto.toLocaleString("de-DE", { minimumFractionDigits: 2 })} € netto</p>
                    <p className="text-green-400 text-xs">MwSt: {r.mwst_betrag.toLocaleString("de-DE", { minimumFractionDigits: 2 })} €</p>
                  </div>
                </div>
                <div className="flex justify-end mt-3">
                  <button
                    onClick={() => setRechnungen((prev) => prev.filter((x) => x.id !== r.id))}
                    className="text-gray-600 hover:text-red-400 transition-colors"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {rechnungen.length === 0 && !laden && (
        <div className="text-center py-10 text-gray-600">
          <FileText size={40} className="mx-auto mb-3 opacity-30" />
          <p>Noch keine Rechnungen hochgeladen</p>
          <p className="text-sm mt-1">Lade eine PDF-Rechnung hoch und die KI liest alles automatisch aus</p>
        </div>
      )}
    </div>
  );
}
