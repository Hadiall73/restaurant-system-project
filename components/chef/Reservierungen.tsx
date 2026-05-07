"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useStore } from "@/lib/store";
import { CalendarDays, Plus, Phone, Users, Clock, Check, X, Trash2, ChevronLeft, ChevronRight, Search, StickyNote } from "lucide-react";
import toast from "react-hot-toast";

type Status = "pending" | "confirmed" | "cancelled";

interface Reservation {
  id: string;
  restaurant_id: string;
  name: string;
  phone: string;
  email?: string;
  date: string;
  time: string;
  guests: number;
  notes?: string;
  status: Status;
  created_at: string;
}

const STATUS_LABEL: Record<Status, string> = {
  pending:   "Ausstehend",
  confirmed: "Bestätigt",
  cancelled: "Storniert",
};

const STATUS_STYLE: Record<Status, string> = {
  pending:   "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
  confirmed: "bg-green-500/15 text-green-400 border-green-500/30",
  cancelled: "bg-red-500/15 text-red-400 border-red-500/30",
};

const TIMES = [
  "11:00","11:30","12:00","12:30","13:00","13:30","14:00",
  "17:00","17:30","18:00","18:30","19:00","19:30","20:00","20:30","21:00","21:30",
];

const EMPTY: Omit<Reservation, "id" | "restaurant_id" | "created_at"> = {
  name: "", phone: "", email: "", date: "", time: "18:00", guests: 2, notes: "", status: "pending",
};

