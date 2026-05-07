"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useStore } from "@/lib/store";
import { ShoppingCart, Trash2, Plus, Minus, CreditCard, Banknote, Smartphone, CheckCircle, Loader2, UtensilsCrossed, RefreshCw } from "lucide-react";
import toast from "react-hot-toast";

type MenuItem = { id: string; name: string; price: number; category: string };
type CartItem = MenuItem & { qty: number };

const DEMO_ITEMS: MenuItem[] = [
  { id: "d1",  name: "Burger Classic",      price: 14.90, category: "Hauptgang" },
  { id: "d2",  name: "Schnitzel",           price: 16.50, category: "Hauptgang" },
  { id: "d3",  name: "Pasta Bolognese",     price: 12.90, category: "Hauptgang" },
  { id: "d4",  name: "Caesar Salad",        price: 9.90,  category: "Vorspeise" },
  { id: "d5",  name: "Tomatensuppe",        price: 6.50,  category: "Vorspeise" },
  { id: "d6",  name: "Bruschetta",          price: 7.90,  category: "Vorspeise" },
  { id: "d7",  name: "Tiramisu",            price: 6.90,  category: "Dessert"   },
  { id: "d8",  name: "Schokoladenkuchen",   price: 5.90,  category: "Dessert"   },
  { id: "d9",  name: "Cola 0,4L",           price: 3.50,  category: "Getränk"   },
  { id: "d10", name: "Wasser 0,5L",         price: 2.50,  category: "Getränk"   },
  { id: "d11", name: "Bier 0,5L",           price: 4.20,  category: "Getränk"   },
  { id: "d12", name: "Wein (Glas)",         price: 5.50,  category: "Getränk"   },
];

const KATEGORIEN = ["Alle", "Vorspeise", "Hauptgang", "Dessert", "Getränk"];
const ZAHLARTEN = [
  { id: "cash",   label: "Bar",     icon: Banknote,    color: "text-yellow-400 border-yellow-500/40 bg-yellow-500/10" },
  { id: "card",   label: "Karte",   icon: CreditCard,  color: "text-blue-400 border-blue-500/40 bg-blue-500/10" },
  { id: "online", label: "Online",  icon: Smartphone,  color: "text-purple-400 border-purple-500/40 bg-purple-500/10" },
];

