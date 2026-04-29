"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useStore } from "@/lib/store";
import { UserPlus, Copy, Users, Euro, Trash2, Edit2 } from "lucide-react";
import toast from "react-hot-toast";

export default function TeamManager() {
  const { restaurant } = useStore();
  const [members, setMembers] = useState<any[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editWage, setEditWage] = useState("");
  const [editPosition, setEditPosition] = useState("");

  useEffect(() => {
    if (!restaurant) return;
    supabase.from("restaurant_members").select("*, profiles(name, email, phone)").eq("restaurant_id", restaurant.id).eq("is_active", true)
      .then(({ data }) => data && setMembers(data));
  }, [restaurant]);

  function copyInviteCode() {
    navigator.clipboard.writeText(restaurant?.invite_code || "");
    toast.success("Einladungscode kopiert!");
  }

  async function saveEdit(memberId: string) {
    const { error } = await supabase.from("restaurant_members").update({ hourly_wage: parseFloat(editWage), position: editPosition }).eq("id", memberId);
    if (!error) {
      toast.success("Gespeichert!");
      setEditingId(null);
      setMembers(prev => prev.map(m => m.id === memberId ? { ...m, hourly_wage: parseFloat(editWage), position: editPosition } : m));
    }
  }

  async function removeMember(memberId: string) {
    if (!confirm("Mitarbeiter wirklich entfernen?")) return;
    await supabase.from("restaurant_members").update({ is_active: false }).eq("id", memberId);
    setMembers(prev => prev.filter(m => m.id !== memberId));
    toast.success("Mitarbeiter entfernt");
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white">Team verwalten</h2>
        <p className="text-gray-400 text-sm mt-1">Mitarbeiter einladen und verwalten</p>
      </div>

      {/* Invite section */}
      <div className="bg-orange-500/10 border border-orange-500/20 rounded-2xl p-5">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl bg-orange-500 flex items-center justify-center shrink-0"><UserPlus size={20} className="text-white" /></div>
          <div className="flex-1">
            <h3 className="font-semibold text-white mb-1">Mitarbeiter einladen</h3>
            <p className="text-gray-400 text-sm mb-3">Teile diesen Code mit deinen Mitarbeitern. Sie geben ihn beim ersten Login ein.</p>
            <div className="flex items-center gap-3">
              <div className="bg-gray-900 border border-orange-500/30 rounded-xl px-4 py-2 flex-1">
                <p className="text-orange-400 font-mono font-bold text-lg tracking-widest">{restaurant?.invite_code || "—"}</p>
              </div>
              <button onClick={copyInviteCode} className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-xl text-sm font-medium flex items-center gap-2 transition-colors">
                <Copy size={14} /> Kopieren
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 flex items-center gap-3">
          <Users size={22} className="text-orange-400" />
          <div><p className="text-gray-400 text-xs">Mitarbeiter</p><p className="text-white font-bold text-xl">{members.length}</p></div>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 flex items-center gap-3">
          <Euro size={22} className="text-green-400" />
          <div><p className="text-gray-400 text-xs">Ø Stundenlohn</p><p className="text-white font-bold text-xl">{members.length > 0 ? (members.reduce((s, m) => s + Number(m.hourly_wage || 13), 0) / members.length).toFixed(2) : "0.00"} €</p></div>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 flex items-center gap-3">
          <Euro size={22} className="text-blue-400" />
          <div><p className="text-gray-400 text-xs">Wöchentl. Lohnkosten (est.)</p><p className="text-white font-bold text-xl">{(members.reduce((s, m) => s + Number(m.hourly_wage || 13) * 25, 0)).toFixed(0)} €</p></div>
        </div>
      </div>

      {/* Members list */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
        <div className="p-5 border-b border-gray-800"><h3 className="font-semibold text-white">Alle Mitarbeiter ({members.length})</h3></div>
        <div className="divide-y divide-gray-800/50">
          {members.length === 0 ? (
            <p className="p-8 text-center text-gray-500 text-sm">Noch keine Mitarbeiter. Teile den Einladungscode!</p>
          ) : members.map(m => (
            <div key={m.id} className="p-4 hover:bg-gray-800/30 transition-colors">
              {editingId === m.id ? (
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="w-9 h-9 rounded-full bg-orange-500/20 text-orange-400 flex items-center justify-center font-bold">{m.profiles?.name?.charAt(0)}</div>
                  <span className="text-white font-medium flex-1 min-w-24">{m.profiles?.name}</span>
                  <input value={editPosition} onChange={e => setEditPosition(e.target.value)} placeholder="Position (Koch, Kellner...)"
                    className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-white w-36 focus:outline-none focus:border-orange-500" />
                  <input value={editWage} onChange={e => setEditWage(e.target.value)} placeholder="€/h" type="number"
                    className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-white w-20 focus:outline-none focus:border-orange-500" />
                  <button onClick={() => saveEdit(m.id)} className="bg-orange-500 text-white px-3 py-1.5 rounded-lg text-sm">Speichern</button>
                  <button onClick={() => setEditingId(null)} className="text-gray-400 px-2 py-1.5 text-sm">Abbrechen</button>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-orange-500/20 text-orange-400 flex items-center justify-center font-bold">{m.profiles?.name?.charAt(0)}</div>
                  <div className="flex-1">
                    <p className="text-white text-sm font-medium">{m.profiles?.name}</p>
                    <p className="text-gray-400 text-xs">{m.position || "Keine Position"} · {m.profiles?.email}</p>
                  </div>
                  <span className="text-green-400 font-medium text-sm">{Number(m.hourly_wage || 13).toFixed(2)} €/h</span>
                  <button onClick={() => { setEditingId(m.id); setEditWage(m.hourly_wage || "13"); setEditPosition(m.position || ""); }} className="text-gray-400 hover:text-white p-1.5 rounded-lg hover:bg-gray-700 transition-colors"><Edit2 size={14} /></button>
                  <button onClick={() => removeMember(m.id)} className="text-gray-400 hover:text-red-400 p-1.5 rounded-lg hover:bg-gray-700 transition-colors"><Trash2 size={14} /></button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
