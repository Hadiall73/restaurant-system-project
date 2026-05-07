/**
 * Gastroware → Restaurant System Bridge
 * ======================================
 * Dieses Skript läuft auf demselben PC wie Gastroware.
 * Es überwacht die Datenbank und sendet neue Verkäufe in Echtzeit.
 *
 * VORAUSSETZUNGEN:
 *   Node.js installiert (https://nodejs.org)
 *
 * INSTALLATION:
 *   1. Node.js installieren
 *   2. Ordner erstellen: C:\GastrowareBridge\
 *   3. Diese Datei dort speichern
 *   4. CMD öffnen → cd C:\GastrowareBridge
 *   5. npm install mysql2   (oder: npm install mssql)
 *   6. Konfiguration unten anpassen (WEBHOOK_URL, Datenbankdaten)
 *   7. node gastroware-bridge.js
 */

// ═══════════════════════════════════════════════════════════
//  KONFIGURATION — HIER ANPASSEN
// ═══════════════════════════════════════════════════════════

const CONFIG = {
  // Webhook URL aus dem Restaurant-System (Kassensystem → Verbindung → URL kopieren)
  webhookUrl: "HIER_DEINE_WEBHOOK_URL_EINFÜGEN",

  // Datenbanktyp: "mysql" oder "mssql"
  dbType: "mysql",

  // MySQL-Verbindung (Standard bei Gastroware)
  mysql: {
    host:     "localhost",
    port:     3306,
    user:     "root",
    password: "HIER_DB_PASSWORT",
    database: "gastroware",       // oder: "gwdata", "gw" — je nach Installation
  },

  // MS SQL-Verbindung (falls Gastroware auf SQL Server läuft)
  mssql: {
    server:   "localhost",
    port:     1433,
    user:     "sa",
    password: "HIER_DB_PASSWORT",
    database: "Gastroware",
    options:  { trustServerCertificate: true },
  },

  // Intervall in Millisekunden (3000 = alle 3 Sekunden)
  pollInterval: 3000,
};

// ═══════════════════════════════════════════════════════════
//  AB HIER NICHTS ÄNDERN
// ═══════════════════════════════════════════════════════════

const fs      = require("fs");
const https   = require("https");
const http    = require("http");
const path    = require("path");

const LAST_ID_FILE = path.join(__dirname, ".last_tx_id");

function getLastId() {
  try { return parseInt(fs.readFileSync(LAST_ID_FILE, "utf8").trim()) || 0; }
  catch { return 0; }
}

function saveLastId(id) {
  fs.writeFileSync(LAST_ID_FILE, String(id), "utf8");
}

function sendToWebhook(sale) {
  return new Promise((resolve) => {
    const payload = JSON.stringify({
      event:          "payment.completed",
      amount:         sale.amount,
      payment_method: sale.payment_method,
      table_number:   sale.table_number || null,
      external_id:    String(sale.id),
      recorded_at:    sale.recorded_at,
    });

    const url = new URL(CONFIG.webhookUrl);
    const isHttps = url.protocol === "https:";
    const lib     = isHttps ? https : http;

    const options = {
      hostname: url.hostname,
      port:     url.port || (isHttps ? 443 : 80),
      path:     url.pathname + url.search,
      method:   "POST",
      headers:  {
        "Content-Type":   "application/json",
        "Content-Length": Buffer.byteLength(payload),
      },
    };

    const req = lib.request(options, (res) => {
      res.on("data", () => {});
      res.on("end", () => resolve(res.statusCode));
    });
    req.on("error", (e) => {
      console.error("  ✗ Webhook-Fehler:", e.message);
      resolve(0);
    });
    req.write(payload);
    req.end();
  });
}

