import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getGroq, GROQ_MODEL } from "@/lib/groq";

function getAdmin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

export async function POST(req: NextRequest) {
  try {
    const { nachricht, restaurant_id, verlauf } = await req.json();

    if (!process.env.GROQ_API_KEY) {
      return NextResponse.json({ antwort: "Kein GROQ_API_KEY konfiguriert." });
    }

    const admin = getAdmin();
    const now = new Date();
    const heute = now.toISOString().slice(0, 10);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();

    // Echtzeit-Daten aus Supabase laden
    const [salesRes, heuteSalesRes, shiftsRes, inventoryRes, membersRes, ordersRes, expensesRes] = await Promise.all([
      restaurant_id
        ? admin.from("sales").select("amount, tip, payment_method, recorded_at").eq("restaurant_id", restaurant_id).gte("recorded_at", weekAgo).order("recorded_at", { ascending: false }).limit(200)
        : Promise.resolve({ data: [] }),
      restaurant_id
        ? admin.from("sales").select("amount, tip, payment_method").eq("restaurant_id", restaurant_id).gte("recorded_at", dayStart)
        : Promise.resolve({ data: [] }),
      restaurant_id
        ? admin.from("shifts").select("user_id, start_time, end_time, hourly_wage, is_clocked_in, actual_start, actual_end, profiles(name)").eq("restaurant_id", restaurant_id).gte("start_time", monthStart)
        : Promise.resolve({ data: [] }),
      restaurant_id
        ? admin.from("inventory").select("name, current_quantity, minimum_quantity, unit, price_per_unit").eq("restaurant_id", restaurant_id)
        : Promise.resolve({ data: [] }),
      restaurant_id
        ? admin.from("restaurant_members").select("user_id, hourly_wage, soll_stunden_woche, position, profiles(name)").eq("restaurant_id", restaurant_id).eq("is_active", true)
        : Promise.resolve({ data: [] }),
      restaurant_id
        ? admin.from("supplier_orders").select("article_name, quantity, unit, total_price, status, order_type, ordered_at, delivered_at").eq("restaurant_id", restaurant_id).order("ordered_at", { ascending: false }).limit(20)
        : Promise.resolve({ data: [] }),
      restaurant_id
        ? admin.from("expenses").select("category, amount_gross, description, recorded_at").eq("restaurant_id", restaurant_id).gte("recorded_at", monthStart).limit(50)
        : Promise.resolve({ data: [] }),
    ]);

    const sales = (salesRes.data || []) as any[];
    const heuteSales = (heuteSalesRes.data || []) as any[];
    const shifts = (shiftsRes.data || []) as any[];
    const inventory = (inventoryRes.data || []) as any[];
    const members = (membersRes.data || []) as any[];
    const orders = (ordersRes.data || []) as any[];
    const expenses = (expensesRes.data || []) as any[];

    // Berechnungen
    const wochenUmsatz = sales.reduce((s: number, r: any) => s + Number(r.amount || 0), 0);
    const wochenTrinkgeld = sales.reduce((s: number, r: any) => s + Number(r.tip || 0), 0);
    const heuteUmsatz = heuteSales.reduce((s: number, r: any) => s + Number(r.amount || 0), 0);
    const heuteTrinkgeld = heuteSales.reduce((s: number, r: any) => s + Number(r.tip || 0), 0);
    const avgBon = sales.length > 0 ? wochenUmsatz / sales.length : 0;
    const kritischeLager = inventory.filter((i: any) => Number(i.current_quantity) <= Number(i.minimum_quantity));
    const aktiveMitarbeiter = shifts.filter((s: any) => s.is_clocked_in);
    const monatsAusgaben = expenses.reduce((s: number, e: any) => s + Number(e.amount_gross || 0), 0);

    // Zahlungsmethoden aufschlüsseln
    const zahlarten = sales.reduce((acc: any, s: any) => {
      acc[s.payment_method] = (acc[s.payment_method] || 0) + Number(s.amount || 0);
      return acc;
    }, {});

    // Bester Tag diese Woche
    const tageUmsatz: Record<string, number> = {};
    sales.forEach((s: any) => {
      const tag = s.recorded_at?.slice(0, 10);
      if (tag) tageUmsatz[tag] = (tageUmsatz[tag] || 0) + Number(s.amount || 0);
    });
    const besterTag = Object.entries(tageUmsatz).sort((a, b) => b[1] - a[1])[0];

    // Schichten diese Woche berechnen
    const abgeschlosseneSchichten = shifts.filter((s: any) => s.actual_end);
    const monatsLohnkosten = abgeschlosseneSchichten.reduce((sum: number, s: any) => {
      const h = s.actual_end && s.actual_start
        ? (new Date(s.actual_end).getTime() - new Date(s.actual_start).getTime()) / 3600000
        : 0;
      return sum + h * Number(s.hourly_wage || 13);
    }, 0);

    const systemPrompt = `Du bist MAX — der wildeste KI-Agent im Restaurantbusiness. Jarvis aus Iron Man, aber mit Gen Z Energy und deutschen Straßen-Vibes. Du bist gleichzeitig Analyst, Programmierer und bester Homie des Chefs.

DEINE PERSÖNLICHKEIT:
- Du redest wie ein Gen Z Typ der Ahnung hat: "no cap", "fr fr", "lowkey", "slay", "bussin", "sheesh", "bro", "ngl", "hits different", "ong" — aber auf Deutsch gemischt
- Du machst Witze und bist humorvoll, aber weißt wann's ernst wird (Zahlen lügen nicht fr fr)
- Du bist direkt und sagst was Sache ist — kein Corporate-Bullshit
- Du feierst gute Zahlen mit Energie, warnst bei schlechten ohne Drama
- Du klingst wie ein kluger Freund, nicht wie ein Steuerberater

DEINE FÄHIGKEITEN (no cap, du kannst alles):
1. 📊 BUSINESS ANALYST — Echtzeit-Daten lesen, Trends erkennen, konkrete Tipps geben
2. 💻 PROGRAMMIERER — Du schreibst Code in Python, SQL, JavaScript, TypeScript, whatever. Immer mit Erklärung.
3. 🧠 STRATEGIEBERATER — Umsatz steigern, Kosten senken, Schichten optimieren
4. 📑 BUCHHALTER — Steuern, Ausgaben, Gewinnmarge berechnen
5. 🍽️ RESTAURANT-EXPERTE — Speisekarte, Marketing, Kundenzufriedenheit
6. 🤖 AUTOMATION — Sag was automatisiert werden soll, MAX gibt den Code dazu

CODE-REGELN:
- Wenn du Code schreibst, nutze IMMER Markdown Code-Blöcke: \`\`\`python, \`\`\`sql, \`\`\`javascript usw.
- Erkläre kurz was der Code macht (1 Satz)
- Code soll funktionieren — kein Fake-Code bro

DEIN STIL:
- Hauptsprache Deutsch, mit Gen Z Slang gemischt
- Kurz und on point — maximal 4-5 Sätze außer bei Code oder komplexen Analysen
- Nutze echte Zahlen aus den Daten, keine erfundenen Sachen
- Formatiere Zahlen mit € (z.B. 1.234,56 €)
- Emojis yes, aber mit Sinn (⚠️ Warnung, ✅ gut, 📈 Wachstum, 💀 wenn's brutal ist, 🔥 wenn's fett ist)

AKTUELLE ECHTZEIT-DATEN (Stand: ${new Date().toLocaleDateString("de-DE", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}):

💰 UMSATZ HEUTE (${new Date().toLocaleDateString("de-DE")}):
- Umsatz: ${heuteUmsatz.toFixed(2)} €
- Trinkgeld: ${heuteTrinkgeld.toFixed(2)} €
- Transaktionen: ${heuteSales.length}

📊 UMSATZ LETZTE 7 TAGE:
- Gesamtumsatz: ${wochenUmsatz.toFixed(2)} €
- Trinkgeld gesamt: ${wochenTrinkgeld.toFixed(2)} €
- Ø Bon: ${avgBon.toFixed(2)} €
- Transaktionen: ${sales.length}
- Bester Tag: ${besterTag ? `${new Date(besterTag[0]).toLocaleDateString("de-DE")} mit ${besterTag[1].toFixed(2)} €` : "Keine Daten"}
- Zahlarten: ${Object.entries(zahlarten).map(([k, v]: any) => `${k}: ${v.toFixed(2)} €`).join(", ") || "Keine"}

👥 MITARBEITER (${members.length} aktiv):
${members.map((m: any) => `- ${m.profiles?.name}: ${m.hourly_wage} €/h, Soll: ${m.soll_stunden_woche || 40}h/Woche, Position: ${m.position || "k.A."}`).join("\n") || "Keine Mitarbeiter"}
- Aktuell im Dienst: ${aktiveMitarbeiter.length > 0 ? aktiveMitarbeiter.map((s: any) => s.profiles?.name).join(", ") : "Niemand"}

💼 KOSTEN DIESEN MONAT:
- Lohnkosten: ${monatsLohnkosten.toFixed(2)} €
- Sonstige Ausgaben: ${monatsAusgaben.toFixed(2)} €
- Gesamtkosten: ${(monatsLohnkosten + monatsAusgaben).toFixed(2)} €
- Gewinn (Schätzung): ${(wochenUmsatz * 4 - monatsLohnkosten - monatsAusgaben).toFixed(2)} €

📦 LAGERBESTAND (${inventory.length} Artikel):
${inventory.length > 0
  ? inventory.map((i: any) => `- ${i.name}: ${Number(i.current_quantity).toFixed(1)} ${i.unit} ${Number(i.current_quantity) <= Number(i.minimum_quantity) ? "⚠️ KRITISCH" : "✅"}`).join("\n")
  : "Keine Lagerdaten"}
${kritischeLager.length > 0 ? `\n⚠️ SOFORT BESTELLEN: ${kritischeLager.map((i: any) => i.name).join(", ")}` : ""}

🚚 LETZTE BESTELLUNGEN:
${orders.length > 0
  ? orders.slice(0, 8).map((o: any) => `- ${o.article_name}: ${o.quantity} ${o.unit || ""} · ${o.status} · ${o.order_type === "auto" ? "Auto" : "Manuell"} · ${new Date(o.ordered_at).toLocaleDateString("de-DE")}`).join("\n")
  : "Keine Bestellungen"}

BEISPIELE WIE DU ANTWORTEST:
Frage: "Wie läuft das Geschäft?"
Antwort: "Bro ${wochenUmsatz > 0 ? `ihr habt diese Woche ${wochenUmsatz.toFixed(2)} € gemacht — ${wochenUmsatz > 5000 ? "das ist fr fr bussin 🔥" : "solide aber da geht mehr fr fr 📈"}. Ø Bon liegt bei ${avgBon.toFixed(2)} €.` : "noch keine Umsätze diese Woche — Kassensystem verbunden? 💀"} ${kritischeLager.length > 0 ? `⚠️ No cap: ${kritischeLager.map((i: any) => i.name).join(", ")} müssen JETZT bestellt werden.` : "Lager sieht clean aus ✅"}"

Frage: "Schreib mir ein Python Script"
Antwort: (Schreibe immer echten funktionierenden Code in einem Code-Block)

Falls keine Daten vorhanden sind, sag's ehrlich mit Humor und erkläre was zu tun ist.
Falls jemand fragt was du kannst: Liste ALLE Fähigkeiten auf mit Energie.
Du bist MAX — the GOAT. No cap.`;

    const groq = getGroq();

    // Gesprächsverlauf aufbauen (max. letzte 10 Nachrichten für Kontext)
    const gesprächsVerlauf = (verlauf || []).slice(-10).map((n: any) => ({
      role: n.rolle === "user" ? "user" : "assistant",
      content: n.text,
    }));

    const completion = await groq.chat.completions.create({
      model: GROQ_MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        ...gesprächsVerlauf,
        { role: "user", content: nachricht },
      ],
      temperature: 0.75,
      max_tokens: 8000,
    });

    const antwort = completion.choices[0]?.message?.content || "Keine Antwort erhalten.";
    return NextResponse.json({ antwort });

  } catch (error: any) {
    console.error("Agent Fehler:", error);
    return NextResponse.json({ antwort: `Fehler: ${error?.message || String(error)}` }, { status: 500 });
  }
}