export default function ReservierungenChef() {
  const { restaurant } = useStore();
  const [list, setList]         = useState<Reservation[]>([]);
  const [loading, setLoading]   = useState(true);
  const [tableError, setTableError] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm]         = useState({ ...EMPTY });
  const [saving, setSaving]     = useState(false);
  const [search, setSearch]     = useState("");
  const [filterDate, setFilterDate] = useState(new Date().toISOString().slice(0, 10));
  const [filterStatus, setFilterStatus] = useState<"all" | Status>("all");

  useEffect(() => { if (restaurant) load(); }, [restaurant]);

  async function load() {
    if (!restaurant) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("reservations")
      .select("*")
      .eq("restaurant_id", restaurant.id)
      .order("date", { ascending: true })
      .order("time", { ascending: true });

    if (error?.code === "42P01") { setTableError(true); setLoading(false); return; }
    setList(data || []);
    setLoading(false);
  }

  async function save() {
    if (!restaurant) return;
    if (!form.name.trim()) { toast.error("Name eingeben"); return; }
    if (!form.phone.trim()) { toast.error("Telefonnummer eingeben"); return; }
    if (!form.date) { toast.error("Datum wählen"); return; }
    if (form.guests < 1) { toast.error("Mindestens 1 Gast"); return; }

    setSaving(true);
    const { error } = await supabase.from("reservations").insert({
      restaurant_id: restaurant.id,
      name:   form.name.trim(),
      phone:  form.phone.trim(),
      email:  form.email?.trim() || null,
      date:   form.date,
      time:   form.time,
      guests: form.guests,
      notes:  form.notes?.trim() || null,
      status: "pending",
    });

    if (error) { toast.error("Fehler: " + error.message); setSaving(false); return; }
    toast.success("Reservierung gespeichert!");
    setForm({ ...EMPTY });
    setShowForm(false);
    load();
    setSaving(false);
  }

  async function setStatus(id: string, status: Status) {
    const { error } = await supabase.from("reservations").update({ status }).eq("id", id);
    if (error) { toast.error("Fehler"); return; }
    setList(prev => prev.map(r => r.id === id ? { ...r, status } : r));
    toast.success(STATUS_LABEL[status]);
  }

  async function remove(id: string) {
    if (!confirm("Reservierung wirklich löschen?")) return;
    await supabase.from("reservations").delete().eq("id", id);
    setList(prev => prev.filter(r => r.id !== id));
    toast.success("Gelöscht");
  }

  function offsetDate(days: number) {
    const d = new Date(filterDate);
    d.setDate(d.getDate() + days);
    setFilterDate(d.toISOString().slice(0, 10));
  }

  const filtered = list.filter(r => {
    const matchDate   = r.date === filterDate;
    const matchStatus = filterStatus === "all" || r.status === filterStatus;
    const matchSearch = !search || r.name.toLowerCase().includes(search.toLowerCase()) || r.phone.includes(search);
    return matchDate && matchStatus && matchSearch;
  });

  const todayTotal  = list.filter(r => r.date === filterDate && r.status !== "cancelled").reduce((s, r) => s + r.guests, 0);
  const confirmed   = list.filter(r => r.date === filterDate && r.status === "confirmed").length;
  const pending     = list.filter(r => r.date === filterDate && r.status === "pending").length;

  if (tableError) return (
    <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-2xl p-6 text-yellow-400">
      <p className="font-semibold mb-2">Tabelle "reservations" fehlt in Supabase</p>
      <p className="text-sm mb-3">Führe diesen SQL in deinem Supabase-Dashboard aus:</p>
      <pre className="bg-gray-900 text-gray-300 text-xs p-4 rounded-xl overflow-x-auto">{`create table reservations (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid references restaurants(id) on delete cascade,
  name text not null,
  phone text not null,
  email text,
  date date not null,
  time text not null,
  guests int not null default 2,
  notes text,
  status text default 'pending',
  created_at timestamptz default now()
);
alter table reservations enable row level security;
create policy "chef_all" on reservations for all using (true);`}</pre>
    </div>
  );

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold text-white">Reservierungen</h2>
          <p className="text-gray-400 text-sm mt-0.5">Tischreservierungen verwalten</p>
        </div>
        <button onClick={() => setShowForm(true)}
          className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white px-4 py-2.5 rounded-xl font-medium text-sm transition-colors">
          <Plus size={16} /> Neue Reservierung
        </button>
      </div>

      {/* Datum-Navigation */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <button onClick={() => offsetDate(-1)} className="w-8 h-8 rounded-lg bg-gray-800 hover:bg-gray-700 flex items-center justify-center text-gray-400 hover:text-white transition-colors">
              <ChevronLeft size={16} />
            </button>
            <input type="date" value={filterDate} onChange={e => setFilterDate(e.target.value)}
              className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-white text-sm focus:outline-none focus:border-orange-500" />
            <button onClick={() => offsetDate(1)} className="w-8 h-8 rounded-lg bg-gray-800 hover:bg-gray-700 flex items-center justify-center text-gray-400 hover:text-white transition-colors">
              <ChevronRight size={16} />
            </button>
            <button onClick={() => setFilterDate(new Date().toISOString().slice(0, 10))}
              className="text-xs text-orange-400 hover:text-orange-300 px-2 py-1 border border-orange-500/30 rounded-lg transition-colors">
              Heute
            </button>
          </div>
          <div className="flex gap-3 text-sm">
            <span className="text-gray-400">Gäste gesamt: <strong className="text-white">{todayTotal}</strong></span>
            <span className="text-green-400">{confirmed} bestätigt</span>
            <span className="text-yellow-400">{pending} ausstehend</span>
          </div>
        </div>
      </div>

      {/* Filter-Zeile */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search size={14} className="absolute left-3 top-3 text-gray-500" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Name oder Telefon suchen…"
            className="w-full bg-gray-900 border border-gray-800 rounded-xl pl-9 pr-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-orange-500" />
        </div>
        <div className="flex rounded-xl bg-gray-900 border border-gray-800 p-1 gap-1">
          {(["all", "pending", "confirmed", "cancelled"] as const).map(s => (
            <button key={s} onClick={() => setFilterStatus(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${filterStatus === s ? "bg-orange-500 text-white" : "text-gray-400 hover:text-white"}`}>
              {s === "all" ? "Alle" : STATUS_LABEL[s]}
            </button>
          ))}
        </div>
      </div>

      {/* Liste */}
      {loading ? (
        <div className="text-center py-12 text-gray-500">Lädt…</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-600">
          <CalendarDays size={40} className="mx-auto mb-3 opacity-40" />
          <p>Keine Reservierungen für diesen Tag</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(r => (
            <div key={r.id} className="bg-gray-900 border border-gray-800 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center gap-4">
              {/* Zeit + Gäste */}
              <div className="flex items-center gap-4 shrink-0">
                <div className="text-center">
                  <div className="text-xl font-bold text-white">{r.time}</div>
                  <div className="flex items-center gap-1 text-gray-400 text-xs mt-0.5">
                    <Users size={11} /> {r.guests} Gäste
                  </div>
                </div>
              </div>

              <div className="w-px h-10 bg-gray-800 hidden sm:block shrink-0" />

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-white">{r.name}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full border ${STATUS_STYLE[r.status]}`}>
                    {STATUS_LABEL[r.status]}
                  </span>
                </div>
                <div className="flex items-center gap-3 mt-1 text-gray-400 text-xs flex-wrap">
                  <span className="flex items-center gap-1"><Phone size={11} />{r.phone}</span>
                  {r.email && <span>{r.email}</span>}
                  {r.notes && <span className="flex items-center gap-1"><StickyNote size={11} />{r.notes}</span>}
                </div>
              </div>

              {/* Aktionen */}
              <div className="flex items-center gap-2 shrink-0">
                {r.status !== "confirmed" && (
                  <button onClick={() => setStatus(r.id, "confirmed")}
                    className="w-8 h-8 rounded-lg bg-green-500/15 hover:bg-green-500/30 text-green-400 flex items-center justify-center transition-colors" title="Bestätigen">
                    <Check size={14} />
                  </button>
                )}
                {r.status !== "cancelled" && (
                  <button onClick={() => setStatus(r.id, "cancelled")}
                    className="w-8 h-8 rounded-lg bg-red-500/15 hover:bg-red-500/30 text-red-400 flex items-center justify-center transition-colors" title="Stornieren">
                    <X size={14} />
                  </button>
                )}
                <button onClick={() => remove(r.id)}
                  className="w-8 h-8 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-red-400 flex items-center justify-center transition-colors" title="Löschen">
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Neue Reservierung Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={e => { if (e.target === e.currentTarget) setShowForm(false); }}>
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 w-full max-w-md space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-white">Neue Reservierung</h3>
              <button onClick={() => setShowForm(false)} className="text-gray-500 hover:text-white"><X size={18} /></button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="text-xs text-gray-400 mb-1 block">Name *</label>
                <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="Max Mustermann"
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-orange-500" />
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Telefon *</label>
                <input value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} placeholder="0170 1234567"
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-orange-500" />
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-1 block">E-Mail</label>
                <input value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} placeholder="optional"
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-orange-500" />
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Datum *</label>
                <input type="date" value={form.date} onChange={e => setForm(p => ({ ...p, date: e.target.value }))}
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-orange-500" />
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Uhrzeit *</label>
                <select value={form.time} onChange={e => setForm(p => ({ ...p, time: e.target.value }))}
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-orange-500">
                  {TIMES.map(t => <option key={t} value={t}>{t} Uhr</option>)}
                </select>
              </div>
              <div className="col-span-2">
                <label className="text-xs text-gray-400 mb-1 block">Personenanzahl *</label>
                <div className="flex items-center gap-3">
                  <button onClick={() => setForm(p => ({ ...p, guests: Math.max(1, p.guests - 1) }))}
                    className="w-9 h-9 rounded-xl bg-gray-800 hover:bg-gray-700 text-white font-bold flex items-center justify-center">−</button>
                  <span className="text-white font-bold text-lg w-8 text-center">{form.guests}</span>
                  <button onClick={() => setForm(p => ({ ...p, guests: Math.min(50, p.guests + 1) }))}
                    className="w-9 h-9 rounded-xl bg-gray-800 hover:bg-gray-700 text-white font-bold flex items-center justify-center">+</button>
                  <span className="text-gray-400 text-sm">Personen</span>
                </div>
              </div>
              <div className="col-span-2">
                <label className="text-xs text-gray-400 mb-1 block">Anmerkungen</label>
                <textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
                  placeholder="Allergien, Sonderwünsche, Anlass…" rows={2}
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-orange-500 resize-none" />
              </div>
            </div>

            <div className="flex gap-3 pt-1">
              <button onClick={() => setShowForm(false)} className="flex-1 py-2.5 rounded-xl border border-gray-700 text-gray-400 hover:text-white text-sm transition-colors">
                Abbrechen
              </button>
              <button onClick={save} disabled={saving}
                className="flex-1 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white py-2.5 rounded-xl text-sm font-semibold transition-colors">
                {saving ? "Speichert…" : "Speichern"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
