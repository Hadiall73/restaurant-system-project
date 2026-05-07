"use client";
import { useEffect, useState } from "react";
import { useStore } from "@/lib/store";
import { supabase } from "@/lib/supabase";
import { Copy, CheckCircle, Plug, Trash2, RefreshCw, Wifi, WifiOff, Zap, Clock, Euro, ChevronDown, ChevronUp, Download, Terminal } from "lucide-react";
import toast from "react-hot-toast";

const PROVIDERS = [
  {
    id: "sumup", name: "SumUp", color: "bg-blue-500", textColor: "text-blue-400",
    steps: [
      "Öffne die SumUp App → Profil → Einstellungen",
      'Scrolle zu "Entwickler" oder "API & Webhooks"',
      'Klicke auf "Webhook hinzufügen" und füge deine URL ein',
      'Wähle Events: "payment.completed"',
      "Speichern — ab sofort wird jeder Verkauf übertragen",
    ],
  },
  {
    id: "square", name: "Square", color: "bg-gray-600", textColor: "text-gray-300",
    steps: [
      "Gehe auf developer.squareup.com und melde dich an",
      'Wähle deine App → linkes Menü: "Webhooks"',
      'Klicke auf "Add Webhook" und füge deine URL ein',
      'Wähle Events: "payment.completed" und "order.updated"',
      "Speichern — Verkäufe werden automatisch gesendet",
    ],
  },
  {
    id: "lightspeed", name: "Lightspeed", color: "bg-orange-500", textColor: "text-orange-400",
    steps: [
      "Melde dich im Lightspeed Backend an",
      'Gehe zu "Einstellungen" → "API" → "Webhooks"',
      'Klicke auf "Neuer Webhook"',
      "Füge deine Webhook-URL ein — Ereignis: Verkauf abgeschlossen",
      "Speichern und Verbindung testen",
    ],
  },
  {
    id: "orderbird", name: "orderbird", color: "bg-green-600", textColor: "text-green-400",
    steps: [
      "Öffne manager.orderbird.com",
      'Gehe zu "Einstellungen" → "Integrationen" → "Webhooks"',
      'Klicke auf "Webhook hinzufügen"',
      "Füge die Webhook-URL ein — aktiviere: Bon/Zahlung abgeschlossen",
      "Speichern — orderbird sendet nun jeden Bon automatisch",
    ],
  },
  {
    id: "gastrofix", name: "Gastrofix", color: "bg-purple-600", textColor: "text-purple-400",
    steps: [
      "Melde dich im Gastrofix Backoffice an",
      'Gehe zu "Einstellungen" → "Schnittstellen" → "Webhook"',
      "Füge deine URL in das Webhook-URL-Feld ein",
      'Aktiviere: "Transaktion abgeschlossen"',
      "Speichern",
    ],
  },
  {
    id: "zettle", name: "Zettle (PayPal)", color: "bg-blue-700", textColor: "text-blue-300",
    steps: [
      "Gehe auf developer.zettle.com und erstelle eine App",
      "Öffne die Webhook-Einstellungen deiner App",
      'Klicke auf "Create Subscription"',
      'Wähle Event "PAYMENT" und füge deine URL ein',
      "Bestätige — jede Zahlung wird nun übertragen",
    ],
  },
  {
    id: "gastroware", name: "Gastroware", color: "bg-red-600", textColor: "text-red-400",
    bridge: true,
    steps: [
      "Node.js installieren: nodejs.org (einmalig)",
      'Ordner erstellen: C:\\GastrowareBridge\\',
      "Bridge-Skript herunterladen und dort speichern",
      "CMD öffnen → cd C:\\GastrowareBridge → npm install mysql2",
      "Webhook-URL & Datenbankdaten im Skript eintragen",
      "node gastroware-bridge.js → fertig, Echtzeit-Sync läuft",
    ],
  },
  {
    id: "generic", name: "Andere / Custom", color: "bg-gray-500", textColor: "text-gray-300",
    steps: [
      "Öffne die Einstellungen deines Kassensystems",
      'Suche nach: "Webhook", "HTTP-Callback" oder "Push-URL"',
      "Füge deine Webhook-URL ein",
      "Stelle sicher dass POST-Requests gesendet werden",
      "Teste die Verbindung",
    ],
  },
];

interface RecentSale {
  id: string;
  amount: number;
  payment_method: string;
  table_number?: number;
  recorded_at: string;
}

