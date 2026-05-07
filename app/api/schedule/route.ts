import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// ─── Schichtzeiten pro Slot ───────────────────────────────────────────────────
const SLOT_TIMES: Record<string, { start: string; end: string; hours: number }> = {
  Vormittag: { start: "07:00", end: "14:00", hours: 7 },
  Mittag:    { start: "11:00", end: "17:00", hours: 6 },
  Abend:     { start: "16:00", end: "23:00", hours: 7 },
  default:   { start: "09:00", end: "17:00", hours: 8 },
};

// Slot-Reihenfolge für Priorität
const SLOT_ORDER = ["Vormittag", "Mittag", "Abend"];

// Mindestbesetzung pro Slot pro Tag (Fr/Sa = Stoßzeit → mehr Abend-Personal)
const SLOT_NEEDS: Record<string, Record<string, number>> = {
  monday:    { Vormittag: 1, Mittag: 1, Abend: 1 },
  tuesday:   { Vormittag: 1, Mittag: 1, Abend: 1 },
  wednesday: { Vormittag: 1, Mittag: 1, Abend: 1 },
  thursday:  { Vormittag: 1, Mittag: 1, Abend: 1 },
  friday:    { Vormittag: 1, Mittag: 1, Abend: 2 },
  saturday:  { Vormittag: 1, Mittag: 1, Abend: 2 },
  sunday:    { Vormittag: 1, Mittag: 1, Abend: 1 },
};

const DAY_KEYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];

const DAY_OFFSETS: Record<string, number> = {
  monday: 0, tuesday: 1, wednesday: 2, thursday: 3,
  friday: 4, saturday: 5, sunday: 6,
};

// ─── Hilfsfunktionen ──────────────────────────────────────────────────────────

/** Slots aus dem note-Feld lesen (z.B. "Vormittag,Abend" → ["Vormittag", "Abend"]) */
function getSlots(av: any, dayKey: string): string[] {
  const noteKey = `${dayKey}_note`;
  const raw: string = av[noteKey] || "";
  const slots = raw.split(",").map((s: string) => s.trim()).filter(Boolean);
  // Wenn keine Slots angegeben aber verfügbar → alle Slots möglich
  if (slots.length === 0 && av[dayKey]) return ["Vormittag", "Mittag", "Abend"];
  return slots;
}

/** ISO-Zeitstring erstellen */
function makeISO(weekDate: Date, dayKey: string, timeStr: string): string {
  const d = new Date(weekDate);
  d.setDate(d.getDate() + DAY_OFFSETS[dayKey]);
  const [h, m] = timeStr.split(":").map(Number);
  d.setHours(h, m, 0, 0);
  return d.toISOString();
}

/** Welcher Slot hat die wenigste Abdeckung? (für Fairness bei Multi-Slot-Mitarbeitern) */
function leastCoveredSlot(
  slots: string[],
  coverageCount: Record<string, number>,
  needs: Record<string, number>
): string {
  let worst = slots[0];
  let worstRatio = Infinity;
  for (const s of slots) {
    const covered = coverageCount[s] || 0;
    const needed  = needs[s] || 1;
    const ratio   = covered / needed;
    if (ratio < worstRatio) { worstRatio = ratio; worst = s; }
  }
  return worst;
}

