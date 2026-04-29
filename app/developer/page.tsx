"use client";
import { useEffect, useState } from "react";
import { useStore } from "@/lib/store";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Plus, ChefHat, LogOut, Activity, Users, Building2, Eye, EyeOff, Trash2, ArrowLeft, Euro, Edit2, Check, X, RefreshCw } from "lucide-react";
import toast, { Toaster } from "react-hot-toast";

export default function DeveloperPage() {
  const { profile, clear } = useStore();
  const router = useRouter();
  const [restaurants, setRestaurants] = useState<any[]>([]);
  const [tab, setTab] = useState<"create" | "restaurants">("create");
  const [selectedRestaurant, setSelectedRestaurant] = useState<any>(null);
  const [detail, setDetail] = useState<{ members: any[]; sales: any[]; shifts: any[] } | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [editName, setEditName] = useState("");
  const [editingName, setEditingName] = useState(false);

  // Create form
  const [restaurantName, setRestaurantName] = useState("");
  const [chefName, setChefName] = useState("");
  const [chefEmail, setChefEmail] = useState("");
  const [chefPassword, setChefPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) { router.push("/auth"); return; }
    });
  }, []);

  useEffect(() => {
    if (profile?.email) loadRestaurants();
  }, [profile?.email]);

  async function loadRestaurants() {
    const mail = profile?.email || "";
    if (!mail) return;
    const res = await fetch(`/api/admin/restaurants?developer_email=${encodeURIComponent(mail)}`);
    const json = await res.json();
    if (json.restaurants) setRestaurants(json.restaurants);
  }

  async function openRestaurant(r: any) {
    setSelectedRestaurant(r);
    setEditName(r.name);
    setDetailLoading(true);
    const res = await fetch(`/api/admin/restaurant-detail?developer_email=${encodeURIComponent(profile?.email || "")}&restaurant_id=${r.id}`);
    const json = await res.json();
    setDetail(json);
    setDetailLoading(false);
  }

  async function saveName() {
    if (!editName.trim() || !selectedRestaurant) return;
    const res = await fetch("/api/admin/restaurant-detail", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ developer_email: profile?.email, restaurant_id: selectedRestaurant.id, updates: { name: editName } }),
    });
    const json = await res.json();
    if (json.success) {
      toast.success("Name gespeichert");
      setSelectedRestaurant({ ...selectedRestaurant, name: editName });
      setEditingName(false);
      loadRestaurants();
    } else {
      toast.error(json.error || "Fehler");
    }
  }

  async function deleteSale(saleId: string) {
    const res = await fetch("/api/admin/restaurant-detail", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ developer_email: profile?.email, sale_id: saleId }),
    });
    const json = await res.json();
    if (json.success) {
      toast.success("Eintrag gelöscht");
      setDetail(prev => prev ? { ...prev, sales: prev.sales.filter(s => s.id !== saleId) } : prev);
    } else {
      toast.error(json.error || "Fehler");
    }
  }

  async function createAccess() {
    if (!restaurantName.trim() || !chefName.trim() || !chefEmail.trim() || !chefPassword.trim()) {
      toast.error("Alle Felder ausfüllen"); return;
    }
    if (chefPassword.length < 6) { toast.error("Passwort min. 6 Zeichen"); return; }
    setCreating(true);
    const res = await fetch("/api/admin/create-access", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ developer_email: profile?.email, restaurant_name: restaurantName, chef_name: chefName, chef_email: chefEmail, chef_password: chefPassword }),
    });
    const data = await res.json();
    if (data.success) {
      toast.success(`Zugang erstellt! Code: ${data.invite_code}`);
      setRestaurantName(""); setChefName(""); setChefEmail(""); setChefPassword("");
      loadRestaurants(); setTab("restaurants");
    } else {
      toast.error(data.error || "Fehler beim Erstellen");
    }
    setCreating(false);
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

  async function logout() {
    await supabase.auth.signOut(); clear(); router.push("/auth");
  }

  // ── Restaurant Detail View ──────────────────────────────────────────────
  if (selectedRestaurant) {
    const totalSales = detail?.sales.reduce((s, r) => s + Number(r.amount), 0) || 0;
    return (
      <div className="min-h-screen bg-gray-950">
        <Toaster position="top-right" />
        <div className="bg-gray-900 border-b border-gray-800 px-6 py-4 flex items-center gap-4">
          <button onClick={() => { setSelectedRestaurant(null); setDetail(null); }} className="text-gray-400 hover:text-white p-2 rounded-xl hover:bg-gray-800 transition-colors">
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
          </div>
          <button onClick={() => openRestaurant(selectedRestaurant)} className="text-gray-400 hover:text-white p-2 rounded-xl hover:bg-gray-800 transition-colors">
            <RefreshCw size={16} />
          </button>
          <button onClick={logout} className="text-gray-400 hover:text-white p-2 rounded-xl hover:bg-gray-800 transition-colors">
            <LogOut size={18} />
          </button>
        </div>

        <div className="max-w-5xl mx-auto p-6 space-y-6">
          {/* Info row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: "Einladungscode", value: selectedRestaurant.invite_code, mono: true },
              { label: "E-Mail", value: selectedRestaurant.email || "—", mono: false },
              { label: "Erstellt", value: new Date(selectedRestaurant.created_at).toLocaleDateString("de-DE"), mono: false },
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
              {/* Members */}
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

              {/* Recent Sales */}
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

  // ── Main List View ──────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-950">
      <Toaster position="top-right" />
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

      <div className="max-w-4xl mx-auto p-6 space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 flex items-center gap-3">
            <Building2 size={22} className="text-orange-400" />
            <div><p className="text-gray-400 text-xs">Restaurants gesamt</p><p className="text-white font-bold text-2xl">{restaurants.length}</p></div>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 flex items-center gap-3">
            <Activity size={22} className="text-green-400" />
            <div><p className="text-gray-400 text-xs">Aktiv</p><p className="text-white font-bold text-2xl">{restaurants.filter(r => r.is_active).length}</p></div>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 flex items-center gap-3">
            <Users size={22} className="text-blue-400" />
            <div><p className="text-gray-400 text-xs">Mitarbeiter gesamt</p>
              <p className="text-white font-bold text-2xl">
                {restaurants.reduce((s, r) => s + (r.restaurant_members?.[0]?.count || 0), 0)}
              </p>
            </div>
          </div>
        </div>

        <div className="flex gap-2">
          {([["create", "Zugang erstellen"], ["restaurants", "Restaurants"]] as const).map(([k, l]) => (
            <button key={k} onClick={() => setTab(k)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${tab === k ? "bg-orange-500 text-white" : "bg-gray-800 text-gray-400 hover:text-white"}`}>
              {l}
            </button>
          ))}
        </div>

        {tab === "create" && (
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
            <h3 className="font-semibold text-white mb-5 flex items-center gap-2">
              <Plus size={16} className="text-orange-400" /> Neuen Restaurantzugang erstellen
            </h3>
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
              <p className="text-gray-500 text-xs text-center">Der Chef kann sich sofort mit dieser E-Mail und diesem Passwort anmelden.</p>
            </div>
          </div>
        )}

        {tab === "restaurants" && (
          <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
            <div className="p-4 border-b border-gray-800">
              <h3 className="font-semibold text-white">Alle Restaurants ({restaurants.length})</h3>
            </div>
            <div className="divide-y divide-gray-800/50">
              {restaurants.map(r => (
                <div key={r.id} className="p-4 flex items-center gap-4 hover:bg-gray-800/30 transition-colors cursor-pointer" onClick={() => openRestaurant(r)}>
                  <div className="w-10 h-10 rounded-xl bg-orange-500/20 flex items-center justify-center">
                    <Building2 size={18} className="text-orange-400" />
                  </div>
                  <div className="flex-1">
                    <p className="text-white font-medium">{r.name}</p>
                    <p className="text-gray-400 text-xs">{r.email || "—"} · Erstellt: {new Date(r.created_at).toLocaleDateString("de-DE")}</p>
                    <p className="text-gray-500 text-xs">Code: <span className="text-orange-400 font-mono">{r.invite_code}</span></p>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1.5 text-gray-400 text-xs">
                      <Users size={12} />
                      {r.restaurant_members?.[0]?.count || 0} MA
                    </div>
                    <span className={`text-xs px-2 py-1 rounded-full ${r.is_active ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"}`}>
                      {r.is_active ? "Aktiv" : "Inaktiv"}
                    </span>
                    {r.is_active && (
                      <button onClick={e => { e.stopPropagation(); deactivateRestaurant(r.id); }} className="text-gray-500 hover:text-red-400 transition-colors p-1">
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
              {restaurants.length === 0 && (
                <p className="p-8 text-center text-gray-500 text-sm">Noch keine Restaurants erstellt</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