// ── MySQL-Polling ─────────────────────────────────────────
async function pollMySQL() {
  let mysql2;
  try { mysql2 = require("mysql2/promise"); }
  catch {
    console.error("mysql2 nicht installiert! Bitte ausführen: npm install mysql2");
    process.exit(1);
  }

  const conn = await mysql2.createConnection(CONFIG.mysql);
  console.log("✓ MySQL verbunden mit:", CONFIG.mysql.database);

  // Bekannte Gastroware-Tabellennamen (je nach Version unterschiedlich)
  // Passe den Tabellennamen und Spaltennamen ggf. an
  const TABLE = "buchungen";   // Alternativ: "sales", "transaktionen", "kassenbon"

  async function poll() {
    const lastId = getLastId();
    try {
      const [rows] = await conn.execute(
        `SELECT
           id,
           COALESCE(gesamtbetrag, brutto, betrag, total) AS amount,
           COALESCE(zahlart, zahlungsart, payment) AS zahlart,
           COALESCE(tischnr, tisch, table_nr) AS tischnr,
           COALESCE(zeitpunkt, datum, created_at, ts) AS zeitpunkt
         FROM ${TABLE}
         WHERE id > ?
         ORDER BY id ASC
         LIMIT 50`,
        [lastId]
      );

      for (const row of rows) {
        const method = mapZahlart(row.zahlart);
        const sale = {
          id:             row.id,
          amount:         parseFloat(row.amount) || 0,
          payment_method: method,
          table_number:   row.tischnr ? parseInt(row.tischnr) : null,
          recorded_at:    row.zeitpunkt ? new Date(row.zeitpunkt).toISOString() : new Date().toISOString(),
        };
        const status = await sendToWebhook(sale);
        if (status === 200 || status === 201) {
          console.log(`  ✓ Verkauf ${sale.id}: ${sale.amount.toFixed(2)} € (${method}) gesendet`);
          saveLastId(row.id);
        }
      }
    } catch (e) {
      if (e.code === "ER_NO_SUCH_TABLE") {
        console.error(`  ✗ Tabelle "${TABLE}" nicht gefunden. Bitte Tabellenname in gastroware-bridge.js anpassen.`);
      } else {
        console.error("  ✗ DB-Fehler:", e.message);
      }
    }
    setTimeout(poll, CONFIG.pollInterval);
  }

  poll();
}

// ── MS SQL-Polling ────────────────────────────────────────
async function pollMSSQL() {
  let mssql;
  try { mssql = require("mssql"); }
  catch {
    console.error("mssql nicht installiert! Bitte ausführen: npm install mssql");
    process.exit(1);
  }

  const pool = await mssql.connect(CONFIG.mssql);
  console.log("✓ MSSQL verbunden mit:", CONFIG.mssql.database);

  const TABLE = "Buchungen";

  async function poll() {
    const lastId = getLastId();
    try {
      const result = await pool.request()
        .input("lastId", mssql.Int, lastId)
        .query(
          `SELECT TOP 50
             id,
             COALESCE(Gesamtbetrag, Brutto, Betrag) AS amount,
             COALESCE(Zahlart, Zahlungsart) AS zahlart,
             COALESCE(TischNr, Tisch) AS tischnr,
             COALESCE(Zeitpunkt, Datum, CreatedAt) AS zeitpunkt
           FROM ${TABLE}
           WHERE id > @lastId
           ORDER BY id ASC`
        );

      for (const row of result.recordset) {
        const method = mapZahlart(row.zahlart);
        const sale = {
          id:             row.id,
          amount:         parseFloat(row.amount) || 0,
          payment_method: method,
          table_number:   row.tischnr ? parseInt(row.tischnr) : null,
          recorded_at:    row.zeitpunkt ? new Date(row.zeitpunkt).toISOString() : new Date().toISOString(),
        };
        const status = await sendToWebhook(sale);
        if (status === 200 || status === 201) {
          console.log(`  ✓ Verkauf ${sale.id}: ${sale.amount.toFixed(2)} € (${method}) gesendet`);
          saveLastId(row.id);
        }
      }
    } catch (e) {
      console.error("  ✗ DB-Fehler:", e.message);
    }
    setTimeout(poll, CONFIG.pollInterval);
  }

  poll();
}

function mapZahlart(raw) {
  if (!raw) return "cash";
  const s = String(raw).toLowerCase();
  if (s.includes("bar") || s.includes("cash") || s === "0") return "cash";
  if (s.includes("karte") || s.includes("ec") || s.includes("card") || s.includes("visa") || s === "1") return "card";
  return "other";
}

// ── Start ─────────────────────────────────────────────────
console.log("═══════════════════════════════════════");
console.log("  Gastroware → Restaurant System Bridge");
console.log("═══════════════════════════════════════");

if (CONFIG.webhookUrl === "HIER_DEINE_WEBHOOK_URL_EINFÜGEN") {
  console.error("\n✗ Bitte zuerst die Webhook-URL in gastroware-bridge.js eintragen!\n");
  process.exit(1);
}

console.log("Starte Verbindung...");
if (CONFIG.dbType === "mssql") {
  pollMSSQL().catch(e => { console.error("Verbindungsfehler:", e.message); process.exit(1); });
} else {
  pollMySQL().catch(e => { console.error("Verbindungsfehler:", e.message); process.exit(1); });
}
