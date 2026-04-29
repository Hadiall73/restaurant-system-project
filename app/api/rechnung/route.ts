import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const datei = formData.get("datei") as File;

    if (!datei) {
      return NextResponse.json({ error: "Keine Datei" }, { status: 400 });
    }

    const rawKey = process.env.GEMINI_API_KEY || "";
    const apiKey = rawKey.charCodeAt(0) === 0xFEFF ? rawKey.slice(1).trim() : rawKey.trim();
    if (!apiKey) {
      return NextResponse.json({ error: "Kein API Key" }, { status: 500 });
    }

    const bytes = await datei.arrayBuffer();
    const base64 = Buffer.from(bytes).toString("base64");
    const mimeType = datei.type || "application/pdf";

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const result = await model.generateContent([
      {
        inlineData: {
          mimeType,
          data: base64,
        },
      },
      `Analysiere diese Rechnung und extrahiere folgende Daten als JSON:
{
  "lieferant": "Name des Lieferanten",
  "datum": "Datum im Format TT.MM.JJJJ",
  "betrag_netto": Zahl ohne €,
  "betrag_brutto": Zahl ohne €,
  "mwst_prozent": Zahl (7 oder 19),
  "mwst_betrag": Zahl ohne €,
  "kategorie": "eine von: Wareneinkauf, Personal, Miete, Energie, Sonstiges",
  "rechnungsnummer": "Rechnungsnummer falls vorhanden",
  "artikel": ["Liste der Artikel falls erkennbar"]
}
Antworte NUR mit dem JSON, ohne Erklärung.`,
    ]);

    const text = result.response.text().trim();
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json({ error: "KI konnte Rechnung nicht lesen" }, { status: 422 });
    }

    const daten = JSON.parse(jsonMatch[0]);
    return NextResponse.json({ erfolg: true, daten });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Fehler beim Verarbeiten" }, { status: 500 });
  }
}
