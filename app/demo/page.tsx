"use client";
import { useState } from "react";
import {
  ShoppingCart, Trash2, Plus, Minus, CreditCard, Banknote, Smartphone,
  CheckCircle, UtensilsCrossed, RefreshCw, ChefHat, ArrowRight,
  Receipt, TrendingUp, Users, Clock,
} from "lucide-react";
import Link from "next/link";

type MenuItem = { id: string; name: string; price: number; category: string; emoji: string };
type CartItem = MenuItem & { qty: number };

const MENU: MenuItem[] = [
  { id: "1",  name: "Burger Classic",     price: 14.90, category: "Hauptgang", emoji: "🍔" },
  { id: "2",  name: "Schnitzel",          price: 16.50, category: "Hauptgang", emoji: "🥩" },
  { id: "3",  name: "Pasta Bolognese",    price: 12.90, category: "Hauptgang", emoji: "🍝" },
  { id: "4",  name: "Pizza Margherita",   price: 13.50, category: "Hauptgang", emoji: "🍕" },
  { id: "5",  name: "Caesar Salad",       price: 9.90,  category: "Vorspeise", emoji: "🥗" },
  { id: "6",  name: "Tomatensuppe",       price: 6.50,  category: "Vorspeise", emoji: "🍲" },
  { id: "7",  name: "Bruschetta",         price: 7.90,  category: "Vorspeise", emoji: "🥖" },
  { id: "8",  name: "Tiramisu",           price: 6.90,  category: "Dessert",   emoji: "🍮" },
  { id: "9",  name: "Schokoladenkuchen",  price: 5.90,  category: "Dessert",   emoji: "🍰" },
  { id: "10", name: "Cola 0,4L",          price: 3.50,  category: "Getränk",   emoji: "🥤" },
  { id: "11", name: "Wasser 0,5L",        price: 2.50,  category: "Getränk",   emoji: "💧" },
  { id: "12", name: "Bier 0,5L",          price: 4.20,  category: "Getränk",   emoji: "🍺" },
  { id: "13", name: "Wein (Glas)",        price: 5.50,  category: "Getränk",   emoji: "🍷" },
  { id: "14", name: "Espresso",           price: 2.80,  category: "Getränk",   emoji: "☕" },
];

const KATEGORIEN = ["Alle", "Vorspeise", "Hauptgang", "Dessert", "Getränk"];

const ZAHLARTEN = [
  { id: "cash",   label: "Bar",    icon: Banknote,   color: "text-yellow-400 border-yellow-500/40 bg-yellow-500/10" },
  { id: "card",   label: "Karte",  icon: CreditCard, color: "text-blue-400 border-blue-500/40 bg-blue-500/10" },
  { id: "online", label: "Online", icon: Smartphone, color: "text-purple-400 border-purple-500/40 bg-purple-500/10" },
];

type Sale = { items: CartItem[]; total: number; zahlart: string; tisch: number | ""; time: string };

