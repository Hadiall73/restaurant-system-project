"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useStore } from "@/lib/store";
import {
  AlertTriangle, CheckCircle, ShoppingCart, Zap, Phone, Mail,
  Package, Truck, ToggleLeft, ToggleRight, ChevronDown, ChevronUp,
  Plus, X, Loader2, FileDown, ClipboardList,
} from "lucide-react";
import toast from "react-hot-toast";

type Supplier = {
  id: string; name: string; contact_person: string | null;
  phone: string | null; email: string | null; category: string | null;
  delivery_time: string | null; min_order_value: number | null; payment_days: number | null;
};

type InventoryItem = {
  id: string; name: string; unit: string; current_quantity: number;
  minimum_quantity: number; order_quantity: number; price_per_unit: number | null;
  auto_order: boolean; supplier_id: string | null;
  suppliers: Supplier | null;
};

type Order = {
  id: string; article_name: string; quantity: number; unit: string | null;
  total_price: number | null; order_type: string; status: string;
  ordered_at: string; inventory_id: string | null;
  suppliers: { name: string } | null;
};

// Bestellkorb-Eintrag
type CartItem = {
  item: InventoryItem;
  quantity: number;
};

const statusColor: Record<string, string> = {
  geliefert: "text-green-400 bg-green-500/10 border-green-500/20",
  unterwegs: "text-blue-400 bg-blue-500/10 border-blue-500/20",
  bestellt:  "text-yellow-400 bg-yellow-500/10 border-yellow-500/20",
};

