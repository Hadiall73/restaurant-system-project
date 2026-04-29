import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { createClient } from "@supabase/supabase-js";

function getAdmin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

export async function POST(req: NextRequest) {
  const { restaurant_id, week_start } = await req.json();

  // Fetch all availability for the week
  const supabaseAdmin = getAdmin();
  const { data: availabilities } = await supabaseAdmin
    .from("availability")
    .select("*, profiles(name, id)")
    .eq("restaurant_id", restaurant_id)
    .eq("week_start", week_start);

  // Fetch all members with wages
  const { data: members } = await supabaseAdmin
    .from("restaurant_members")
    .select("*, profiles(name)")
    .eq("restaurant_id", restaurant_id)
    .eq("is_active", true);

  if (!availabilities?.length) {
    return NextResponse.json({ error: "Keine Verfügbarkeiten eingereicht" }, { status: 400 });
  }

  const rawKey = process.env.GEMINI_API_KEY || "";
  const geminiKey = rawKey.charCodeAt(0) === 0xFEFF ? rawKey.slice(1).trim() : rawKey.trim();
  const genAI = new GoogleGenerativeAI(geminiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-lite" });

  const prompt = `Du bist ein Restaurant-Manager. Erstelle einen optimalen Wochendienstplan.

VERFÜGBARKEITEN (KW ${week_start}):
${availabilities.map(a => `
Mitarbeiter: ${(a as any).profiles?.name}
- Montag: ${a.monday ? "Verfügbar" + (a.monday_note ? ` (${a.monday_note})` : "") : "Nicht verfügbar"}
- Dienstag: ${a.tuesday ? "Verfügbar" + (a.tuesday_note ? ` (${a.tuesday_note})` : "") : "Nicht verfügbar"}
- Mittwoch: ${a.wednesday ? "Verfügbar" + (a.wednesday_note ? ` (${a.wednesday_note})` : "") : "Nicht verfügbar"}
- Donnerstag: ${a.thursday ? "Verfügbar" + (a.thursday_note ? ` (${a.thursday_note})` : "") : "Nicht verfügbar"}
- Freitag: ${a.friday ? "Verfügbar" + (a.friday_note ? ` (${a.friday_note})` : "") : "Nicht verfügbar"}
- Samstag: ${a.saturday ? "Verfügbar" + (a.saturday_note ? ` (${a.saturday_note})` : "") : "Nicht verfügbar"}
- Sonntag: ${a.sunday ? "Verfügbar" + (a.sunday_note ? ` (${a.sunday_note})` : "") : "Nicht verfügbar"}
`).join("\n")}

REGELN:
- Max 5 Tage pro Mitarbeiter pro Woche
- Freitag und Samstag brauchen mehr Personal (Stoßzeiten)
- Jeder verfügbare Mitarbeiter soll mindestens 3 Schichten bekommen
- Schichten: Frühschicht 09:00-17:00, Spätschicht 16:00-23:00

Antworte NUR als JSON:
{
  "shifts": [
    {
      "user_name": "Name",
      "user_id": "ID aus Verfügbarkeit",
      "day": "monday|tuesday|wednesday|thursday|friday|saturday|sunday",
      "start": "09:00",
      "end": "17:00"
    }
  ],
  "reasoning": "Kurze Begründung auf Deutsch"
}`;

  const result = await model.generateContent(prompt);
  const text = result.response.text().trim();
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return NextResponse.json({ error: "KI Fehler" }, { status: 500 });

  const plan = JSON.parse(jsonMatch[0]);

  // Save shifts to database
  const weekDate = new Date(week_start);
  const dayOffsets: Record<string, number> = { monday: 0, tuesday: 1, wednesday: 2, thursday: 3, friday: 4, saturday: 5, sunday: 6 };

  const shiftsToInsert = plan.shifts.map((shift: any) => {
    const av = availabilities.find(a => (a as any).profiles?.name === shift.user_name);
    const userId = av?.user_id;
    const shiftDate = new Date(weekDate);
    shiftDate.setDate(weekDate.getDate() + (dayOffsets[shift.day] || 0));

    const [startH, startM] = shift.start.split(":").map(Number);
    const [endH, endM] = shift.end.split(":").map(Number);
    const startTime = new Date(shiftDate);
    startTime.setHours(startH, startM, 0, 0);
    const endTime = new Date(shiftDate);
    endTime.setHours(endH, endM, 0, 0);

    const member = members?.find(m => m.user_id === userId);

    return {
      restaurant_id,
      user_id: userId,
      start_time: startTime.toISOString(),
      end_time: endTime.toISOString(),
      hourly_wage: member?.hourly_wage || 13,
    };
  }).filter((s: any) => s.user_id);

  await supabaseAdmin.from("shifts").insert(shiftsToInsert);

  return NextResponse.json({ plan, shifts_created: shiftsToInsert.length });
}
