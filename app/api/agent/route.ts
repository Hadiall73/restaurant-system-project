import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { umsatzWoche, kpiDaten, lagerbestand, mitarbeiter, steuerdaten } from "@/lib/demoData";

const KONTEXT = `
Du bist ein KI-Assistent für ein Restaurant. Du hast Zugriff auf folgende Echtzeit-Daten:

UMSATZ DIESE WOCHE:
${umsatzWoche.map((d) => `${d.tag}: Umsatz ${d.umsatz}€, Kosten ${d.kosten}€, Gewinn ${d.umsatz - d.kosten}€`).join("\n")}

KPIs:
- Heutiger Umsatz: ${kpiDaten.tagesUmsatz}€
- Wochenumsatz: ${kpiDaten.wochenUmsatz}€
- Monatsumsatz: ${kpiDaten.monatsUmsatz}€
- Gewinnmarge: ${kpiDaten.gewinnMarge}%
- Tischbelegung: ${kpiDaten.offeneTische}/${kpiDaten.gesamtTische} Tische
- Durchschnittlicher Bon: ${kpiDaten.durchschnittsBon}€

LAGERBESTAND (kritisch wenn unter Minimum):
${lagerbestand.map((a) => `${a.artikel}: ${a.menge}${a.einheit} (Minimum: ${a.minimum}${a.einheit}) ${a.menge < a.minimum ? "⚠️ KRITISCH" : "✓ OK"}`).join("\n")}

MITARBEITER:
${mitarbeiter.map((m) => `${m.name} (${m.rolle}): ${m.stunden}h/Woche, ${m.lohn}€/h = ${m.stunden * m.lohn}€`).join("\n")}

STEUER Q1 2026:
- Gesamtumsatz: ${steuerdaten.umsatzGesamt}€
- Zahllast USt: ${steuerdaten.zahlbar}€
- Nächste Fälligkeit: ${steuerdaten.naechsteFaelligkeit}

Antworte kurz, präzise und auf Deutsch. Gib konkrete Empfehlungen basierend auf den Daten.
`;

export async function POST(req: NextRequest) {
  try {
    const { nachricht } = await req.json();
    const rawKey = process.env.GEMINI_API_KEY || "";
    const apiKey = rawKey.charCodeAt(0) === 0xFEFF ? rawKey.slice(1).trim() : rawKey.trim();

    if (!apiKey) {
      return NextResponse.json({
        antwort: "Kein API Key gefunden. Bitte GEMINI_API_KEY in .env.local eintragen.",
      });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-lite" });

    const result = await model.generateContent(`${KONTEXT}\n\nFrage: ${nachricht}`);
    const antwort = result.response.text();

    return NextResponse.json({ antwort });
  } catch (error: any) {
    console.error(error);
    return NextResponse.json({ antwort: `Fehler: ${error?.message || String(error)}` }, { status: 500 });
  }
}
