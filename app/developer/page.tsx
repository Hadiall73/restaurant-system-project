"use client";
import { useEffect, useState } from "react";
import { useStore } from "@/lib/store";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import {
  Plus, ChefHat, LogOut, Activity, Users, Building2, Eye, EyeOff,
  Trash2, ArrowLeft, Euro, Edit2, Check, X, RefreshCw, Key,
  Copy, CheckCircle, Sparkles, ShieldCheck, Clock, Ban, LifeBuoy,
  MessageCircle, Send, ChevronDown, ChevronUp,
} from "lucide-react";
import toast, { Toaster } from "react-hot-toast";

type Tab = "create" | "restaurants" | "licenses" | "support";

export default function DeveloperPage() {
  const { profile, clear } = useStore();
  const router = useRouter();

  const [tab, setTab]                         = useState<Tab>("restaurants");
  const [restaurants, setRestaurants]         = useState<any[]>([]);
  const [licenses, setLicenses]               = useState<any[]>([]);
  const [selectedRestaurant, setSelectedRestaurant] = useState<any>(null);
  const [detail, setDetail]                   = useState<{ members: any[]; sales: any[]; shifts: any[] } | null>(null);
  const [detailLoading, setDetailLoading]     = useState(false);
  const [editName, setEditName]               = useState("");
  const [editingName, setEditingName]         = useState(false);
  const [licenseLoading, setLicenseLoading]   = useState(false);
  const [copiedKey, setCopiedKey]             = useState("");

  // Create-Access-Formular (manuell)
  const [restaurantName, setRestaurantName]   = useState("");
  const [chefName, setChefName]               = useState("");
  const [chefEmail, setChefEmail]             = useState("");
  const [chefPassword, setChefPassword]       = useState("");
  const [showPw, setShowPw]                   = useState(false);
  const [creating, setCreating]               = useState(false);

  // Lizenz-Generator
  const [licDays, setLicDays]                 = useState("365");
  const [licNotes, setLicNotes]               = useState("");
  const [licCount, setLicCount]               = useState("1");
  const [generatingLic, setGeneratingLic]     = useState(false);
  const [newKeys, setNewKeys]                 = useState<string[]>([]);

  // Support
  const [tickets,         setTickets]         = useState<any[]>([]);
  const [ticketsLoading,  setTicketsLoading]  = useState(false);
  const [expandedTicket,  setExpandedTicket]  = useState<string | null>(null);
  const [replyText,       setReplyText]       = useState<Record<string, string>>({});
  const [sendingReply,    setSendingReply]    = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      if (!data.session) { router.replace("/auth"); return; }

      const res  = await fetch("/api/auth/ensure-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${data.session.access_token}` },
        body: JSON.stringify({ user_id: data.session.user.id, email: data.session.user.email }),
      });
      const json = await res.json();
      const role = json.profile?.role;

      if (role === "chef")     { router.replace("/chef");     return; }
      if (role === "employee") { router.replace("/employee"); return; }
      if (role !== "developer") { router.replace("/auth");   return; }
    });
  }, []);

  useEffect(() => {
    if (profile?.email) { loadRestaurants(); loadLicenses(); loadTickets(); }
  }, [profile?.email]);

  async function loadRestaurants() {
    const res  = await fetch(`/api/admin/restaurants?developer_email=${encodeURIComponent(profile?.email || "")}`);
    const json = await res.json();
    if (json.restaurants) setRestaurants(json.restaurants);
  }

  async function loadLicenses() {
    const res  = await fetch("/api/keys", {
      headers: { "x-developer-email": profile?.email || "" },
    });
    const json = await res.json();
    if (json.keys) setLicenses(json.keys);
  }

  async function loadTickets() {
    setTicketsLoading(true);
    const res  = await fetch(`/api/support?developer_email=${encodeURIComponent(profile?.email || "")}`);
    const json = await res.json();
    if (json.tickets) setTickets(json.tickets);
    setTicketsLoading(false);
  }

  async function replyToTicket(ticketId: string) {
    const reply = replyText[ticketId]?.trim();
    if (!reply) return;
    setSendingReply(ticketId);
    const res = await fetch("/api/support", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ developer_email: profile?.email, ticket_id: ticketId, developer_reply: reply }),
    });
    const json = await res.json();
    if (json.success) {
      toast.success("Antwort gesendet");
      setReplyText(prev => ({ ...prev, [ticketId]: "" }));
      loadTickets();
    } else {
      toast.error(json.error || "Fehler");
    }
    setSendingReply(null);
  }

  async function setTicketStatus(ticketId: string, status: string) {
    await fetch("/api/support", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ developer_email: profile?.email, ticket_id: ticketId, status }),
    });
    loadTickets();
  }

  async function openRestaurant(r: any) {
    setSelectedRestaurant(r); setEditName(r.name); setDetailLoading(true);
    const res  = await fetch(`/api/admin/restaurant-detail?developer_email=${encodeURIComponent(profile?.email || "")}&restaurant_id=${r.id}`);
    const json = await res.json();
    setDetail(json); setDetailLoading(false);
  }

  async function saveName() {
    if (!editName.trim() || !selectedRestaurant) return;
    const res  = await fetch("/api/admin/restaurant-detail", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ developer_email: profile?.email, restaurant_id: selectedRestaurant.id, updates: { name: editName } }),
    });
    const json = await res.json();
    if (json.success) {
      toast.success("Name gespeichert");
      setSelectedRestaurant({ ...selectedRestaurant, name: editName });
      setEditingName(false); loadRestaurants();
    } else { toast.error(json.error || "Fehler"); }
  }

  async function deleteSale(saleId: string) {
    const res  = await fetch("/api/admin/restaurant-detail", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ developer_email: profile?.email, sale_id: saleId }),
    });
    const json = await res.json();
    if (json.success) {
      toast.success("Eintrag gelöscht");
      setDetail(prev => prev ? { ...prev, sales: prev.sales.filter(s => s.id !== saleId) } : prev);
    } else { toast.error(json.error || "Fehler"); }
  }

  async function createAccess() {
    if (!restaurantName.trim() || !chefName.trim() || !chefEmail.trim() || !chefPassword.trim()) {
      toast.error("Alle Felder ausfüllen"); return;
    }
    if (chefPassword.length < 6) { toast.error("Passwort min. 6 Zeichen"); return; }
    setCreating(true);
    const res  = await fetch("/api/admin/create-access", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ developer_email: profile?.email, restaurant_name: restaurantName, chef_name: chefName, chef_email: chefEmail, chef_password: chefPassword }),
    });
    const data = await res.json();
    if (data.success) {
      toast.success(`Zugang erstellt! Code: ${data.invite_code}`);
      setRestaurantName(""); setChefName(""); setChefEmail(""); setChefPassword("");
      loadRestaurants(); setTab("restaurants");
    } else { toast.error(data.error || "Fehler beim Erstellen"); }
    setCreating(false);
  }

  async function generateLicenses() {
    const count = Math.min(Math.max(parseInt(licCount) || 1, 1), 10);
    setGeneratingLic(true); setNewKeys([]);
    const generated: string[] = [];
    try {
      for (let i = 0; i < count; i++) {
        const res  = await fetch("/api/keys", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            notes:          licNotes || undefined,
            expires_days:   licDays ? parseInt(licDays) : undefined,
            developer_email: profile?.email,
          }),
        });
        const json = await res.json();
        if (json.key) generated.push(json.key.key);
      }
      setNewKeys(generated);
      toast.success(`${generated.length} Lizenzschlüssel erstellt`);
      loadLicenses();
    } catch { toast.error("Fehler beim Generieren"); }
    setGeneratingLic(false);
  }

  async function deactivateRestaurant(id: string) {
    await fetch("/api/admin/restaurants", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ developer_email: profile?.email, id, is_active: false }),
    });
    toast.success("Restaurant deaktiviert");
    loadRestaurants();
  }

  function copyKey(key: string) {
    navigator.clipboard.writeText(key);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(""), 2000);
    toast.success("Schlüssel kopiert!");
  }

  async function logout() {
    await supabase.auth.signOut(); clear(); router.push("/auth");
  }

  // ── Übersichtszahlen ──────────────────────────────────────────────────────
  const activeRestaurants  = restaurants.filter(r => r.is_active).length;
  const totalMembers       = restaurants.reduce((s, r) => s + (r.restaurant_members?.[0]?.count || 0), 0);
  const usedLicenses       = licenses.filter(l => l.restaurant_id).length;
  const availableLicenses  = licenses.filter(l => !l.restaurant_id).length;
  const openTickets        = tickets.filter(t => t.status === "open" || t.status === "in_progress").length;

  // ── Restaurant Detail View ────────────────────────────────────────────────
  if (selectedRestaurant) {
    const totalSales = detail?.sales.reduce((s, r) => s + Number(r.amount), 0) || 0;
    return (
      <div className="min-h-screen bg-gray-950">
        <Toaster position="top-right" />
        <div className="bg-gray-900 border-b border-gray-800 px-6 py-4 flex items-center gap-4">
          <button onClick={() => { setSelectedRestaurant(null); setDetail(null); }}
            className="text-gray-400 hover:text-white p-2 rounded-xl hover:bg-gray-800 transition-colors">
            <ArrowLeft size={18} />
          </button>
          <div className="flex items-center gap-3 flex-1">
            <div className="w-9 h-9 rounded-xl bg-orange-500/20 flex items-center justify-center">
              <Building2 size={18} className="text-orange-400" />
            </div>
            {editingName ? (
              <div className="flex items-center gap-2">
                <input value={editName} onChange={e => setEditName(e.target.value)}
                  className="bg-gray-800 border border-orange-500 rounded-lg px-3 py-1.5 text-white text-sm focus:outline-none w-56" />
                <button onClick={saveName} className="text-green-400 hover:text-green-300 p-1"><Check size={16} /></button>
                <button onClick={() => { setEditingName(false); setEditName(selectedRestaurant.name); }} className="text-red-400 hover:text-red-300 p-1"><X size={16} /></button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <p className="text-white font-bold">{selectedRestaurant.name}</p>
                <button onClick={() => setEditingName(true)} className="text-gray-500 hover:text-orange-400 transition-colors"><Edit2 size={14} /></button>
              </div>
            )}
            <span className={`text-xs px-2 py-1 rounded-full ml-2 ${selectedRestaurant.is_active ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"}`}>
              {selectedRestaurant.is_active ? "Aktiv" : "Inaktiv"}
            </span>
            {(() => {
              const trialEnd  = selectedRestaurant.trial_ends_at ? new Date(selectedRestaurant.trial_ends_at) : null;
              const trialLeft = trialEnd ? Math.ceil((trialEnd.getTime() - Date.now()) / 86400000) : null;
              if (selectedRestaurant.is_paid) return <span className="text-xs px-2 py-1 rounded-full bg-green-500/20 text-green-400 border border-green-500/30">Bezahlt</span>;
              if (trialLeft !== null && trialLeft > 0) return <span className="text-xs px-2 py-1 rounded-full bg-orange-500/20 text-orange-300 border border-orange-500/30">{trialLeft}T Trial</span>;
              if (trialLeft !== null && trialLeft <= 0) return <span className="text-xs px-2 py-1 rounded-full bg-red-500/20 text-red-400 border border-red-500/30">Trial abgelaufen</span>;
              return null;
            })()}
          </div>
          <button onClick={() => openRestaurant(selectedRestaurant)} className="text-gray-400 hover:text-white p-2 rounded-xl hover:bg-gray-800 transition-colors">
            <RefreshCw size={16} />
          </button>
          <button onClick={logout} className="text-gray-400 hover:text-white p-2 rounded-xl hover:bg-gray-800 transition-colors">
            <LogOut size={18} />
          </button>
        </div>

        <div className="max-w-5xl mx-auto p-6 space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: "Einladungscode", value: selectedRestaurant.invite_code, mono: true },
              { label: "E-Mail",         value: selectedRestaurant.email || "—",  mono: false },
              { label: "Erstellt",       value: new Date(selectedRestaurant.created_at).toLocaleDateString("de-DE"), mono: false },
              { label: "Umsatz (letzte 50)", value: `${totalSales.toFixed(2)} €`, mono: false },
            ].map(c => (
              <div key={c.label} className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
                <p className="text-gray-400 text-xs mb-1">{c.label}</p>
                <p className={`text-white font-semibold text-sm ${c.mono ? "font-mono text-orange-400" : ""}`}>{c.value}</p>
              </div>
            ))}
          </div>

          {detailLoading ? (
            <div className="text-center text-gray-500 py-12">Lade Daten...</div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
                <div className="p-4 border-b border-gray-800 flex items-center gap-2">
                  <Users size={16} className="text-blue-400" />
                  <h3 className="font-semibold text-white">Mitglieder ({detail?.members.length || 0})</h3>
                </div>
                <div className="divide-y divide-gray-800/50">
                  {detail?.members.length === 0 && <p className="p-6 text-gray-500 text-sm text-center">Keine Mitglieder</p>}
                  {detail?.members.map(m => (
                    <div key={m.id} className="p-4 flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-gray-700 flex items-center justify-center text-white text-xs font-bold">
                        {m.profiles?.name?.charAt(0) || "?"}
                      </div>
                      <div className="flex-1">
                        <p className="text-white text-sm font-medium">{m.profiles?.name || "Unbekannt"}</p>
                        <p className="text-gray-400 text-xs">{m.profiles?.email || "—"}</p>
                      </div>
                      <div className="text-right">
                        <span className={`text-xs px-2 py-1 rounded-full ${m.role === "chef" ? "bg-orange-500/20 text-orange-400" : "bg-blue-500/20 text-blue-400"}`}>
                          {m.role}
                        </span>
                        <p className="text-gray-500 text-xs mt-1">{m.position || "—"} · {Number(m.hourly_wage).toFixed(2)}€/h</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
                <div className="p-4 border-b border-gray-800 flex items-center gap-2">
                  <Euro size={16} className="text-orange-400" />
                  <h3 className="font-semibold text-white">Letzte Umsätze ({detail?.sales.length || 0})</h3>
                </div>
                <div className="divide-y divide-gray-800/50 max-h-80 overflow-y-auto">
                  {detail?.sales.length === 0 && <p className="p-6 text-gray-500 text-sm text-center">Keine Umsätze</p>}
                  {detail?.sales.map(s => (
                    <div key={s.id} className="px-4 py-3 flex items-center gap-3 hover:bg-gray-800/30 transition-colors">
                      <div className="flex-1">
                        <p className="text-white text-sm font-semibold">{Number(s.amount).toFixed(2)} €</p>
                        <p className="text-gray-400 text-xs">
                          {s.payment_method === "cash" ? "Bar" : s.payment_method === "card" ? "Karte" : "Online"}
                          {s.table_number ? ` · Tisch ${s.table_number}` : ""}
                          {" · "}{new Date(s.recorded_at).toLocaleString("de-DE", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                        </p>
                      </div>
                      <button onClick={() => deleteSale(s.id)} className="text-gray-600 hover:text-red-400 transition-colors p-1">
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── Hauptansicht ──────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-950">
      <Toaster position="top-right" />

      {/* Header */}
      <div className="bg-gray-900 border-b border-gray-800 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-orange-500 flex items-center justify-center">
            <ChefHat size={18} className="text-white" />
          </div>
          <div>
            <p className="text-white font-bold">Developer Panel</p>
            <p className="text-gray-400 text-xs">{profile?.email}</p>
          </div>
        </div>
        <button onClick={logout} className="text-gray-400 hover:text-white p-2 rounded-xl hover:bg-gray-800 transition-colors">
          <LogOut size={18} />
        </button>
      </div>

      <div className="max-w-5xl mx-auto p-6 space-y-6">

        {/* KPI-Übersicht */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {[
            { label: "Restaurants gesamt", value: restaurants.length,     icon: Building2,  color: "text-orange-400" },
            { label: "Aktiv",              value: activeRestaurants,       icon: Activity,   color: "text-green-400"  },
            { label: "Mitarbeiter",        value: totalMembers,            icon: Users,      color: "text-blue-400"   },
            { label: "Lizenzen verfügbar", value: availableLicenses,       icon: Key,        color: "text-purple-400" },
            { label: "Nachrichten offen",   value: openTickets,             icon: LifeBuoy,   color: "text-blue-400"  },
          ].map(k => (
            <div key={k.label} className="bg-gray-900 border border-gray-800 rounded-2xl p-4 flex items-center gap-3">
              <k.icon size={22} className={k.color} />
              <div>
                <p className="text-gray-400 text-xs">{k.label}</p>
                <p className="text-white font-bold text-2xl">{k.value}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex gap-2">
          {([
            ["restaurants", "Restaurants",         Building2],
            ["licenses",    "Lizenzschlüssel",      Key],
            ["support",     "Support",              LifeBuoy],
            ["create",      "Manuell erstellen",    Plus],
          ] as const).map(([k, l, Icon]) => (
            <button key={k} onClick={() => setTab(k)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${tab === k ? "bg-orange-500 text-white" : "bg-gray-800 text-gray-400 hover:text-white"}`}>
              <Icon size={14} /> {l}
              {k === "licenses" && availableLicenses > 0 && (
                <span className="bg-purple-500/30 text-purple-300 text-xs px-1.5 py-0.5 rounded-full">{availableLicenses}</span>
              )}
              {k === "support" && openTickets > 0 && (
                <span className="bg-blue-500/30 text-blue-300 text-xs px-1.5 py-0.5 rounded-full">{openTickets}</span>
              )}
            </button>
          ))}
        </div>

        {/* ── TAB: Restaurants ── */}
        {tab === "restaurants" && (
          <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
            <div className="p-4 border-b border-gray-800 flex items-center justify-between">
              <h3 className="font-semibold text-white">Alle Restaurants ({restaurants.length})</h3>
              <button onClick={loadRestaurants} className="text-gray-500 hover:text-white p-1.5 rounded-lg hover:bg-gray-800 transition-colors">
                <RefreshCw size={14} />
              </button>
            </div>
            <div className="divide-y divide-gray-800/50">
              {restaurants.map(r => {
                const trialEnd   = r.trial_ends_at ? new Date(r.trial_ends_at) : null;
                const trialLeft  = trialEnd ? Math.ceil((trialEnd.getTime() - Date.now()) / 86400000) : null;
                const inTrial    = trialLeft !== null && trialLeft > 0 && !r.is_paid;
                const trialOver  = trialLeft !== null && trialLeft <= 0 && !r.is_paid;
                return (
                  <div key={r.id} className="p-4 flex items-center gap-4 hover:bg-gray-800/30 transition-colors cursor-pointer" onClick={() => openRestaurant(r)}>
                    <div className="w-10 h-10 rounded-xl bg-orange-500/20 flex items-center justify-center">
                      <Building2 size={18} className="text-orange-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-medium">{r.name}</p>
                      <p className="text-gray-400 text-xs truncate">{r.email || "—"} · {new Date(r.created_at).toLocaleDateString("de-DE")}</p>
                      <p className="text-gray-500 text-xs font-mono">Code: <span className="text-orange-400">{r.invite_code}</span></p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {r.is_paid
                        ? <span className="text-xs px-2 py-1 rounded-full bg-green-500/20 text-green-400 border border-green-500/30">Bezahlt</span>
                        : inTrial
                          ? <span className="text-xs px-2 py-1 rounded-full bg-orange-500/20 text-orange-300 border border-orange-500/30">{trialLeft}T Trial</span>
                          : trialOver
                            ? <span className="text-xs px-2 py-1 rounded-full bg-red-500/20 text-red-400 border border-red-500/30">Trial abgelaufen</span>
                            : null
                      }
                      <div className="flex items-center gap-1 text-gray-400 text-xs">
                        <Users size={12} /> {r.restaurant_members?.[0]?.count || 0}
                      </div>
                      <span className={`text-xs px-2 py-1 rounded-full ${r.is_active ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"}`}>
                        {r.is_active ? "Aktiv" : "Inaktiv"}
                      </span>
                      {r.is_active && (
                        <button onClick={e => { e.stopPropagation(); deactivateRestaurant(r.id); }}
                          className="text-gray-500 hover:text-red-400 transition-colors p-1">
                          <Ban size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
              {restaurants.length === 0 && (
                <p className="p-8 text-center text-gray-500 text-sm">Noch keine Restaurants</p>
              )}
            </div>
          </div>
        )}

        {/* ── TAB: Lizenzschlüssel ── */}
        {tab === "licenses" && (
          <div className="space-y-5">

            {/* Generator */}
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
              <h3 className="font-semibold text-white mb-5 flex items-center gap-2">
                <Sparkles size={16} className="text-orange-400" /> Neue Lizenzschlüssel generieren
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div>
                  <label className="text-gray-400 text-xs mb-1.5 block">Gültigkeitsdauer (Tage)</label>
                  <input value={licDays} onChange={e => setLicDays(e.target.value)} type="number" placeholder="365"
                    className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-orange-500 transition-colors" />
                </div>
                <div>
                  <label className="text-gray-400 text-xs mb-1.5 block">Anzahl Schlüssel</label>
                  <input value={licCount} onChange={e => setLicCount(e.target.value)} type="number" min="1" max="10"
                    className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-orange-500 transition-colors" />
                </div>
                <div>
                  <label className="text-gray-400 text-xs mb-1.5 block">Notiz (optional)</label>
                  <input value={licNotes} onChange={e => setLicNotes(e.target.value)} placeholder="z.B. Kunde XY"
                    className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-orange-500 transition-colors" />
                </div>
              </div>

              <button onClick={generateLicenses} disabled={generatingLic}
                className="bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white px-6 py-2.5 rounded-xl text-sm font-semibold transition-colors flex items-center gap-2">
                {generatingLic ? <><RefreshCw size={14} className="animate-spin" /> Generiere...</> : <><Key size={14} /> Schlüssel generieren</>}
              </button>

              {/* Neue Schlüssel anzeigen */}
              {newKeys.length > 0 && (
                <div className="mt-4 p-4 bg-green-500/10 border border-green-500/20 rounded-xl space-y-2">
                  <p className="text-green-400 text-xs font-semibold flex items-center gap-1.5">
                    <CheckCircle size={12} /> {newKeys.length} Schlüssel erstellt — jetzt an Kunden senden:
                  </p>
                  {newKeys.map(k => (
                    <div key={k} className="flex items-center gap-3 bg-gray-900 rounded-lg px-3 py-2">
                      <code className="text-orange-400 font-mono text-sm flex-1 tracking-wider">{k}</code>
                      <button onClick={() => copyKey(k)}
                        className="text-gray-400 hover:text-white transition-colors flex items-center gap-1 text-xs">
                        {copiedKey === k ? <><CheckCircle size={13} className="text-green-400" /><span className="text-green-400">Kopiert</span></> : <><Copy size={13} /> Kopieren</>}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Alle Schlüssel */}
            <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
              <div className="p-4 border-b border-gray-800 flex items-center justify-between">
                <h3 className="font-semibold text-white">Alle Schlüssel ({licenses.length})</h3>
                <div className="flex items-center gap-3 text-xs text-gray-500">
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500 inline-block" /> Verfügbar: {availableLicenses}</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-gray-500 inline-block" /> Genutzt: {usedLicenses}</span>
                </div>
              </div>
              <div className="divide-y divide-gray-800/50 max-h-96 overflow-y-auto">
                {licenses.length === 0 && <p className="p-8 text-center text-gray-500 text-sm">Noch keine Schlüssel</p>}
                {licenses.map(l => {
                  const isUsed  = !!l.restaurant_id;
                  const expired = l.expires_at && new Date(l.expires_at) < new Date();
                  return (
                    <div key={l.id} className="px-4 py-3 flex items-center gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <code className="text-orange-400 font-mono text-sm tracking-wider">{l.key}</code>
                          <button onClick={() => copyKey(l.key)} className="text-gray-600 hover:text-white transition-colors">
                            {copiedKey === l.key ? <CheckCircle size={12} className="text-green-400" /> : <Copy size={12} />}
                          </button>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                          {isUsed
                            ? <span className="text-xs text-gray-400 flex items-center gap-1"><ShieldCheck size={10} className="text-green-400" /> {l.restaurants?.name || "Restaurant"}</span>
                            : <span className="text-xs text-gray-500 flex items-center gap-1"><Key size={10} /> Noch nicht genutzt</span>
                          }
                          {l.expires_at && (
                            <span className={`text-xs flex items-center gap-1 ${expired ? "text-red-400" : "text-gray-500"}`}>
                              <Clock size={10} /> {expired ? "Abgelaufen" : `bis ${new Date(l.expires_at).toLocaleDateString("de-DE")}`}
                            </span>
                          )}
                          {l.notes && <span className="text-xs text-gray-500">· {l.notes}</span>}
                        </div>
                      </div>
                      <div className={`w-2 h-2 rounded-full shrink-0 ${isUsed ? "bg-gray-500" : expired ? "bg-red-500" : "bg-green-500"}`} />
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ── TAB: Support ── */}
        {tab === "support" && (
          <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
            <div className="p-4 border-b border-gray-800 flex items-center justify-between">
              <h3 className="font-semibold text-white flex items-center gap-2">
                <LifeBuoy size={16} className="text-blue-400" /> Support-Nachrichten ({tickets.length})
                {openTickets > 0 && <span className="text-xs bg-blue-500/20 text-blue-400 border border-blue-500/30 px-2 py-0.5 rounded-full">{openTickets} offen</span>}
              </h3>
              <button onClick={loadTickets} className="text-gray-500 hover:text-white p-1.5 rounded-lg hover:bg-gray-800 transition-colors">
                <RefreshCw size={14} />
              </button>
            </div>

            {ticketsLoading ? (
              <div className="p-8 text-center text-gray-500 text-sm">Lade...</div>
            ) : tickets.length === 0 ? (
              <div className="p-8 text-center text-gray-500 text-sm">Keine Nachrichten</div>
            ) : (
              <div className="divide-y divide-gray-800/50">
                {tickets.map(t => {
                  const isOpen   = expandedTicket === t.id;
                  const statusColors: Record<string, string> = {
                    open:        "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
                    in_progress: "bg-blue-500/20 text-blue-400 border-blue-500/30",
                    answered:    "bg-green-500/20 text-green-400 border-green-500/30",
                    closed:      "bg-gray-500/20 text-gray-400 border-gray-500/30",
                  };
                  const statusLabels: Record<string, string> = {
                    open: "Offen", in_progress: "In Bearbeitung", answered: "Beantwortet", closed: "Erledigt",
                  };
                  return (
                    <div key={t.id}>
                      <button onClick={() => setExpandedTicket(isOpen ? null : t.id)}
                        className="w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-800/30 transition-colors text-left">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                            <p className="text-white text-sm font-medium truncate">{t.subject}</p>
                            <span className={`text-xs px-2 py-0.5 rounded-full border ${statusColors[t.status] || statusColors.open}`}>
                              {statusLabels[t.status] || t.status}
                            </span>
                          </div>
                          <p className="text-gray-400 text-xs">
                            {t.restaurants?.name || "—"} · {t.profiles?.name || "—"}
                            {" · "}{new Date(t.created_at).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                          </p>
                        </div>
                        {isOpen ? <ChevronUp size={16} className="text-gray-500 shrink-0" /> : <ChevronDown size={16} className="text-gray-500 shrink-0" />}
                      </button>

                      {isOpen && (
                        <div className="px-4 pb-4 space-y-3">
                          {/* Nachricht des Chefs */}
                          <div className="bg-gray-800/50 rounded-xl p-3">
                            <p className="text-gray-400 text-xs mb-1 font-medium">Nachricht:</p>
                            <p className="text-gray-200 text-sm whitespace-pre-wrap">{t.message}</p>
                          </div>

                          {/* Bestehende Antwort */}
                          {t.developer_reply && (
                            <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-3">
                              <p className="text-blue-400 text-xs mb-1 font-medium">Deine Antwort:</p>
                              <p className="text-gray-200 text-sm whitespace-pre-wrap">{t.developer_reply}</p>
                            </div>
                          )}

                          {/* Antwort-Formular */}
                          <div className="space-y-2">
                            <textarea
                              value={replyText[t.id] || ""}
                              onChange={e => setReplyText(prev => ({ ...prev, [t.id]: e.target.value }))}
                              placeholder="Antwort schreiben..."
                              rows={3}
                              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-colors resize-none"
                            />
                            <div className="flex items-center gap-2">
                              <button onClick={() => replyToTicket(t.id)} disabled={sendingReply === t.id || !replyText[t.id]?.trim()}
                                className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-4 py-2 rounded-xl text-xs font-semibold transition-colors flex items-center gap-1.5">
                                {sendingReply === t.id ? <><RefreshCw size={12} className="animate-spin" /> Sende...</> : <><Send size={12} /> Antworten</>}
                              </button>
                              {t.status !== "closed" && (
                                <button onClick={() => setTicketStatus(t.id, "closed")}
                                  className="bg-gray-700 hover:bg-gray-600 text-gray-300 px-4 py-2 rounded-xl text-xs font-semibold transition-colors">
                                  Als erledigt markieren
                                </button>
                              )}
                              {t.status === "closed" && (
                                <button onClick={() => setTicketStatus(t.id, "open")}
                                  className="bg-gray-700 hover:bg-gray-600 text-gray-300 px-4 py-2 rounded-xl text-xs font-semibold transition-colors">
                                  Wieder öffnen
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── TAB: Manuell erstellen ── */}
        {tab === "create" && (
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
            <h3 className="font-semibold text-white mb-1 flex items-center gap-2">
              <Plus size={16} className="text-orange-400" /> Zugang manuell erstellen
            </h3>
            <p className="text-gray-500 text-xs mb-5">Für Kunden ohne Self-Onboarding — du setzt alles direkt auf.</p>
            <div className="space-y-4">
              <div>
                <label className="text-gray-400 text-sm block mb-1.5">Restaurant Name</label>
                <input value={restaurantName} onChange={e => setRestaurantName(e.target.value)} placeholder="z.B. Trattoria Roma"
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-orange-500 transition-colors" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-gray-400 text-sm block mb-1.5">Chef Name</label>
                  <input value={chefName} onChange={e => setChefName(e.target.value)} placeholder="z.B. Marco Rossi"
                    className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-orange-500 transition-colors" />
                </div>
                <div>
                  <label className="text-gray-400 text-sm block mb-1.5">Chef E-Mail</label>
                  <input value={chefEmail} onChange={e => setChefEmail(e.target.value)} placeholder="chef@restaurant.de" type="email"
                    className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-orange-500 transition-colors" />
                </div>
              </div>
              <div>
                <label className="text-gray-400 text-sm block mb-1.5">Passwort für Chef</label>
                <div className="relative">
                  <input value={chefPassword} onChange={e => setChefPassword(e.target.value)}
                    type={showPw ? "text" : "password"} placeholder="Mindestens 6 Zeichen"
                    className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 pr-10 text-white focus:outline-none focus:border-orange-500 transition-colors" />
                  <button onClick={() => setShowPw(!showPw)} className="absolute right-3 top-3.5 text-gray-400 hover:text-white">
                    {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
              <button onClick={createAccess} disabled={creating}
                className="w-full bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white py-3 rounded-xl font-semibold transition-colors">
                {creating ? "Erstelle Zugang..." : "Zugang erstellen"}
              </button>
              <p className="text-gray-500 text-xs text-center">Der Chef kann sich sofort anmelden. Kein Lizenzschlüssel nötig.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