// ─── PDF-Export ───────────────────────────────────────────────────────────────
async function exportBestellungPDF(
  supplier: Supplier,
  cartItems: CartItem[],
  restaurantName: string
) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  const today = new Date().toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
  const bestellNr = `B-${Date.now().toString().slice(-6)}`;

  // ── Kopfzeile ───────────────────────────────────────────────────────────────
  doc.setFillColor(249, 115, 22); // orange-500
  doc.rect(0, 0, 210, 30, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.text("BESTELLSCHEIN", 14, 14);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(`Bestell-Nr.: ${bestellNr}`, 14, 22);
  doc.text(`Datum: ${today}`, 140, 14);
  doc.text(`Seite 1`, 140, 22);

  // ── Absender / Empfänger ────────────────────────────────────────────────────
  doc.setTextColor(30, 30, 30);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text("Von:", 14, 42);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(restaurantName, 14, 49);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(`Bestelldatum: ${today}`, 14, 56);

  // Lieferant-Box
  doc.setFillColor(245, 245, 245);
  doc.roundedRect(110, 36, 86, 40, 3, 3, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("An: Lieferant", 116, 44);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(supplier.name, 116, 51);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  if (supplier.contact_person) doc.text(`Ansp.: ${supplier.contact_person}`, 116, 58);
  if (supplier.phone) doc.text(`Tel: ${supplier.phone}`, 116, 64);
  if (supplier.email) doc.text(`E-Mail: ${supplier.email}`, 116, 70);

  // ── Trennlinie ──────────────────────────────────────────────────────────────
  doc.setDrawColor(230, 230, 230);
  doc.line(14, 82, 196, 82);

  // ── Tabellenkopf ────────────────────────────────────────────────────────────
  let y = 90;
  doc.setFillColor(55, 55, 55);
  doc.rect(14, y - 5, 182, 8, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text("Pos.", 16, y);
  doc.text("Artikel", 30, y);
  doc.text("Menge", 115, y);
  doc.text("Einheit", 140, y);
  doc.text("Preis/Einh.", 160, y);
  doc.text("Gesamt", 181, y, { align: "right" });
  y += 8;

  // ── Tabellenzeilen ──────────────────────────────────────────────────────────
  let gesamtNetto = 0;
  doc.setTextColor(30, 30, 30);

  cartItems.forEach((ci, idx) => {
    const isEven = idx % 2 === 0;
    if (isEven) {
      doc.setFillColor(250, 250, 250);
      doc.rect(14, y - 5, 182, 8, "F");
    }
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(String(idx + 1), 16, y);
    doc.text(ci.item.name.slice(0, 35), 30, y);
    doc.text(ci.quantity.toString(), 115, y);
    doc.text(ci.item.unit, 140, y);

    const preisText = ci.item.price_per_unit
      ? ci.item.price_per_unit.toLocaleString("de-DE", { minimumFractionDigits: 2 }) + " €"
      : "–";
    doc.text(preisText, 160, y);

    const gesamt = ci.quantity * (ci.item.price_per_unit || 0);
    gesamtNetto += gesamt;
    const gesamtText = ci.item.price_per_unit
      ? gesamt.toLocaleString("de-DE", { minimumFractionDigits: 2 }) + " €"
      : "–";
    doc.text(gesamtText, 196, y, { align: "right" });

    y += 9;

    // Neue Seite wenn nötig
    if (y > 260) {
      doc.addPage();
      y = 20;
    }
  });

  // ── Summen-Box ──────────────────────────────────────────────────────────────
  y += 5;
  doc.setDrawColor(230, 230, 230);
  doc.line(14, y, 196, y);
  y += 8;

  if (gesamtNetto > 0) {
    const mwst = gesamtNetto * 0.19;
    const brutto = gesamtNetto + mwst;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(100, 100, 100);
    doc.text("Nettobetrag:", 140, y);
    doc.setTextColor(30, 30, 30);
    doc.text(gesamtNetto.toLocaleString("de-DE", { minimumFractionDigits: 2 }) + " €", 196, y, { align: "right" });
    y += 7;

    doc.setTextColor(100, 100, 100);
    doc.text("MwSt. 19%:", 140, y);
    doc.setTextColor(30, 30, 30);
    doc.text(mwst.toLocaleString("de-DE", { minimumFractionDigits: 2 }) + " €", 196, y, { align: "right" });
    y += 7;

    doc.setFillColor(249, 115, 22);
    doc.roundedRect(130, y - 5, 66, 10, 2, 2, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text("Gesamtbetrag:", 134, y + 1);
    doc.text(brutto.toLocaleString("de-DE", { minimumFractionDigits: 2 }) + " €", 194, y + 1, { align: "right" });
    y += 15;
  }

  // ── Lieferbedingungen ───────────────────────────────────────────────────────
  doc.setTextColor(100, 100, 100);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  if (supplier.delivery_time)  doc.text(`Gewünschte Lieferzeit: ${supplier.delivery_time}`, 14, y);
  if (supplier.payment_days)   doc.text(`Zahlungsziel: ${supplier.payment_days} Tage netto`, 14, y + 6);
  if (supplier.min_order_value && gesamtNetto < supplier.min_order_value) {
    doc.setTextColor(220, 50, 50);
    doc.text(`⚠ Mindestbestellwert: ${supplier.min_order_value.toFixed(2)} € (noch nicht erreicht)`, 14, y + 12);
  }

  // ── Unterschriftszeile ──────────────────────────────────────────────────────
  const signY = 265;
  doc.setTextColor(100, 100, 100);
  doc.setFontSize(8);
  doc.line(14, signY, 90, signY);
  doc.line(120, signY, 196, signY);
  doc.text("Ort, Datum", 14, signY + 5);
  doc.text("Unterschrift / Stempel", 120, signY + 5);

  // ── Fußzeile ────────────────────────────────────────────────────────────────
  doc.setFontSize(7);
  doc.setTextColor(160, 160, 160);
  doc.text(`${restaurantName} · Bestellung Nr. ${bestellNr} · ${today}`, 14, 290);
  doc.text("Erstellt mit Restaurant Management System", 196, 290, { align: "right" });

  // ── Download ────────────────────────────────────────────────────────────────
  doc.save(`Bestellung_${supplier.name.replace(/\s+/g, "_")}_${today.replace(/\./g, "-")}.pdf`);
}

// ─── Hauptkomponente ──────────────────────────────────────────────────────────
export default function Lager() {
  const { restaurant } = useStore();
  const [tab, setTab] = useState<"lager" | "lieferanten" | "bestellen" | "historie">("lager");
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedSupplier, setExpandedSupplier] = useState<string | null>(null);
  const [orderingId, setOrderingId] = useState<string | null>(null);

  // ── Bestellkorb ─────────────────────────────────────────────────────────────
  const [selectedSupplier, setSelectedSupplier] = useState<string>("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [generatingPDF, setGeneratingPDF] = useState(false);

  // Neuer Lieferant
  const [showNewSupplier, setShowNewSupplier] = useState(false);
  const [newSupplier, setNewSupplier] = useState({ name: "", contact_person: "", phone: "", email: "", category: "", delivery_time: "1 Tag", min_order_value: "", payment_days: "14" });

  // Neuer Artikel
  const [showNewItem, setShowNewItem] = useState(false);
  const [newItem, setNewItem] = useState({ name: "", unit: "kg", current_quantity: "", minimum_quantity: "", order_quantity: "", price_per_unit: "", supplier_id: "", auto_order: false });

  async function load() {
    if (!restaurant) return;
    setLoading(true);
    const [{ data: inv }, { data: sup }, { data: ord }] = await Promise.all([
      supabase.from("inventory").select("*, suppliers(*)").eq("restaurant_id", restaurant.id).order("name"),
      supabase.from("suppliers").select("*").eq("restaurant_id", restaurant.id).eq("is_active", true).order("name"),
      supabase.from("supplier_orders").select("*, suppliers(name)").eq("restaurant_id", restaurant.id).order("ordered_at", { ascending: false }).limit(30),
    ]);
    if (inv) setItems(inv as InventoryItem[]);
    if (sup) setSuppliers(sup as Supplier[]);
    if (ord) setOrders(ord as Order[]);
    setLoading(false);
  }

  useEffect(() => { load(); }, [restaurant]);

  // ── Warenkorb-Funktionen ─────────────────────────────────────────────────
  function toggleCart(item: InventoryItem) {
    setCart(prev => {
      const exists = prev.find(c => c.item.id === item.id);
      if (exists) return prev.filter(c => c.item.id !== item.id);
      return [...prev, { item, quantity: item.order_quantity || item.minimum_quantity || 1 }];
    });
  }

  function updateCartQty(itemId: string, qty: number) {
    setCart(prev => prev.map(c => c.item.id === itemId ? { ...c, quantity: Math.max(1, qty) } : c));
  }

  function initCart(supplierId: string) {
    setSelectedSupplier(supplierId);
    // Kritische Artikel dieses Lieferanten vorab auswählen
    const kritisch = items.filter(i => i.supplier_id === supplierId && i.current_quantity < i.minimum_quantity);
    if (kritisch.length > 0) {
      setCart(kritisch.map(item => ({ item, quantity: item.order_quantity || item.minimum_quantity })));
    } else {
      setCart([]);
    }
    setTab("bestellen");
  }

  async function handlePDF() {
    if (cart.length === 0) { toast.error("Keine Artikel im Bestellkorb"); return; }
    const sup = suppliers.find(s => s.id === selectedSupplier);
    if (!sup) { toast.error("Kein Lieferant ausgewählt"); return; }
    setGeneratingPDF(true);
    try {
      await exportBestellungPDF(sup, cart, restaurant?.name || "Restaurant");
      // Bestellung in DB speichern
      for (const ci of cart) {
        await supabase.from("supplier_orders").insert({
          restaurant_id: restaurant!.id,
          supplier_id: ci.item.supplier_id,
          inventory_id: ci.item.id,
          article_name: ci.item.name,
          quantity: ci.quantity,
          unit: ci.item.unit,
          total_price: ci.quantity * (ci.item.price_per_unit || 0),
          order_type: "manuell",
          status: "bestellt",
        });
      }
      toast.success("PDF heruntergeladen & Bestellung gespeichert!");
      setCart([]);
      load();
    } catch (e) {
      toast.error("Fehler beim PDF-Export");
    }
    setGeneratingPDF(false);
  }

  async function toggleAuto(item: InventoryItem) {
    const { error } = await supabase.from("inventory").update({ auto_order: !item.auto_order }).eq("id", item.id);
    if (!error) {
      setItems(prev => prev.map(i => i.id === item.id ? { ...i, auto_order: !i.auto_order } : i));
      toast.success(item.auto_order ? "Auto-Bestellung deaktiviert" : "Auto-Bestellung aktiviert");
    }
  }

  async function bestellen(item: InventoryItem, art: "manuell" | "auto") {
    if (!restaurant) return;
    setOrderingId(item.id);
    const { error } = await supabase.from("supplier_orders").insert({
      restaurant_id: restaurant.id,
      supplier_id: item.supplier_id,
      inventory_id: item.id,
      article_name: item.name,
      quantity: item.order_quantity || item.minimum_quantity,
      unit: item.unit,
      total_price: (item.order_quantity || item.minimum_quantity) * (item.price_per_unit || 0),
      order_type: art,
      status: "bestellt",
    });
    setOrderingId(null);
    if (!error) { toast.success(`${item.name} wurde bestellt!`); load(); }
    else toast.error("Fehler bei der Bestellung");
  }

  async function addSupplier() {
    if (!restaurant || !newSupplier.name.trim()) return;
    const { error } = await supabase.from("suppliers").insert({
      restaurant_id: restaurant.id, ...newSupplier,
      min_order_value: parseFloat(newSupplier.min_order_value) || 0,
      payment_days: parseInt(newSupplier.payment_days) || 14,
    });
    if (!error) {
      toast.success("Lieferant hinzugefügt!");
      setShowNewSupplier(false);
      setNewSupplier({ name: "", contact_person: "", phone: "", email: "", category: "", delivery_time: "1 Tag", min_order_value: "", payment_days: "14" });
      load();
    } else toast.error("Fehler beim Speichern");
  }

  async function addItem() {
    if (!restaurant || !newItem.name.trim()) return;
    const { error } = await supabase.from("inventory").insert({
      restaurant_id: restaurant.id, name: newItem.name, unit: newItem.unit,
      current_quantity: parseFloat(newItem.current_quantity) || 0,
      minimum_quantity: parseFloat(newItem.minimum_quantity) || 0,
      order_quantity: parseFloat(newItem.order_quantity) || 0,
      price_per_unit: parseFloat(newItem.price_per_unit) || null,
      supplier_id: newItem.supplier_id || null,
      auto_order: newItem.auto_order,
    });
    if (!error) {
      toast.success("Artikel hinzugefügt!");
      setShowNewItem(false);
      setNewItem({ name: "", unit: "kg", current_quantity: "", minimum_quantity: "", order_quantity: "", price_per_unit: "", supplier_id: "", auto_order: false });
      load();
    } else toast.error("Fehler beim Speichern");
  }

  async function alsGeliefert(order: Order) {
    const { error: orderError } = await supabase.from("supplier_orders")
      .update({ status: "geliefert", delivered_at: new Date().toISOString() }).eq("id", order.id);
    if (orderError) { toast.error("Fehler beim Aktualisieren"); return; }
    if (order.inventory_id) {
      const item = items.find(i => i.id === order.inventory_id);
      if (item) {
        const neuerBestand = item.current_quantity + order.quantity;
        await supabase.from("inventory").update({ current_quantity: neuerBestand, updated_at: new Date().toISOString() }).eq("id", order.inventory_id);
        setItems(prev => prev.map(i => i.id === order.inventory_id ? { ...i, current_quantity: neuerBestand } : i));
      }
    }
    setOrders(prev => prev.map(o => o.id === order.id ? { ...o, status: "geliefert" } : o));
    toast.success(`${order.article_name} geliefert — Bestand aktualisiert!`);
  }

  async function deleteSupplier(id: string) {
    if (!confirm("Lieferant wirklich deaktivieren?")) return;
    await supabase.from("suppliers").update({ is_active: false }).eq("id", id);
    toast.success("Lieferant entfernt");
    load();
  }

  const kritisch = items.filter(i => i.current_quantity < i.minimum_quantity);
  const autoKritisch = kritisch.filter(i => i.auto_order);

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="animate-spin text-orange-400" size={32} />
    </div>
  );

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold text-white">Wareneinkauf & Lager</h2>
          <p className="text-gray-400 text-sm mt-1">{items.length} Artikel · {suppliers.length} Lieferanten</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {autoKritisch.length > 0 && (
            <button onClick={() => autoKritisch.forEach(i => bestellen(i, "auto"))}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-sm font-medium flex items-center gap-2 transition-colors">
              <Zap size={15} /> Auto ({autoKritisch.length})
            </button>
          )}
          <button onClick={() => setTab("bestellen")}
            className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-xl text-sm font-medium flex items-center gap-2 transition-colors">
            <ClipboardList size={15} /> Bestellung erstellen
          </button>
        </div>
      </div>

      {/* Kritisch-Banner */}
      {kritisch.length > 0 && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle size={18} className="text-red-400" />
            <h3 className="font-semibold text-red-400">{kritisch.length} Artikel unter Mindestbestand!</h3>
          </div>
          <div className="space-y-2">
            {kritisch.map(item => (
              <div key={item.id} className="flex items-center justify-between bg-red-500/5 rounded-xl px-4 py-3">
                <div>
                  <p className="text-white font-medium text-sm">{item.name}</p>
                  <p className="text-gray-400 text-xs">{item.suppliers?.name ?? "Kein Lieferant"} · Bestellmenge: {item.order_quantity} {item.unit}</p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <p className="text-red-400 text-sm font-medium">{item.current_quantity} {item.unit}</p>
                    <p className="text-gray-500 text-xs">Min: {item.minimum_quantity}</p>
                  </div>
                  {item.supplier_id && (
                    <button
                      onClick={() => initCart(item.supplier_id!)}
                      className="bg-orange-500 hover:bg-orange-600 text-white px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5">
                      <FileDown size={12} /> PDF
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-900 border border-gray-800 rounded-xl p-1 w-fit flex-wrap">
        {([
          ["lager",      "Lagerbestand"],
          ["lieferanten","Lieferanten"],
          ["bestellen",  "Bestellung erstellen"],
          ["historie",   "Bestellhistorie"],
        ] as const).map(([t, label]) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === t ? "bg-orange-500 text-white" : "text-gray-400 hover:text-white"}`}>
            {label}
            {t === "bestellen" && cart.length > 0 && (
              <span className="ml-1.5 bg-white text-orange-500 text-xs rounded-full px-1.5 font-bold">{cart.length}</span>
            )}
          </button>
        ))}
      </div>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* TAB: Lagerbestand */}
      {tab === "lager" && (
        <div className="space-y-4">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
            <div className="p-5 border-b border-gray-800 flex items-center justify-between">
              <h3 className="font-semibold text-white">Gesamter Lagerbestand</h3>
              <button onClick={() => setShowNewItem(true)}
                className="bg-gray-800 hover:bg-gray-700 text-white px-3 py-1.5 rounded-xl text-xs font-medium flex items-center gap-1.5 transition-colors">
                <Plus size={13} /> Artikel hinzufügen
              </button>
            </div>

            {showNewItem && (
              <div className="p-5 border-b border-gray-800 bg-gray-800/30">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
                  <input placeholder="Artikelname *" value={newItem.name} onChange={e => setNewItem(p => ({ ...p, name: e.target.value }))}
                    className="bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-orange-500 col-span-2" />
                  <select value={newItem.unit} onChange={e => setNewItem(p => ({ ...p, unit: e.target.value }))}
                    className="bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-orange-500">
                    {["kg", "g", "L", "ml", "Fl.", "Stk.", "Pkg."].map(u => <option key={u}>{u}</option>)}
                  </select>
                  <select value={newItem.supplier_id} onChange={e => setNewItem(p => ({ ...p, supplier_id: e.target.value }))}
                    className="bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-orange-500">
                    <option value="">Lieferant wählen</option>
                    {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                  <input placeholder="Aktuell (Menge)" type="number" value={newItem.current_quantity} onChange={e => setNewItem(p => ({ ...p, current_quantity: e.target.value }))}
                    className="bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-orange-500" />
                  <input placeholder="Minimum" type="number" value={newItem.minimum_quantity} onChange={e => setNewItem(p => ({ ...p, minimum_quantity: e.target.value }))}
                    className="bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-orange-500" />
                  <input placeholder="Bestellmenge" type="number" value={newItem.order_quantity} onChange={e => setNewItem(p => ({ ...p, order_quantity: e.target.value }))}
                    className="bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-orange-500" />
                  <input placeholder="Preis/Einheit (€)" type="number" value={newItem.price_per_unit} onChange={e => setNewItem(p => ({ ...p, price_per_unit: e.target.value }))}
                    className="bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-orange-500" />
                </div>
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={newItem.auto_order} onChange={e => setNewItem(p => ({ ...p, auto_order: e.target.checked }))} className="accent-blue-500 w-4 h-4" />
                    <span className="text-sm text-gray-300">Automatisch bestellen wenn unter Minimum</span>
                  </label>
                  <div className="ml-auto flex gap-2">
                    <button onClick={() => setShowNewItem(false)} className="text-gray-400 hover:text-white px-3 py-1.5 text-sm transition-colors"><X size={14} /></button>
                    <button onClick={addItem} className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-1.5 rounded-xl text-sm font-medium transition-colors">Speichern</button>
                  </div>
                </div>
              </div>
            )}

            {items.length === 0 ? (
              <p className="p-8 text-center text-gray-500 text-sm">Noch keine Artikel.</p>
            ) : (
              <div className="divide-y divide-gray-800/50">
                {items.map(item => {
                  const istKritisch = item.current_quantity < item.minimum_quantity;
                  const prozent = Math.min((item.current_quantity / (Math.max(item.minimum_quantity, 1) * 2)) * 100, 100);
                  const inCart = cart.some(c => c.item.id === item.id);
                  return (
                    <div key={item.id} className="px-5 py-4 hover:bg-gray-800/30 transition-colors">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-3">
                          {istKritisch ? <AlertTriangle size={16} className="text-red-400 shrink-0" /> : <CheckCircle size={16} className="text-green-400 shrink-0" />}
                          <div>
                            <p className="text-white text-sm font-medium">{item.name}</p>
                            <p className="text-gray-400 text-xs">
                              {item.suppliers?.name ?? <span className="text-gray-600 italic">Kein Lieferant</span>}
                              {item.price_per_unit ? ` · ${item.price_per_unit.toFixed(2)} €/${item.unit}` : ""}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-1.5">
                            <span className="text-gray-500 text-xs">Auto</span>
                            <button onClick={() => toggleAuto(item)}>
                              {item.auto_order ? <ToggleRight size={22} className="text-blue-400" /> : <ToggleLeft size={22} className="text-gray-600" />}
                            </button>
                          </div>
                          <div className="text-right">
                            <p className={`text-sm font-medium ${istKritisch ? "text-red-400" : "text-white"}`}>
                              {item.current_quantity} {item.unit}
                            </p>
                            <p className="text-gray-500 text-xs">Min: {item.minimum_quantity} · Best: {item.order_quantity}</p>
                          </div>
                          {/* Zur Bestellung hinzufügen */}
                          <button
                            onClick={() => { toggleCart(item); if (!inCart) setTab("bestellen"); }}
                            title="Zur Bestellung hinzufügen"
                            className={`p-1.5 rounded-lg transition-colors ${inCart ? "bg-orange-500 text-white" : "bg-gray-800 hover:bg-orange-500 text-gray-400 hover:text-white"}`}>
                            {inCart ? <CheckCircle size={14} /> : <ShoppingCart size={14} />}
                          </button>
                        </div>
                      </div>
                      <div className="w-full bg-gray-800 rounded-full h-1.5">
                        <div className={`h-1.5 rounded-full transition-all ${istKritisch ? "bg-red-500" : "bg-green-500"}`} style={{ width: `${prozent}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* TAB: Lieferanten */}
      {tab === "lieferanten" && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button onClick={() => setShowNewSupplier(true)}
              className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-xl text-sm font-medium flex items-center gap-2 transition-colors">
              <Plus size={15} /> Lieferant hinzufügen
            </button>
          </div>

          {showNewSupplier && (
            <div className="bg-gray-900 border border-orange-500/30 rounded-2xl p-5 space-y-3">
              <h3 className="font-semibold text-white">Neuer Lieferant</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input placeholder="Name *" value={newSupplier.name} onChange={e => setNewSupplier(p => ({ ...p, name: e.target.value }))} className="bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-orange-500" />
                <input placeholder="Ansprechpartner" value={newSupplier.contact_person} onChange={e => setNewSupplier(p => ({ ...p, contact_person: e.target.value }))} className="bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-orange-500" />
                <input placeholder="Telefon" value={newSupplier.phone} onChange={e => setNewSupplier(p => ({ ...p, phone: e.target.value }))} className="bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-orange-500" />
                <input placeholder="E-Mail" value={newSupplier.email} onChange={e => setNewSupplier(p => ({ ...p, email: e.target.value }))} className="bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-orange-500" />
                <input placeholder="Kategorie (z.B. Fleisch)" value={newSupplier.category} onChange={e => setNewSupplier(p => ({ ...p, category: e.target.value }))} className="bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-orange-500" />
                <input placeholder="Lieferzeit (z.B. 1 Tag)" value={newSupplier.delivery_time} onChange={e => setNewSupplier(p => ({ ...p, delivery_time: e.target.value }))} className="bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-orange-500" />
                <input placeholder="Mindestbestellwert (€)" type="number" value={newSupplier.min_order_value} onChange={e => setNewSupplier(p => ({ ...p, min_order_value: e.target.value }))} className="bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-orange-500" />
                <input placeholder="Zahlungsziel (Tage)" type="number" value={newSupplier.payment_days} onChange={e => setNewSupplier(p => ({ ...p, payment_days: e.target.value }))} className="bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-orange-500" />
              </div>
              <div className="flex gap-2 justify-end">
                <button onClick={() => setShowNewSupplier(false)} className="text-gray-400 hover:text-white px-4 py-2 text-sm transition-colors">Abbrechen</button>
                <button onClick={addSupplier} className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors">Speichern</button>
              </div>
            </div>
          )}

          {suppliers.length === 0 ? (
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 text-center">
              <Package size={32} className="text-gray-600 mx-auto mb-3" />
              <p className="text-gray-500 text-sm">Noch keine Lieferanten.</p>
            </div>
          ) : suppliers.map(s => {
            const artikel = items.filter(i => i.supplier_id === s.id);
            const kritischCount = artikel.filter(i => i.current_quantity < i.minimum_quantity).length;
            const isOpen = expandedSupplier === s.id;
            return (
              <div key={s.id} className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
                <button className="w-full px-5 py-4 flex items-center justify-between hover:bg-gray-800/30 transition-colors"
                  onClick={() => setExpandedSupplier(isOpen ? null : s.id)}>
                  <div className="flex items-center gap-4 text-left">
                    <div className="w-10 h-10 rounded-xl bg-orange-500/20 text-orange-400 flex items-center justify-center font-bold text-sm">
                      {s.name.charAt(0)}
                    </div>
                    <div>
                      <p className="text-white font-semibold text-sm flex items-center gap-2">
                        {s.name}
                        {kritischCount > 0 && (
                          <span className="bg-red-500/20 text-red-400 text-xs px-2 py-0.5 rounded-full border border-red-500/20">
                            {kritischCount} kritisch
                          </span>
                        )}
                      </p>
                      <p className="text-gray-400 text-xs">{s.category ?? "–"} · {artikel.length} Artikel · Lieferzeit: {s.delivery_time ?? "–"}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={e => { e.stopPropagation(); initCart(s.id); }}
                      className="bg-orange-500 hover:bg-orange-600 text-white px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors">
                      <FileDown size={12} /> Bestellung PDF
                    </button>
                    {isOpen ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
                  </div>
                </button>

                {isOpen && (
                  <div className="border-t border-gray-800 px-5 py-4 space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {s.contact_person && (
                        <div className="flex items-center gap-2 bg-gray-800/50 rounded-xl px-4 py-3">
                          <Package size={15} className="text-orange-400" />
                          <div><p className="text-gray-500 text-xs">Ansprechpartner</p><p className="text-white text-sm">{s.contact_person}</p></div>
                        </div>
                      )}
                      {s.phone && (
                        <a href={`tel:${s.phone}`} className="flex items-center gap-2 bg-gray-800/50 hover:bg-gray-800 rounded-xl px-4 py-3 transition-colors">
                          <Phone size={15} className="text-green-400" />
                          <div><p className="text-gray-500 text-xs">Telefon</p><p className="text-white text-sm">{s.phone}</p></div>
                        </a>
                      )}
                      {s.email && (
                        <a href={`mailto:${s.email}`} className="flex items-center gap-2 bg-gray-800/50 hover:bg-gray-800 rounded-xl px-4 py-3 transition-colors">
                          <Mail size={15} className="text-blue-400" />
                          <div><p className="text-gray-500 text-xs">E-Mail</p><p className="text-white text-sm">{s.email}</p></div>
                        </a>
                      )}
                    </div>
                    {artikel.length > 0 && (
                      <div>
                        <p className="text-gray-400 text-xs font-medium mb-2">Artikel:</p>
                        <div className="space-y-2">
                          {artikel.map(item => {
                            const istKritisch = item.current_quantity < item.minimum_quantity;
                            return (
                              <div key={item.id} className="flex items-center justify-between bg-gray-800/40 rounded-xl px-4 py-2.5">
                                <div className="flex items-center gap-2">
                                  {istKritisch ? <AlertTriangle size={13} className="text-red-400" /> : <CheckCircle size={13} className="text-green-400" />}
                                  <span className="text-white text-sm">{item.name}</span>
                                  <span className="text-gray-500 text-xs">{item.current_quantity}/{item.minimum_quantity} {item.unit}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  {item.price_per_unit && <span className="text-gray-500 text-xs">{item.price_per_unit.toFixed(2)} €/{item.unit}</span>}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                    <div className="flex justify-end">
                      <button onClick={() => deleteSupplier(s.id)} className="text-red-400 hover:text-red-300 text-xs transition-colors">Lieferant entfernen</button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* TAB: Bestellung erstellen */}
      {tab === "bestellen" && (
        <div className="space-y-4">

          {/* Lieferant wählen */}
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
            <h3 className="text-white font-semibold mb-3">Lieferant auswählen</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
              {suppliers.map(s => {
                const kritischCount = items.filter(i => i.supplier_id === s.id && i.current_quantity < i.minimum_quantity).length;
                return (
                  <button
                    key={s.id}
                    onClick={() => {
                      setSelectedSupplier(s.id);
                      setCart([]);
                    }}
                    className={`rounded-xl p-3 text-left border transition-all ${selectedSupplier === s.id ? "border-orange-500 bg-orange-500/10" : "border-gray-800 bg-gray-800/30 hover:border-gray-700"}`}>
                    <div className="flex items-center gap-2 mb-1">
                      <div className="w-7 h-7 rounded-lg bg-orange-500/20 text-orange-400 flex items-center justify-center text-xs font-bold">
                        {s.name.charAt(0)}
                      </div>
                      <span className="text-white text-sm font-medium truncate">{s.name}</span>
                    </div>
                    <p className="text-gray-500 text-xs">{s.category || "–"}</p>
                    {kritischCount > 0 && (
                      <span className="text-red-400 text-xs">⚠ {kritischCount} kritisch</span>
                    )}
                  </button>
                );
              })}
              {suppliers.length === 0 && (
                <p className="text-gray-500 text-sm col-span-4">Keine Lieferanten vorhanden. Zuerst Lieferanten hinzufügen.</p>
              )}
            </div>
          </div>

          {/* Artikel auswählen */}
          {selectedSupplier && (
            <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
              <div className="p-5 border-b border-gray-800 flex items-center justify-between">
                <h3 className="text-white font-semibold">
                  Artikel von {suppliers.find(s => s.id === selectedSupplier)?.name}
                </h3>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      const liefArtikel = items.filter(i => i.supplier_id === selectedSupplier);
                      setCart(liefArtikel.map(item => ({ item, quantity: item.order_quantity || item.minimum_quantity || 1 })));
                    }}
                    className="text-xs text-gray-400 hover:text-white px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors">
                    Alle auswählen
                  </button>
                  <button
                    onClick={() => {
                      const kritisch = items.filter(i => i.supplier_id === selectedSupplier && i.current_quantity < i.minimum_quantity);
                      setCart(kritisch.map(item => ({ item, quantity: item.order_quantity || item.minimum_quantity })));
                    }}
                    className="text-xs text-red-400 hover:text-white px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 rounded-lg transition-colors">
                    Nur kritische
                  </button>
                </div>
              </div>

              <div className="divide-y divide-gray-800/50">
                {items.filter(i => i.supplier_id === selectedSupplier).length === 0 ? (
                  <p className="p-6 text-center text-gray-500 text-sm">Keine Artikel diesem Lieferanten zugeordnet.</p>
                ) : (
                  items.filter(i => i.supplier_id === selectedSupplier).map(item => {
                    const inCart   = cart.find(c => c.item.id === item.id);
                    const istKritisch = item.current_quantity < item.minimum_quantity;
                    return (
                      <div key={item.id}
                        className={`px-5 py-3 flex items-center gap-4 transition-colors ${inCart ? "bg-orange-500/5" : "hover:bg-gray-800/20"}`}>
                        <input
                          type="checkbox"
                          checked={!!inCart}
                          onChange={() => toggleCart(item)}
                          className="w-4 h-4 accent-orange-500 shrink-0 cursor-pointer"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            {istKritisch && <AlertTriangle size={13} className="text-red-400 shrink-0" />}
                            <p className="text-white text-sm font-medium truncate">{item.name}</p>
                          </div>
                          <p className="text-gray-500 text-xs">
                            Bestand: {item.current_quantity} {item.unit} · Min: {item.minimum_quantity}
                            {item.price_per_unit ? ` · ${item.price_per_unit.toFixed(2)} €/${item.unit}` : ""}
                          </p>
                        </div>
                        {inCart && (
                          <div className="flex items-center gap-2 shrink-0">
                            <button onClick={() => updateCartQty(item.id, inCart.quantity - 1)}
                              className="w-7 h-7 rounded-lg bg-gray-800 hover:bg-gray-700 text-white flex items-center justify-center text-sm font-bold transition-colors">−</button>
                            <input
                              type="number"
                              value={inCart.quantity}
                              onChange={e => updateCartQty(item.id, parseFloat(e.target.value) || 1)}
                              className="w-16 bg-gray-800 border border-gray-700 rounded-lg px-2 py-1 text-white text-sm text-center focus:outline-none focus:border-orange-500"
                            />
                            <span className="text-gray-400 text-xs">{item.unit}</span>
                            <button onClick={() => updateCartQty(item.id, inCart.quantity + 1)}
                              className="w-7 h-7 rounded-lg bg-gray-800 hover:bg-gray-700 text-white flex items-center justify-center text-sm font-bold transition-colors">+</button>
                          </div>
                        )}
                        {!inCart && (
                          <span className="text-gray-600 text-xs shrink-0">{item.order_quantity} {item.unit}</span>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* Bestellkorb-Zusammenfassung */}
          {cart.length > 0 && (
            <div className="bg-gray-900 border border-orange-500/20 rounded-2xl p-5">
              <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
                <ClipboardList size={16} className="text-orange-400" />
                Bestellübersicht ({cart.length} Artikel)
              </h3>
              <div className="space-y-2 mb-4">
                {cart.map(ci => {
                  const gesamt = ci.quantity * (ci.item.price_per_unit || 0);
                  return (
                    <div key={ci.item.id} className="flex items-center justify-between py-2 border-b border-gray-800/50 last:border-0">
                      <div className="flex items-center gap-2 min-w-0">
                        <button onClick={() => toggleCart(ci.item)} className="text-gray-600 hover:text-red-400 shrink-0 transition-colors">
                          <X size={14} />
                        </button>
                        <span className="text-white text-sm truncate">{ci.item.name}</span>
                      </div>
                      <div className="flex items-center gap-4 shrink-0">
                        <span className="text-gray-300 text-sm">{ci.quantity} {ci.item.unit}</span>
                        {ci.item.price_per_unit && (
                          <span className="text-orange-400 text-sm font-medium w-20 text-right">
                            {gesamt.toLocaleString("de-DE", { minimumFractionDigits: 2 })} €
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Gesamtsumme */}
              {cart.some(ci => ci.item.price_per_unit) && (
                <div className="bg-gray-800/50 rounded-xl p-3 mb-4">
                  {(() => {
                    const netto = cart.reduce((s, ci) => s + ci.quantity * (ci.item.price_per_unit || 0), 0);
                    const mwst  = netto * 0.19;
                    return (
                      <div className="space-y-1 text-sm">
                        <div className="flex justify-between text-gray-400">
                          <span>Netto:</span>
                          <span>{netto.toLocaleString("de-DE", { minimumFractionDigits: 2 })} €</span>
                        </div>
                        <div className="flex justify-between text-gray-400">
                          <span>MwSt. 19%:</span>
                          <span>{mwst.toLocaleString("de-DE", { minimumFractionDigits: 2 })} €</span>
                        </div>
                        <div className="flex justify-between text-white font-bold text-base border-t border-gray-700 pt-1">
                          <span>Gesamt (Brutto):</span>
                          <span className="text-orange-400">{(netto + mwst).toLocaleString("de-DE", { minimumFractionDigits: 2 })} €</span>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}

              <button
                onClick={handlePDF}
                disabled={generatingPDF}
                className="w-full py-3 rounded-xl bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white font-semibold flex items-center justify-center gap-2 transition-colors">
                <FileDown size={18} />
                {generatingPDF ? "PDF wird erstellt..." : "Bestellschein als PDF herunterladen"}
              </button>
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* TAB: Bestellhistorie */}
      {tab === "historie" && (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
          <div className="p-5 border-b border-gray-800">
            <h3 className="font-semibold text-white">Bestellhistorie</h3>
          </div>
          {orders.length === 0 ? (
            <p className="p-8 text-center text-gray-500 text-sm">Noch keine Bestellungen.</p>
          ) : (
            <div className="divide-y divide-gray-800/50">
              {orders.map(o => (
                <div key={o.id} className="px-5 py-4 flex items-center justify-between hover:bg-gray-800/30 transition-colors gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <Truck size={16} className="text-gray-500 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-white text-sm font-medium truncate">{o.article_name}</p>
                      <p className="text-gray-400 text-xs">{o.suppliers?.name ?? "–"} · {new Date(o.ordered_at).toLocaleDateString("de-DE")}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <div className="text-right">
                      <p className="text-white text-sm">{o.quantity} {o.unit ?? ""}</p>
                      {o.total_price != null && <p className="text-gray-500 text-xs">{o.total_price.toFixed(2)} €</p>}
                    </div>
                    <span className={`text-xs px-2.5 py-1 rounded-lg font-medium border ${statusColor[o.status] ?? "text-gray-400 bg-gray-700 border-gray-600"}`}>
                      {o.status}
                    </span>
                    {o.status !== "geliefert" && (
                      <button onClick={() => alsGeliefert(o)}
                        className="flex items-center gap-1.5 bg-green-500/10 hover:bg-green-500/20 border border-green-500/30 text-green-400 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap">
                        <CheckCircle size={12} /> Als geliefert
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

    </div>
  );
}