export default function DemoPage() {
  const [kategorie, setKategorie] = useState("Alle");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [tisch, setTisch] = useState<number | "">("");
  const [zahlart, setZahlart] = useState("cash");
  const [trinkgeld, setTrinkgeld] = useState("");
  const [success, setSuccess] = useState(false);
  const [letzterBon, setLetzterBon] = useState<Sale | null>(null);
  const [history, setHistory] = useState<Sale[]>([]);
  const [tab, setTab] = useState<"kasse" | "stats">("kasse");

  const sichtbar = kategorie === "Alle" ? MENU : MENU.filter(i => i.category === kategorie);

  function add(item: MenuItem) {
    setCart(prev => {
      const ex = prev.find(c => c.id === item.id);
      if (ex) return prev.map(c => c.id === item.id ? { ...c, qty: c.qty + 1 } : c);
      return [...prev, { ...item, qty: 1 }];
    });
  }

  function remove(id: string) {
    setCart(prev => {
      const ex = prev.find(c => c.id === id);
      if (!ex) return prev;
      if (ex.qty === 1) return prev.filter(c => c.id !== id);
      return prev.map(c => c.id === id ? { ...c, qty: c.qty - 1 } : c);
    });
  }

  function deleteItem(id: string) {
    setCart(prev => prev.filter(c => c.id !== id));
  }

  const subtotal = cart.reduce((s, c) => s + c.price * c.qty, 0);
  const tip = parseFloat(trinkgeld) || 0;
  const total = subtotal + tip;
  const cartCount = cart.reduce((s, c) => s + c.qty, 0);

  function bezahlen() {
    if (cart.length === 0) return;
    const sale: Sale = {
      items: [...cart],
      total,
      zahlart,
      tisch,
      time: new Date().toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" }),
    };
    setHistory(prev => [sale, ...prev]);
    setLetzterBon(sale);
    setSuccess(true);
    setCart([]);
    setTisch("");
    setTrinkgeld("");
  }

  function neuerBon() {
    setSuccess(false);
    setLetzterBon(null);
  }

  const totalUmsatz = history.reduce((s, h) => s + h.total, 0);
  const topItem = (() => {
    const counts: Record<string, { name: string; count: number }> = {};
    history.forEach(h => h.items.forEach(i => {
      if (!counts[i.id]) counts[i.id] = { name: i.name, count: 0 };
      counts[i.id].count += i.qty;
    }));
    return Object.values(counts).sort((a, b) => b.count - a.count)[0];
  })();

  return (
    <div className="min-h-screen bg-gray-950">

      {/* Top Bar */}
      <div className="bg-gray-900 border-b border-gray-800 px-4 sm:px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-orange-500 rounded-xl flex items-center justify-center shadow-lg shadow-orange-500/20">
            <ChefHat size={18} className="text-white" />
          </div>
          <div>
            <p className="text-white font-bold text-sm">Restaurant System</p>
            <p className="text-orange-400 text-xs font-medium">Live Demo — Mamma Mia</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex gap-1 bg-gray-800 p-1 rounded-xl">
            <button onClick={() => setTab("kasse")}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${tab === "kasse" ? "bg-orange-500 text-white" : "text-gray-400 hover:text-white"}`}>
              Kasse
            </button>
            <button onClick={() => setTab("stats")}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${tab === "stats" ? "bg-orange-500 text-white" : "text-gray-400 hover:text-white"}`}>
              Statistik
            </button>
          </div>
          <Link href="/auth"
            className="hidden sm:flex items-center gap-1.5 bg-orange-500 hover:bg-orange-600 text-white text-xs font-semibold px-3 py-2 rounded-xl transition-colors">
            Anmelden <ArrowRight size={13} />
          </Link>
        </div>
      </div>

      {/* Stats Tab */}
      {tab === "stats" && (
        <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: "Umsatz heute",   value: `${totalUmsatz.toFixed(2)} €`, icon: TrendingUp, color: "text-orange-400" },
              { label: "Bons",           value: history.length,                 icon: Receipt,    color: "text-blue-400" },
              { label: "Ø Bon",          value: history.length ? `${(totalUmsatz / history.length).toFixed(2)} €` : "—", icon: ShoppingCart, color: "text-green-400" },
              { label: "Top Artikel",    value: topItem?.name || "—",           icon: Users,      color: "text-purple-400" },
            ].map(k => (
              <div key={k.label} className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
                <k.icon size={18} className={`${k.color} mb-2`} />
                <p className="text-gray-400 text-xs mb-1">{k.label}</p>
                <p className="text-white font-bold text-sm truncate">{k.value}</p>
              </div>
            ))}
          </div>

          <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
            <div className="p-4 border-b border-gray-800">
              <h3 className="text-white font-semibold flex items-center gap-2">
                <Receipt size={16} className="text-orange-400" /> Letzte Bons ({history.length})
              </h3>
            </div>
            {history.length === 0 ? (
              <div className="p-10 text-center text-gray-600 text-sm">
                Noch keine Bons — kassiere etwas in der Kasse!
              </div>
            ) : (
              <div className="divide-y divide-gray-800/50">
                {history.map((h, i) => (
                  <div key={i} className="px-4 py-3 flex items-center gap-4">
                    <div className="w-8 h-8 rounded-lg bg-orange-500/20 flex items-center justify-center text-orange-400 text-xs font-bold">
                      #{history.length - i}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-sm font-medium">
                        {h.items.map(i => `${i.qty}× ${i.name}`).join(", ")}
                      </p>
                      <p className="text-gray-500 text-xs">
                        {ZAHLARTEN.find(z => z.id === h.zahlart)?.label}
                        {h.tisch ? ` · Tisch ${h.tisch}` : ""} · {h.time}
                      </p>
                    </div>
                    <p className="text-orange-400 font-bold text-sm shrink-0">{h.total.toFixed(2)} €</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-orange-500/5 border border-orange-500/20 rounded-2xl p-5 text-center">
            <p className="text-orange-300 font-semibold mb-1">Das ist nur eine Demo</p>
            <p className="text-gray-400 text-sm mb-4">Alle Daten werden nur lokal gespeichert. Im echten System gehen alle Bons direkt in die Cloud.</p>
            <Link href="/auth"
              className="inline-flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white font-semibold px-5 py-2.5 rounded-xl transition-colors text-sm">
              Jetzt kostenlos testen <ArrowRight size={15} />
            </Link>
          </div>
        </div>
      )}

      {/* Kasse Tab */}
      {tab === "kasse" && (
        <div className="flex flex-col lg:flex-row gap-0 lg:gap-4 h-[calc(100vh-57px)]">

          {/* Linke Seite — Speisekarte */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
            {/* Kategorien */}
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
              {KATEGORIEN.map(k => (
                <button key={k} onClick={() => setKategorie(k)}
                  className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all shrink-0 ${
                    kategorie === k
                      ? "bg-orange-500 text-white shadow-lg shadow-orange-500/20"
                      : "bg-gray-900 border border-gray-800 text-gray-400 hover:text-white"
                  }`}>
                  {k}
                </button>
              ))}
            </div>

            {/* Artikel Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
              {sichtbar.map(item => {
                const imCart = cart.find(c => c.id === item.id);
                return (
                  <button key={item.id} onClick={() => add(item)}
                    className={`relative p-4 rounded-2xl border text-left transition-all hover:scale-[1.02] active:scale-[0.97] ${
                      imCart
                        ? "border-orange-500/50 bg-orange-500/10 shadow-lg shadow-orange-500/10"
                        : "border-gray-800 bg-gray-900 hover:border-gray-700"
                    }`}>
                    {imCart && (
                      <span className="absolute top-2 right-2 w-6 h-6 bg-orange-500 rounded-full text-white text-xs font-bold flex items-center justify-center shadow-lg">
                        {imCart.qty}
                      </span>
                    )}
                    <div className="text-2xl mb-2">{item.emoji}</div>
                    <p className="text-white text-sm font-medium leading-tight">{item.name}</p>
                    <p className="text-orange-400 text-sm font-bold mt-1">{item.price.toFixed(2)} €</p>
                    <p className="text-gray-600 text-xs mt-0.5">{item.category}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Rechte Seite — Bon */}
          <div className="w-full lg:w-80 xl:w-96 shrink-0 border-t lg:border-t-0 lg:border-l border-gray-800 bg-gray-900 flex flex-col">

            {/* Bon Header */}
            <div className="p-4 border-b border-gray-800 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <ShoppingCart size={16} className="text-orange-400" />
                <span className="text-white font-semibold">Bestellung</span>
                {cartCount > 0 && (
                  <span className="bg-orange-500 text-white text-xs px-2 py-0.5 rounded-full">{cartCount}</span>
                )}
              </div>
              {cart.length > 0 && (
                <button onClick={() => setCart([])} className="text-gray-500 hover:text-red-400 transition-colors p-1">
                  <Trash2 size={15} />
                </button>
              )}
            </div>

            {/* Erfolg */}
            {success && letzterBon && (
              <div className="p-6 text-center space-y-3 border-b border-gray-800 bg-green-500/5 shrink-0">
                <div className="w-14 h-14 bg-green-500/20 rounded-2xl flex items-center justify-center mx-auto">
                  <CheckCircle size={28} className="text-green-400" />
                </div>
                <div>
                  <p className="text-green-400 font-bold text-xl">{letzterBon.total.toFixed(2)} €</p>
                  <p className="text-gray-400 text-sm">
                    {ZAHLARTEN.find(z => z.id === letzterBon.zahlart)?.label} kassiert
                  </p>
                  {letzterBon.tisch && (
                    <p className="text-gray-500 text-xs mt-0.5">Tisch {letzterBon.tisch}</p>
                  )}
                </div>
                <button onClick={neuerBon}
                  className="flex items-center gap-2 mx-auto text-orange-400 hover:text-orange-300 text-sm transition-colors">
                  <RefreshCw size={14} /> Neuer Bon
                </button>
              </div>
            )}

            {/* Warenkorb */}
            <div className="flex-1 overflow-y-auto divide-y divide-gray-800/50 min-h-0">
              {cart.length === 0 && !success ? (
                <div className="h-full flex flex-col items-center justify-center gap-3 p-8 text-center">
                  <div className="w-14 h-14 bg-gray-800 rounded-2xl flex items-center justify-center">
                    <UtensilsCrossed size={22} className="text-gray-600" />
                  </div>
                  <p className="text-gray-600 text-sm">Artikel aus der Karte auswählen</p>
                </div>
              ) : (
                cart.map(item => (
                  <div key={item.id} className="px-4 py-3 flex items-center gap-3">
                    <div className="flex items-center gap-1">
                      <button onClick={() => remove(item.id)}
                        className="w-6 h-6 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-400 flex items-center justify-center transition-colors">
                        <Minus size={11} />
                      </button>
                      <span className="text-white text-sm font-bold w-5 text-center">{item.qty}</span>
                      <button onClick={() => add(item)}
                        className="w-6 h-6 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-400 flex items-center justify-center transition-colors">
                        <Plus size={11} />
                      </button>
                    </div>
                    <span className="text-white text-sm flex-1 truncate">{item.name}</span>
                    <div className="text-right shrink-0">
                      <p className="text-white text-sm font-medium">{(item.price * item.qty).toFixed(2)} €</p>
                      <p className="text-gray-600 text-xs">{item.price.toFixed(2)} €/Stk</p>
                    </div>
                    <button onClick={() => deleteItem(item.id)} className="text-gray-700 hover:text-red-400 transition-colors">
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))
              )}
            </div>

            {/* Eingaben + Zahlen */}
            {cart.length > 0 && (
              <div className="p-4 border-t border-gray-800 space-y-3 shrink-0">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-gray-500 text-xs mb-1 block">Tischnummer</label>
                    <input type="number" min={1} max={99} value={tisch}
                      onChange={e => setTisch(e.target.value ? parseInt(e.target.value) : "")}
                      placeholder="z.B. 5"
                      className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white text-center focus:outline-none focus:border-orange-500 transition-colors" />
                  </div>
                  <div>
                    <label className="text-gray-500 text-xs mb-1 block">Trinkgeld (€)</label>
                    <input type="number" min={0} step={0.5} value={trinkgeld}
                      onChange={e => setTrinkgeld(e.target.value)}
                      placeholder="0.00"
                      className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white text-center focus:outline-none focus:border-orange-500 transition-colors" />
                  </div>
                </div>

                {/* Zahlart */}
                <div className="grid grid-cols-3 gap-2">
                  {ZAHLARTEN.map(z => {
                    const Icon = z.icon;
                    return (
                      <button key={z.id} onClick={() => setZahlart(z.id)}
                        className={`flex flex-col items-center gap-1 p-2.5 rounded-xl border text-xs font-medium transition-all ${
                          zahlart === z.id ? z.color : "border-gray-700 text-gray-500 hover:text-gray-300 hover:border-gray-600"
                        }`}>
                        <Icon size={16} />
                        {z.label}
                      </button>
                    );
                  })}
                </div>

                {/* Summen */}
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

                <button onClick={bezahlen}
                  className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold py-3.5 rounded-xl transition-colors flex items-center justify-center gap-2 shadow-lg shadow-orange-500/20">
                  <CheckCircle size={18} /> {total.toFixed(2)} € kassieren
                </button>
              </div>
            )}

            {/* Demo Badge */}
            <div className="px-4 py-3 border-t border-gray-800 shrink-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                  <span className="text-gray-500 text-xs">Demo-Modus · keine echten Daten</span>
                </div>
                <Link href="/auth" className="text-orange-400 hover:text-orange-300 text-xs font-medium transition-colors">
                  Anmelden →
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
