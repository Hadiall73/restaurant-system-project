"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useStore } from "@/lib/store";
import { UserPlus, Copy, Users, Euro, Trash2, Edit2, X, AlertTriangle, RefreshCw } from "lucide-react";
import toast from "react-hot-toast";

export default function TeamManager() {
  const { restaurant } = useStore();
  const [members, setMembers] = useState<any[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editWage, setEditWage] = useState("");
  const [editPosition, setEditPosition] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<any | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [rotatingCode, setRotatingCode] = useState(false);
  const [currentInviteCode, setCurrentInviteCode] = useState<string>("");

  useEffect(() => {
    if (!restaurant) return;
    setCurrentInviteCode(restaurant.invite_code || "");
    supabase.from("restaurant_members").select("*, profiles(name, email, phone)").eq("restaurant_id", restaurant.id).eq("is_active", true)
      .then(({ data }) => data && setMembers(data));
  }, [restaurant]);

  function copyInviteCode() {
    navigator.clipboard.writeText(currentInviteCode);
    toast.success("Einladungscode kopiert!");
  }

  async function rotateInviteCode() {
    if (!restaurant) return;
    setRotatingCode(true);
    const newCode = Math.random().toString(36).slice(2, 10);
    const { error } = await supabase.from("restaurants").update({ invite_code: newCode }).eq("id", restaurant.id);
    if (!error) {
      setCurrentInviteCode(newCode);
      toast.success("Neuer Einladungscode generiert!");
    } else {
      toast.error("Fehler beim Generieren");
    }
    setRotatingCode(false);
  }

  async function saveEdit(memberId: string) {
    const wage = parseFloat(editWage);
    if (isNaN(wage) || wage < 0 || wage > 999) { toast.error("Ungültiger Stundenlohn"); return; }
    const { error } = await supabase.from("restaurant_members").update({ hourly_wage: wage, position: editPosition }).eq("id", memberId);
    if (!error) {
      toast.success("Gespeichert!");
      setEditingId(null);
      setMembers(prev => prev.map(m => m.id === memberId ? { ...m, hourly_wage: wage, position: editPosition } : m));
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    const { error } = await supabase.from("restaurant_members").update({ is_active: false }).eq("id", deleteTarget.id);
    if (!error) {
      setMembers(prev => prev.filter(m => m.id !== deleteTarget.id));
      toast.success(`${deleteTarget.profiles?.name} wurde entfernt`);
    } else {
      toast.error("Fehler beim Entfernen");
    }
    setDeleteTarget(null);
    setDeleting(false);
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white">Team verwalten</h2>
        <p className="text-gray-400 text-sm mt-1">Mitarbeiter einladen und verwalten</p>
      </div>

      {/* Einladungscode */}
      <div className="bg-orange-500/10 border border-orange-500/20 rounded-2xl p-5">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl bg-orange-500 flex items-center justify-center shrink-0"><UserPlus size={20} className="text-white" /></div>
          <div className="flex-1">
            <h3 className="font-semibold text-white mb-1">Mitarbeiter einladen</h3>
            <p className="text-gray-400 text-sm mb-3">Teile diesen Code mit deinen Mitarbeitern. Sie geben ihn beim ersten Login ein.</p>
            <div className="flex items-center gap-3">
              <div className="bg-gray-900 border border-orange-500/30 rounded-xl px-4 py-2 flex-1">
                <p className="text-orange-400 font-mono font-bold text-lg tracking-widest">{currentInviteCode || "—"}</p>
              </div>
              <button onClick={copyInviteCode} className="bg-orange-500 hover:bg-orange-600 text-white px-3 py-2 rounded-xl text-sm font-medium flex items-center gap-2 transition-colors">
                <Copy size={14} /> Kopieren
              </button>
              <button onClick={rotateInviteCode} disabled={rotatingCode}
                title="Neuen Code generieren"
                className="bg-gray-700 hover:bg-gray-600 disabled:opacity-50 text-white px-3 py-2 rounded-xl text-sm font-medium flex items-center gap-2 transition-colors">
                <RefreshCw size={14} className={rotatingCode ? "animate-spin" : ""} />
              </button>
            </div>
            <p className="text-gray-500 text-xs mt-2">Der Code ändert sich automatisch nach jeder Registrierung. Du kannst ihn auch manuell neu generieren.</p>
          </div>
        </div>
      </div>

      {/* Statistiken */}
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

      {/* Mitarbeiterliste */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
        <div className="p-5 border-b border-gray-800">
          <h3 className="font-semibold text-white">Alle Mitarbeiter ({members.length})</h3>
        </div>
        <div className="divide-y divide-gray-800/50">
          {members.length === 0 ? (
            <p className="p-8 text-center text-gray-500 text-sm">Noch keine Mitarbeiter. Teile den Einladungscode!</p>
          ) : members.map(m => (
            <div key={m.id} className="p-4 hover:bg-gray-800/20 transition-colors">
              {editingId === m.id ? (
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="w-9 h-9 rounded-full bg-orange-500/20 text-orange-400 flex items-center justify-center font-bold shrink-0">
                    {m.profiles?.name?.charAt(0)}
                  </div>
                  <span className="text-white font-medium flex-1 min-w-24">{m.profiles?.name}</span>
                  <input value={editPosition} onChange={e => setEditPosition(e.target.value)} placeholder="Position (Koch, Kellner...)"
                    className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-white w-36 focus:outline-none focus:border-orange-500" />
                  <input value={editWage} onChange={e => setEditWage(e.target.value)} placeholder="€/h" type="number" min={0} max={999}
                    className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-white w-20 focus:outline-none focus:border-orange-500" />
                  <button onClick={() => saveEdit(m.id)} className="bg-orange-500 hover:bg-orange-600 text-white px-3 py-1.5 rounded-lg text-sm transition-colors">Speichern</button>
                  <button onClick={() => setEditingId(null)} className="text-gray-400 hover:text-white px-2 py-1.5 text-sm transition-colors">Abbrechen</button>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-orange-500/20 text-orange-400 flex items-center justify-center font-bold shrink-0">
                    {m.profiles?.name?.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-medium">{m.profiles?.name}</p>
                    <p className="text-gray-400 text-xs truncate">{m.position || "Keine Position"} · {m.profiles?.email}</p>
                  </div>
                  <button
                    onClick={() => { setEditingId(m.id); setEditWage(String(m.hourly_wage || 0)); setEditPosition(m.position || ""); }}
                    className="flex items-center gap-1.5 bg-green-500/10 hover:bg-green-500/20 border border-green-500/30 text-green-400 px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors shrink-0">
                    <Euro size={12} />
                    {Number(m.hourly_wage || 0).toFixed(2)} €/h
                    <Edit2 size={11} className="text-green-500/70" />
                  </button>
                  <button
                    onClick={() => setDeleteTarget(m)}
                    className="text-gray-400 hover:text-red-400 p-1.5 rounded-lg hover:bg-red-500/10 transition-colors shrink-0"
                    title="Mitarbeiter entfernen">
                    <Trash2 size={14} />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Lösch-Bestätigungs-Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={() => !deleting && setDeleteTarget(null)}>
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-full max-w-sm shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-red-500/20 flex items-center justify-center">
                  <AlertTriangle size={20} className="text-red-400" />
                </div>
                <h3 className="text-white font-bold text-lg">Mitarbeiter entfernen</h3>
              </div>
              {!deleting && (
                <button onClick={() => setDeleteTarget(null)} className="text-gray-400 hover:text-white transition-colors">
                  <X size={18} />
                </button>
              )}
            </div>

            <div className="bg-gray-800 rounded-xl p-4 mb-5 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-orange-500/20 text-orange-400 flex items-center justify-center font-bold text-lg shrink-0">
                {deleteTarget.profiles?.name?.charAt(0)}
              </div>
              <div>
                <p className="text-white font-semibold">{deleteTarget.profiles?.name}</p>
                <p className="text-gray-400 text-xs">{deleteTarget.position || "Keine Position"} · {deleteTarget.profiles?.email}</p>
                <p className="text-green-400 text-xs">{Number(deleteTarget.hourly_wage || 13).toFixed(2)} €/h</p>
              </div>
            </div>

            <p className="text-gray-400 text-sm mb-5">
              Dieser Mitarbeiter verliert sofort den Zugriff auf das System. Alle bisherigen Schichten und Daten bleiben erhalten.
            </p>

            <div className="flex gap-3">
              <button onClick={() => setDeleteTarget(null)} disabled={deleting}
                className="flex-1 py-2.5 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm font-medium transition-colors disabled:opacity-50">
                Abbrechen
              </button>
              <button onClick={confirmDelete} disabled={deleting}
                className="flex-1 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 disabled:opacity-50 text-white text-sm font-bold transition-colors flex items-center justify-center gap-2">
                <Trash2 size={14} />
                {deleting ? "Wird entfernt..." : "Entfernen"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