function statusColor(lastSync: string | null) {
  if (!lastSync) return { dot: "bg-gray-500", text: "text-gray-400", label: "Noch kein Sync" };
  const mins = (Date.now() - new Date(lastSync).getTime()) / 60000;
  if (mins < 60) return { dot: "bg-green-500", text: "text-green-400", label: `Zuletzt: ${new Date(lastSync).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}` };
  if (mins < 1440) return { dot: "bg-yellow-500", text: "text-yellow-400", label: `Zuletzt: ${new Date(lastSync).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}` };
  return { dot: "bg-red-500", text: "text-red-400", label: "Seit über 24h kein Sync" };
}

export default function PosConnect() {
  const { restaurant } = useStore();
  const [connections, setConnections] = useState<any[]>([]);
  const [connecting, setConnecting] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState("");
  const [copiedId, setCopiedId] = useState("");
  const [testingId, setTestingId] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [recentSales, setRecentSales] = useState<RecentSale[]>([]);
  const [liveConnected, setLiveConnected] = useState(false);
  const baseUrl = typeof window !== "undefined" ? window.location.origin : "";

  useEffect(() => {
    if (restaurant?.id) {
      loadConnections();
      loadRecentSales();
    }
  }, [restaurant]);

  // Supabase Realtime + Polling-Fallback alle 5s
  useEffect(() => {
    if (!restaurant?.id) return;

    const channel = supabase
      .channel(`pos-sales-${restaurant.id}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "sales",
        filter: `restaurant_id=eq.${restaurant.id}`,
      }, (payload) => {
        setRecentSales(prev => [payload.new as RecentSale, ...prev].slice(0, 20));
        loadConnections();
      })
      .subscribe((status) => {
        setLiveConnected(status === "SUBSCRIBED");
      });

    // Polling-Fallback: alle 5 Sekunden aktualisieren
    const poll = setInterval(() => loadRecentSales(), 5000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(poll);
    };
  }, [restaurant]);

  async function loadConnections() {
    const res = await fetch(`/api/pos/connect?restaurant_id=${restaurant!.id}`);
    const data = await res.json();
    setConnections((data.connections || []).filter((c: any) => c.is_active));
  }

  async function loadRecentSales() {
    const { data } = await supabase
      .from("sales")
      .select("id, amount, payment_method, table_number, recorded_at")
      .eq("restaurant_id", restaurant!.id)
      .order("recorded_at", { ascending: false })
      .limit(20);
    if (data) setRecentSales(data);
  }

  async function connect() {
    if (!selectedProvider || !restaurant) return;
    setConnecting(true);
    const res = await fetch("/api/pos/connect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ restaurant_id: restaurant.id, provider: selectedProvider }),
    });
    const data = await res.json();
    if (data.connection) {
      toast.success("Kassensystem verbunden!");
      setSelectedProvider("");
      setExpandedId(data.connection.id);
      loadConnections();
    } else {
      toast.error(data.error || "Fehler");
    }
    setConnecting(false);
  }

  async function disconnect(id: string) {
    await fetch("/api/pos/connect", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    toast.success("Verbindung getrennt");
    loadConnections();
  }

  async function sendTest(conn: any) {
    setTestingId(conn.id);
    const res = await fetch("/api/pos/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ connection_id: conn.id, restaurant_id: restaurant!.id }),
    });
    const data = await res.json();
    if (data.success) {
      toast.success(`✓ Test-Verkauf: ${data.amount.toFixed(2)} € (${data.method}) empfangen!`);
      loadConnections();
    } else {
      toast.error(data.error || "Test fehlgeschlagen");
    }
    setTestingId("");
  }

  function copyWebhook(conn: any) {
    const url = `${baseUrl}/api/pos/webhook/${restaurant!.id}?key=${conn.api_key}`;
    navigator.clipboard.writeText(url);
    setCopiedId(conn.id + "_webhook");
    setTimeout(() => setCopiedId(""), 2000);
    toast.success("Webhook URL kopiert!");
  }

  const provider = (id: string) => PROVIDERS.find(p => p.id === id);
  const connectedProviderIds = new Set(connections.map(c => c.provider));

  return (
    <div className="space-y-6 p-1">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white">Kassensystem verbinden</h2>
          <p className="text-gray-400 text-sm mt-1">Verbinde deine Kasse — Umsätze fließen automatisch in Echtzeit</p>
        </div>
        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold border shrink-0 ${
          liveConnected
            ? "bg-green-500/10 border-green-500/30 text-green-400"
            : "bg-gray-800 border-gray-700 text-gray-500"
        }`}>
          <span className={`w-2 h-2 rounded-full ${liveConnected ? "bg-green-400 animate-pulse" : "bg-gray-600"}`} />
          {liveConnected ? "LIVE verbunden" : "Verbinde..."}
        </div>
      </div>

      {/* How it works */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { step: "1", label: "Kassensystem wählen", icon: Plug, color: "text-orange-400", bg: "bg-orange-500/10" },
          { step: "2", label: "Webhook URL kopieren", icon: Copy, color: "text-blue-400", bg: "bg-blue-500/10" },
          { step: "3", label: "URL in Kasse eintragen", icon: Wifi, color: "text-purple-400", bg: "bg-purple-500/10" },
          { step: "4", label: "Verkäufe fließen automatisch", icon: Zap, color: "text-green-400", bg: "bg-green-500/10" },
        ].map(s => (
          <div key={s.step} className={`${s.bg} rounded-2xl p-4 flex flex-col items-center text-center gap-2`}>
            <div className={`w-8 h-8 rounded-full ${s.bg} border border-current ${s.color} flex items-center justify-center text-xs font-bold`}>{s.step}</div>
            <s.icon size={18} className={s.color} />
            <p className="text-gray-300 text-xs font-medium">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Add new connection */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
        <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
          <Plug size={16} className="text-orange-400" /> Kassensystem hinzufügen
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
          {PROVIDERS.map(p => {
            const alreadyConnected = connectedProviderIds.has(p.id);
            return (
              <button key={p.id}
                onClick={() => !alreadyConnected && setSelectedProvider(p.id)}
                disabled={alreadyConnected}
                className={`p-3 rounded-xl border text-sm font-medium transition-all relative ${
                  alreadyConnected
                    ? "border-green-500/30 bg-green-500/5 text-gray-500 cursor-default"
                    : selectedProvider === p.id
                    ? "border-orange-500 bg-orange-500/20 text-white"
                    : "border-gray-700 text-gray-400 hover:border-gray-500 hover:text-white"
                }`}>
                <div className={`w-3 h-3 rounded-full ${p.color} mx-auto mb-1`} />
                {p.name}
                {alreadyConnected && (
                  <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-green-500" />
                )}
              </button>
            );
          })}
        </div>
        <button onClick={connect} disabled={!selectedProvider || connecting}
          className="bg-orange-500 hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed text-white px-6 py-2.5 rounded-xl text-sm font-medium transition-colors flex items-center gap-2">
          {connecting ? <><RefreshCw size={14} className="animate-spin" /> Verbinde...</> : <><Plug size={14} /> Verbindung erstellen</>}
        </button>
      </div>

      {/* Active connections */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-white">Verbundene Kassen ({connections.length})</h3>
          <button onClick={loadConnections} className="text-gray-500 hover:text-white transition-colors p-1.5 rounded-lg hover:bg-gray-800">
            <RefreshCw size={14} />
          </button>
        </div>

        {connections.length === 0 && (
          <div className="bg-gray-900 border border-dashed border-gray-700 rounded-2xl p-8 text-center">
            <WifiOff size={32} className="text-gray-600 mx-auto mb-3" />
            <p className="text-gray-500 text-sm">Noch keine Kasse verbunden</p>
            <p className="text-gray-600 text-xs mt-1">Wähle oben ein Kassensystem aus</p>
          </div>
        )}

        {connections.map(conn => {
          const prov = provider(conn.provider);
          const webhookUrl = `${baseUrl}/api/pos/webhook/${restaurant?.id}?key=${conn.api_key}`;
          const status = statusColor(conn.last_sync);
          const isExpanded = expandedId === conn.id;

          return (
            <div key={conn.id} className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
              {/* Header */}
              <div className="p-5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-3 h-3 rounded-full ${prov?.color || "bg-gray-500"}`} />
                  <span className="text-white font-semibold">{prov?.name || conn.provider}</span>
                  <div className="flex items-center gap-1.5">
                    <span className={`w-2 h-2 rounded-full ${status.dot} ${conn.last_sync && (Date.now() - new Date(conn.last_sync).getTime()) < 3600000 ? "animate-pulse" : ""}`} />
                    <span className={`text-xs ${status.text}`}>{status.label}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => sendTest(conn)}
                    disabled={testingId === conn.id}
                    className="flex items-center gap-1.5 bg-green-500/10 hover:bg-green-500/20 border border-green-500/30 text-green-400 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-50">
                    {testingId === conn.id
                      ? <><RefreshCw size={12} className="animate-spin" /> Teste...</>
                      : <><Zap size={12} /> Test senden</>}
                  </button>
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : conn.id)}
                    className="text-gray-500 hover:text-white p-1.5 rounded-lg hover:bg-gray-800 transition-colors">
                    {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </button>
                  <button onClick={() => disconnect(conn.id)} className="text-gray-500 hover:text-red-400 p-1.5 rounded-lg hover:bg-gray-800 transition-colors">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>

              {/* Expanded: Webhook URL + Steps */}
              {isExpanded && (
                <div className="border-t border-gray-800 p-5 space-y-4">

                  {/* Gastroware: Bridge-Banner */}
                  {(prov as any)?.bridge && (
                    <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 flex items-start gap-3">
                      <Terminal size={18} className="text-red-400 shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <p className="text-red-300 text-sm font-semibold mb-1">Gastroware Bridge — Echtzeit über lokales Skript</p>
                        <p className="text-gray-400 text-xs mb-3">Das Skript läuft auf deinem Kassen-PC und sendet jeden Verkauf sofort an die App (2-3 Sek. Verzögerung).</p>
                        <a href="/gastroware-bridge.js" download="gastroware-bridge.js"
                          className="inline-flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-xl text-xs font-semibold transition-colors">
                          <Download size={13} /> Bridge-Skript herunterladen
                        </a>
                      </div>
                    </div>
                  )}

                  {/* Webhook URL */}
                  <div>
                    <p className="text-gray-400 text-xs mb-2 font-medium">
                      {(prov as any)?.bridge ? "Schritt 5 — Diese URL ins Bridge-Skript eintragen (webhookUrl):" : "Schritt 2 — Diese URL in dein Kassensystem eintragen:"}
                    </p>
                    <div className="flex items-center gap-2 bg-gray-800 rounded-xl px-3 py-2.5">
                      <code className="text-orange-400 text-xs flex-1 truncate">{webhookUrl}</code>
                      <button onClick={() => copyWebhook(conn)}
                        className="text-gray-400 hover:text-white transition-colors flex-shrink-0 flex items-center gap-1 text-xs whitespace-nowrap">
                        {copiedId === conn.id + "_webhook"
                          ? <><CheckCircle size={14} className="text-green-400" /><span className="text-green-400">Kopiert!</span></>
                          : <><Copy size={14} /> Kopieren</>}
                      </button>
                    </div>
                  </div>

                  {/* Step-by-step */}
                  {prov?.steps && (
                    <div className="bg-blue-500/5 border border-blue-500/20 rounded-xl p-4">
                      <p className="text-blue-300 text-xs font-semibold mb-3 flex items-center gap-1.5">
                        <Wifi size={12} /> Schritt-für-Schritt bei {prov.name}:
                      </p>
                      <ol className="space-y-2">
                        {prov.steps.map((step, i) => (
                          <li key={i} className="flex items-start gap-2.5 text-sm">
                            <span className="w-5 h-5 rounded-full bg-blue-500/30 text-blue-300 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">{i + 1}</span>
                            <span className="text-gray-300">{step}</span>
                          </li>
                        ))}
                      </ol>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Live Sales Feed */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
        <div className="p-5 border-b border-gray-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <h3 className="font-semibold text-white">Live-Umsätze</h3>
            <span className="text-gray-500 text-xs">· aktualisiert sich automatisch</span>
          </div>
          <button onClick={loadRecentSales} className="text-gray-500 hover:text-white transition-colors p-1.5 rounded-lg hover:bg-gray-800">
            <RefreshCw size={13} />
          </button>
        </div>

        {recentSales.length === 0 ? (
          <div className="p-8 text-center">
            <Euro size={32} className="text-gray-700 mx-auto mb-3" />
            <p className="text-gray-500 text-sm">Noch keine Umsätze empfangen</p>
            <p className="text-gray-600 text-xs mt-1">Klicke auf "Test senden" um die Verbindung zu prüfen</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-800/50 max-h-72 overflow-y-auto">
            {recentSales.map(sale => {
              const time = new Date(sale.recorded_at);
              const isNew = (Date.now() - time.getTime()) < 10000;
              return (
                <div key={sale.id} className={`px-5 py-3 flex items-center justify-between transition-colors ${isNew ? "bg-green-500/5" : "hover:bg-gray-800/30"}`}>
                  <div className="flex items-center gap-3">
                    {isNew && <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse shrink-0" />}
                    <div>
                      <div className="flex items-center gap-2">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          sale.payment_method === "cash" ? "bg-yellow-500/20 text-yellow-300" :
                          sale.payment_method === "card" ? "bg-blue-500/20 text-blue-300" :
                          "bg-purple-500/20 text-purple-300"
                        }`}>
                          {sale.payment_method === "cash" ? "Bar" : sale.payment_method === "card" ? "Karte" : "Online"}
                        </span>
                        {sale.table_number && <span className="text-gray-500 text-xs">Tisch {sale.table_number}</span>}
                      </div>
                      <p className="text-gray-500 text-xs mt-0.5 flex items-center gap-1">
                        <Clock size={10} />
                        {time.toLocaleString("de-DE", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>
                  </div>
                  <span className={`font-bold text-sm ${isNew ? "text-green-400" : "text-white"}`}>
                    +{Number(sale.amount).toFixed(2)} €
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
