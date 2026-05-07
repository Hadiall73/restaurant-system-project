"use client";
import { useState, useEffect } from "react";
import { supabase, RobustSync } from "@/lib/supabase";
import { Plus, Save, Trash2, CloudOff, CloudCheck, AlertCircle } from "lucide-react";
import toast from "react-hot-toast";

export default function ExpenseManager() {
  const { restaurant } = require("@/lib/store").useStore(); // Simplified store access for this component
  const [expenses, setExpenses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOnline, setIsOnline] = useState(true);
  const [form, setForm] = useState({
    category: "Material",
    amount_net: "",
    amount_gross: "",
    vat_rate: "19",
    supplier: "",
    description: "",
    invoice_date: new Date().toISOString().slice(0, 10),
  });

  useEffect(() => {
    // Connectivity listener
    const handleOnline = () => { setIsOnline(true); RobustSync.syncAll(); };
    const handleOffline = () => setIsOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    
    loadExpenses();

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  async function loadExpenses() {
    if (!restaurant) return;
    setLoading(true);
    const { data } = await supabase
      .from("expenses")
      .select("*")
      .eq("restaurant_id", restaurant.id)
      .order("recorded_at", { ascending: false })
      .limit(20);
    setExpenses(data || []);
    setLoading(false);
  }

  async function handleSave() {
    if (!restaurant || !form.amount_gross) {
      toast.error("Bitte Betrag eingeben");
      return;
    }

    const amountGross = parseFloat(form.amount_gross);
    const vatRate = parseFloat(form.vat_rate) / 100;
    const amountNet = amountGross / (1 + vatRate);
    const vatAmount = amountGross - amountNet;

    const payload = {
      restaurant_id: restaurant.id,
      category: form.category,
      amount_net: amountNet,
      amount_gross: amountGross,
      vat_rate: parseFloat(form.vat_rate),
      vat_amount: vatAmount,
      supplier: form.supplier,
      description: form.description,
      invoice_date: form.invoice_date,
      recorded_at: new Date().toISOString(),
    };

    try {
      const { error } = await supabase.from("expenses").insert(payload);
      if (error) throw error;
      
      toast.success("Ausgabe erfolgreich gespeichert!");
      setForm({ category: "Material", amount_net: "", amount_gross: "", vat_rate: "19", supplier: "", description: "", invoice_date: new Date().toISOString().slice(0, 10) });
      loadExpenses();
    } catch (e) {
      console.log("Offline: Saving expense locally...");
      await RobustSync.saveLocally('expenses', payload);
      toast("Offline: Ausgabe lokal gespeichert!", { icon: "☁️" });
      // Optimistic update
      setExpenses(prev => [{ ...payload, id: 'local-' + Date.now() }, ...prev]);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-white">Ausgaben-Manager</h2>
        <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium transition-all ${isOnline ? "bg-green-500/10 text-green-400 border border-green-500/20" : "bg-red-500/10 text-red-400 border border-red-500/20"}`}>
          {isOnline ? <CloudCheck size={14} /> : <CloudOff size={14} />}
          {isOnline ? "Online / Synchronisiert" : "Offline Modus"}
        </div>
      </div>

      {/* Eingabe Maske */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <label className="text-gray-400 text-xs font-medium">Kategorie</label>
            <select 
              value={form.category} 
              onChange={e => setForm({...form, category: e.target.value})}
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white focus:border-orange-500 outline-none"
            >
              <option value="Material">Material / Ware</option>
              <option value="Miete">Miete / Nebenkosten</option>
              <option value="Personal">Personal / Lohn</option>
              <option value="Marketing">Marketing</option>
              <option value="Sonstiges">Sonstiges</option>
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-gray-400 text-xs font-medium">Brutto-Betrag (€)</label>
            <input 
              type="number" 
              placeholder="0.00"
              value={form.amount_gross} 
              onChange={e => setForm({...form, amount_gross: e.target.value})}
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white focus:border-orange-500 outline-none" 
            />
          </div>
          <div className="space-y-2">
            <label className="text-gray-400 text-xs font-medium">MwSt (%)</label>
            <input 
              type="number" 
              value={form.vat_rate} 
              onChange={e => setForm({...form, vat_rate: e.target.value})}
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white focus:border-orange-500 outline-none" 
            />
          </div>
          <div className="space-y-2 md:col-span-2">
            <label className="text-gray-400 text-xs font-medium">Lieferant / Firma</label>
            <input 
              type="text" 
              placeholder="z.B. Metro, Amazon..." 
              value={form.supplier} 
              onChange={e => setForm({...form, supplier: e.target.value})}
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white focus:border-orange-500 outline-none" 
            />
          </div>
          <div className="space-y-2">
            <label className="text-gray-400 text-xs font-medium">Datum</label>
            <input 
              type="date" 
              value={form.invoice_date} 
              onChange={e => setForm({...form, invoice_date: e.target.value})}
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white focus:border-orange-500 outline-none" 
            />
          </div>
          <div className="space-y-2 md:col-span-3">
            <label className="text-gray-400 text-xs font-medium">Beschreibung</label>
            <textarea 
              placeholder="Was wurde gekauft?" 
              value={form.description} 
              onChange={e => setForm({...form, description: e.target.value})}
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white focus:border-orange-500 outline-none h-20" 
            />
          </div>
        </div>
        <button 
          onClick={handleSave} 
          className="mt-6 w-full bg-orange-500 hover:bg-orange-600 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all"
        >
          <Save size={18} /> Ausgabe speichern
        </button>
      </div>

      {/* Letzte Ausgaben Liste */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
        <div className="p-4 border-b border-gray-800 flex items-center justify-between">
          <h3 className="text-white font-semibold">Letzte Buchungen</h3>
          <button onClick={loadExpenses} className="text-gray-500 hover:text-white transition-colors">
            <RefreshCw size={16} className="animate-spin-slow" />
          </button>
        </div>
        <div className="divide-y divide-gray-800">
          {loading ? (
            <div className="p-10 text-center text-gray-500">Lade Daten...</div>
          ) : expenses.length === 0 ? (
            <div className="p-10 text-center text-gray-500">Noch keine Ausgaben erfasst.</div>
          ) : (
            expenses.map((exp) => (
              <div key={exp.id} className="p-4 flex items-center justify-between hover:bg-gray-800/30 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gray-800 flex items-center justify-center text-orange-400">
                    <AlertCircle size={18} />
                  </div>
                  <div>
                    <p className="text-white text-sm font-medium">{exp.supplier || "Kein Lieferant"}</p>
                    <p className="text-gray-500 text-xs">{exp.category} · {exp.invoice_date}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-white font-bold">{Number(exp.amount_gross).toFixed(2)} €</p>
                  <p className="text-gray-500 text-xs">{exp.description?.slice(0, 20)}...</p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