// ─── POST: Dienstplan generieren ──────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const { restaurant_id, week_start } = await req.json();
  const admin = getAdmin();

  const [avRes, membersRes] = await Promise.all([
    admin.from("availability")
      .select("*, profiles(name, id)")
      .eq("restaurant_id", restaurant_id)
      .eq("week_start", week_start),
    admin.from("restaurant_members")
      .select("*")
      .eq("restaurant_id", restaurant_id)
      .eq("is_active", true),
  ]);

  const availabilities = avRes.data || [];
  const members        = membersRes.data || [];

  if (!availabilities.length) {
    return NextResponse.json({ error: "Keine Verfügbarkeiten für diese Woche eingereicht." }, { status: 400 });
  }

  const weekDate = new Date(week_start);

  // ── Zustand für Fairness ────────────────────────────────────────────────────
  // Wie viele Tage/Stunden wurden einem Mitarbeiter schon zugeteilt?
  const assignedDays:  Record<string, number> = {};
  const assignedHours: Record<string, number> = {};
  members.forEach(m => { assignedDays[m.user_id] = 0; assignedHours[m.user_id] = 0; });

  // ── Wahrscheinlichkeitsstatistiken ─────────────────────────────────────────
  // Pro Tag+Slot: wie viele sind verfügbar, wie viele wurden eingeplant?
  type SlotStat = { available: number; assigned: number; needed: number; probability: number };
  const stats: Record<string, Record<string, SlotStat>> = {};

  const shiftsToInsert: any[] = [];

  // ── Haupt-Schleife: Tag für Tag ─────────────────────────────────────────────
  for (const dayKey of DAY_KEYS) {
    const needs  = SLOT_NEEDS[dayKey] || { Vormittag: 1, Mittag: 1, Abend: 1 };
    stats[dayKey] = {};

    // Verfügbare Mitarbeiter für diesen Tag
    const availableToday = availabilities.filter(av => av[dayKey] === true);

    // Wahrscheinlichkeit pro Slot vorab berechnen (rein statistisch)
    const slotAvailableCount: Record<string, number> = { Vormittag: 0, Mittag: 0, Abend: 0 };
    for (const av of availableToday) {
      const slots = getSlots(av, dayKey);
      for (const s of SLOT_ORDER) {
        if (slots.includes(s)) slotAvailableCount[s]++;
      }
    }
    for (const slot of SLOT_ORDER) {
      const avail  = slotAvailableCount[slot];
      const needed = needs[slot] || 1;
      stats[dayKey][slot] = {
        available:   avail,
        needed,
        assigned:    0,
        probability: Math.min(avail / needed, 1),
      };
    }

    if (availableToday.length === 0) continue;

    // Wer wurde heute schon eingeplant? (damit niemand doppelt)
    const usedToday = new Set<string>();

    // Slot-Zähler: wie viele wurden pro Slot schon eingeplant?
    const slotCoveredCount: Record<string, number> = { Vormittag: 0, Mittag: 0, Abend: 0 };

    // ── Slots verarbeiten: vom am wenigsten abgedeckten zuerst ───────────────
    // Sortiere Slots nach Abdeckungs-Ratio aufsteigend → kritischste zuerst
    const slotsByPriority = [...SLOT_ORDER].sort((a, b) => {
      const ratioA = (slotCoveredCount[a] || 0) / (needs[a] || 1);
      const ratioB = (slotCoveredCount[b] || 0) / (needs[b] || 1);
      return ratioA - ratioB;
    });

    for (const slot of slotsByPriority) {
      const needed = needs[slot] || 1;
      if (slotCoveredCount[slot] >= needed) continue;

      // Mitarbeiter die für diesen Slot verfügbar sind
      const candidates = availableToday
        .filter(av =>
          !usedToday.has(av.user_id) &&              // noch nicht eingeplant heute
          (assignedDays[av.user_id] || 0) < 5 &&    // max 5 Tage/Woche
          getSlots(av, dayKey).includes(slot)
        )
        // Fairness: wer hat diese Woche weniger Tage/Stunden?
        .sort((a, b) => {
          const daysA = assignedDays[a.user_id] || 0;
          const daysB = assignedDays[b.user_id] || 0;
          if (daysA !== daysB) return daysA - daysB;
          return (assignedHours[a.user_id] || 0) - (assignedHours[b.user_id] || 0);
        });

      for (const av of candidates) {
        if (slotCoveredCount[slot] >= needed) break;
        if (usedToday.has(av.user_id)) continue;

        // Falls Mitarbeiter mehrere Slots hat → weise ihn dem am wenigsten abgedeckten zu
        const mySlots = getSlots(av, dayKey);
        const chosenSlot = mySlots.length > 1
          ? leastCoveredSlot(mySlots, slotCoveredCount, needs)
          : mySlots[0] || slot;

        const times = SLOT_TIMES[chosenSlot] || SLOT_TIMES["default"];
        const member = members.find(m => m.user_id === av.user_id);

        shiftsToInsert.push({
          restaurant_id,
          user_id:      av.user_id,
          start_time:   makeISO(weekDate, dayKey, times.start),
          end_time:     makeISO(weekDate, dayKey, times.end),
          hourly_wage:  member?.hourly_wage || 13,
        });

        usedToday.add(av.user_id);
        slotCoveredCount[chosenSlot] = (slotCoveredCount[chosenSlot] || 0) + 1;
        assignedDays[av.user_id]  = (assignedDays[av.user_id]  || 0) + 1;
        assignedHours[av.user_id] = (assignedHours[av.user_id] || 0) + times.hours;
      }
    }

    // Echte Zähler in die Stats schreiben
    for (const slot of SLOT_ORDER) {
      if (stats[dayKey][slot]) {
        stats[dayKey][slot].assigned    = slotCoveredCount[slot] || 0;
        stats[dayKey][slot].probability = (needs[slot] || 1) > 0
          ? Math.min((slotCoveredCount[slot] || 0) / (needs[slot] || 1), 1)
          : 1;
      }
    }
  }

  // ── In DB schreiben ────────────────────────────────────────────────────────
  if (shiftsToInsert.length > 0) {
    const { error: insertError } = await admin.from("shifts").insert(shiftsToInsert);
    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }
  }

  // ── Zusammenfassung pro Tag ────────────────────────────────────────────────
  const daySummary: Record<string, { totalAvailable: number; totalAssigned: number; coverageProb: number }> = {};
  for (const dayKey of DAY_KEYS) {
    const totalNeeded   = Object.values(SLOT_NEEDS[dayKey] || {}).reduce((s, n) => s + n, 0);
    const totalAssigned = Object.values(stats[dayKey] || {}).reduce((s, v) => s + v.assigned, 0);
    const totalAvail    = availabilities.filter(av => av[dayKey]).length;
    daySummary[dayKey] = {
      totalAvailable: totalAvail,
      totalAssigned,
      coverageProb: totalNeeded > 0 ? Math.min(totalAssigned / totalNeeded, 1) : 1,
    };
  }

  return NextResponse.json({
    shifts_created: shiftsToInsert.length,
    stats,
    daySummary,
    assignedHours,
  });
}