export default function DemoKasse() {
  const { restaurant, profile } = useStore();
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [kategorie, setKategorie] = useState("Alle");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [tisch, setTisch] = useState<number | "">("");
  const [zahlart, setZahlart] = useState("cash");
  const [trinkgeld, setTrinkgeld] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [letzterBon, setLetzterBon] = useState<{ total: number; zahlart: string; tisch: number | "" } | null>(null);

  useEffect(() => {
    if (!restaurant) return;
    supabase.from("menu_items").select("*").eq("restaurant_id", restaurant.id).eq("is_active", true)
      .then(({ data }) => {
        if (data && data.length > 0) setMenuItems(data as MenuItem[]);
        else setMenuItems(DEMO_ITEMS);
      });
  }, [restaurant]);

  const sichtbar = kategorie === "Alle" ? menuItems : menuItems.filter(i => i.category === kategorie);

  function addToCart(item: MenuItem) {
    setCart(prev => {
      const existing = prev.find(c => c.id === item.id);
      if (existing) return prev.map(c => c.id === item.id ? { ...c, qty: c.qty + 1 } : c);
      return [...prev, { ...item, qty: 1 }];
    });
  }

  function removeFromCart(id: string) {
    setCart(prev => {
      const existing = prev.find(c => c.id === id);
      if (!existing) return prev;
      if (existing.qty === 1) return prev.filter(c => c.id !== id);
      return prev.map(c => c.id === id ? { ...c, qty: c.qty - 1 } : c);
    });
  }

  function deleteFromCart(id: string) {
    setCart(prev => prev.filter(c => c.id !== id));
  }

  const subtotal = cart.reduce((s, c) => s + c.price * c.qty, 0);
  const tip = parseFloat(trinkgeld) || 0;
  const total = subtotal + tip;
  const cartCount = cart.reduce((s, c) => s + c.qty, 0);

  async function bezahlen() {
    if (!restaurant || cart.length === 0) return;
    setLoading(true);

    try {
      // Sale erstellen
      const { data: sale, error: saleError } = await supabase.from("sales").insert({
        restaurant_id: restaurant.id,
        amount: subtotal,
        tip: tip || 0,
        payment_method: zahlart,
        table_number: tisch || null,
        recorded_by: profile?.id || null,
      }).select().single();

      if (saleError) throw saleError;

      // Bestellte Gerichte speichern
      if (sale && cart.length > 0) {
        const dishOrders = cart.map(c => ({
          restaurant_id: restaurant.id,
          sale_id: sale.id,
          menu_item_id: c.id.startsWith("d") ? null : c.id,
          quantity: c.qty,
          unit_price: c.price,
        }));
        await supabase.from("dish_orders").insert(dishOrders);
      }

      setLetzterBon({ total, zahlart, tisch });
      setCart([]);
      setTisch("");
      setTrinkgeld("");
      setSuccess(true);
      toast.success(`${total.toFixed(2)} € kassiert!`);
      setTimeout(() => setSuccess(false), 4000);
    } catch (e: any) {
      toast.error("Fehler: " + e.message);
    }
    setLoading(false);
  }

  function neuerBon() {
    setCart([]);
    setTisch("");
    setTrinkgeld("");
    setSuccess(false);
    setLetzterBon(null);
  }

  return (
    <div className="flex flex-col lg:flex-row gap-4 h-full">

      {/* Linke Seite — Speisekarte */}
      <div className="flex-1 space-y-4 min-w-0">
        <div>
          <h2 className="text-2xl font-bold text-white">Demo Kasse</h2>
          <p className="text-gray-400 text-sm mt-1">Zum Testen — alle Buchungen gehen direkt in die Datenbank</p>
        </div>

        {/* Kategorien */}
        <div className="flex gap-2 overflow-x-auto pb-1">
          {KATEGORIEN.map(k => (
            <button key={k} onClick={() => setKategorie(k)}
              className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${kategorie === k ? "bg-orange-500 text-white" : "bg-gray-900 border border-gray-800 text-gray-400 hover:text-white"}`}>
              {k}
            </button>
          ))}
        </div>

        {/* Artikel Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
          {sichtbar.map(item => {
            const imCart = cart.find(c => c.id === item.id);
            return (
              <button key={item.id} onClick={() => addToCart(item)}
                className={`relative p-4 rounded-2xl border text-left transition-all hover:scale-[1.02] active:scale-[0.98] ${
                  imCart ? "border-orange-500/50 bg-orange-500/10" : "border-gray-800 bg-gray-900 hover:border-gray-600"
                }`}>
                {imCart && (
                  <span className="absolute top-2 right-2 w-6 h-6 bg-orange-500 rounded-full text-white text-xs font-bold flex items-center justify-center">
                    {imCart.qty}
                  </span>
                )}
                <div className="w-8 h-8 rounded-xl bg-orange-500/20 flex items-center justify-center mb-2">
                  <UtensilsCrossed size={15} className="text-orange-400" />
                </div>
                <p className="text-white text-sm font-medium leading-tight">{item.name}</p>
                <p className="text-orange-400 text-sm font-bold mt-1">{item.price.toFixed(2)} €</p>
                <p className="text-gray-600 text-xs mt-0.5">{item.category}</p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Rechte Seite — Bon / Kasse */}
      <div className="w-full lg:w-80 xl:w-96 flex-shrink-0">
        <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden sticky top-0">

          {/* Bon Header */}
          <div className="p-4 border-b border-gray-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShoppingCart size={16} className="text-orange-400" />
              <span className="text-white font-semibold">Bestellung</span>
              {cartCount > 0 && <span className="bg-orange-500 text-white text-xs px-2 py-0.5 rounded-full">{cartCount}</span>}
            </div>
            {cart.length > 0 && (
              <button onClick={neuerBon} className="text-gray-500 hover:text-red-400 transition-colors">
                <Trash2 size={15} />
              </button>
            )}
          </div>

          {/* Erfolg-Anzeige */}
          {success && letzterBon && (
            <div className="p-5 text-center space-y-3 border-b border-gray-800 bg-green-500/5">
              <CheckCircle size={40} className="text-green-400 mx-auto" />
              <div>
                <p className="text-green-400 font-bold text-lg">{letzterBon.total.toFixed(2)} €</p>
                <p className="text-gray-400 text-sm">Bezahlt · {ZAHLARTEN.find(z => z.id === letzterBon.zahlart)?.label}</p>
                {letzterBon.tisch && <p className="text-gray-500 text-xs">Tisch {letzterBon.tisch}</p>}
              </div>
              <button onClick={neuerBon} className="flex items-center gap-2 mx-auto text-orange-400 hover:text-orange-300 text-sm transition-colors">
                <RefreshCw size={14} /> Neuer Bon
              </button>
            </div>
          )}

          {/* Warenkorb */}
          <div className="max-h-56 overflow-y-auto divide-y divide-gray-800/50">
            {cart.length === 0 && !success ? (
              <div className="p-8 text-center">
                <ShoppingCart size={28} className="text-gray-700 mx-auto mb-2" />
                <p className="text-gray-600 text-sm">Artikel auswählen</p>
              </div>
            ) : cart.map(item => (
              <div key={item.id} className="px-4 py-3 flex items-center gap-3">
                <div className="flex items-center gap-1">
                  <button onClick={() => removeFromCart(item.id)} className="w-6 h-6 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-400 flex items-center justify-center transition-colors">
                    <Minus size={11} />
                  </button>
                  <span className="text-white text-sm font-bold w-5 text-center">{item.qty}</span>
                  <button onClick={() => addToCart(item)} className="w-6 h-6 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-400 flex items-center justify-center transition-colors">
                    <Plus size={11} />
                  </button>
                </div>
                <span className="text-white text-sm flex-1 truncate">{item.name}</span>
                <div className="text-right">
                  <p className="text-white text-sm font-medium">{(item.price * item.qty).toFixed(2)} €</p>
                  <p className="text-gray-600 text-xs">{item.price.toFixed(2)} €/Stk.</p>
                </div>
                <button onClick={() => deleteFromCart(item.id)} className="text-gray-700 hover:text-red-400 transition-colors">
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>

          {/* Tisch + Trinkgeld */}
          {cart.length > 0 && (
            <div className="p-4 border-t border-gray-800 space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-gray-500 text-xs mb-1 block">Tischnummer</label>
                  <input type="number" min={1} max={99} value={tisch} onChange={e => setTisch(e.target.value ? parseInt(e.target.value) : "")}
                    placeholder="z.B. 5"
                    className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-orange-500 text-center" />
                </div>
                <div>
                  <label className="text-gray-500 text-xs mb-1 block">Trinkgeld (€)</label>
                  <input type="number" min={0} step={0.5} value={trinkgeld} onChange={e => setTrinkgeld(e.target.value)}
                    placeholder="0.00"
                    className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-orange-500 text-center" />
                </div>
              </div>

              {/* Zahlart */}
              <div>
                <label className="text-gray-500 text-xs mb-2 block">Zahlungsart</label>
                <div className="grid grid-cols-3 gap-2">
                  {ZAHLARTEN.map(z => {
                    const Icon = z.icon;
                    return (
                      <button key={z.id} onClick={() => setZahlart(z.id)}
                        className={`flex flex-col items-center gap-1 p-2.5 rounded-xl border text-xs font-medium transition-all ${zahlart === z.id ? z.color : "border-gray-700 text-gray-500 hover:text-gray-300 hover:border-gray-600"}`}>
                        <Icon size={16} />
                        {z.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Totals */}
              <div className="space-y-1 pt-1 border-t border-gray-800">
                <div className="flex justify-between text-sm text-gray-400">
                  <span>Zwischensumme</span>
                  <span>{subtotal.toFixed(2)} €</span>
                </div>
                {tip > 0 && (
                  <div className="flex justify-between text-sm text-gray-400">
                    <span>Trinkgeld</span>
                    <span>+{tip.toFixed(2)} €</span>
                  </div>
                )}
                <div className="flex justify-between text-base font-bold text-white pt-1">
                  <span>Gesamt</span>
                  <span className="text-orange-400">{total.toFixed(2)} €</span>
                </div>
              </div>

              {/* Bezahlen Button */}
              <button onClick={bezahlen} disabled={loading || cart.length === 0}
                className="w-full bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white font-bold py-3.5 rounded-xl transition-colors flex items-center justify-center gap-2 text-base shadow-lg shadow-orange-500/20">
                {loading
                  ? <><Loader2 size={18} className="animate-spin" /> Buche...</>
                  : <><CheckCircle size={18} /> {total.toFixed(2)} € kassieren</>}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
