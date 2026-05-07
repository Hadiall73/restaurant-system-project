export const umsatzWoche = [
  { tag: "Mo", umsatz: 1240, kosten: 480 },
  { tag: "Di", umsatz: 980, kosten: 390 },
  { tag: "Mi", umsatz: 1580, kosten: 620 },
  { tag: "Do", umsatz: 1320, kosten: 510 },
  { tag: "Fr", umsatz: 2840, kosten: 890 },
  { tag: "Sa", umsatz: 3200, kosten: 1100 },
  { tag: "So", umsatz: 2650, kosten: 920 },
];

export const umsatzMonat = [
  { woche: "KW 14", umsatz: 12400, kosten: 4800 },
  { woche: "KW 15", umsatz: 13800, kosten: 5100 },
  { woche: "KW 16", umsatz: 11200, kosten: 4300 },
  { woche: "KW 17", umsatz: 15600, kosten: 5800 },
];

export const mitarbeiter = [
  { id: 1, name: "Anna Müller",  rolle: "Köchin",    stunden: 36, sollStunden: 40, lohn: 16 },
  { id: 2, name: "Ben Schmidt",  rolle: "Kellner",   stunden: 32, sollStunden: 32, lohn: 13 },
  { id: 3, name: "Clara Weber",  rolle: "Kellnerin", stunden: 21, sollStunden: 28, lohn: 13 },
  { id: 4, name: "David Koch",   rolle: "Spüler",    stunden: 20, sollStunden: 20, lohn: 12 },
  { id: 5, name: "Eva Lang",     rolle: "Köchin",    stunden: 40, sollStunden: 40, lohn: 15 },
];

export const dienstplan = [
  { mitarbeiter: "Anna Müller", mo: "09-17", di: "09-17", mi: "-", do: "09-17", fr: "11-20", sa: "11-22", so: "-" },
  { mitarbeiter: "Ben Schmidt", mo: "-", di: "16-23", mi: "16-23", do: "-", fr: "16-23", sa: "12-22", so: "12-21" },
  { mitarbeiter: "Clara Weber", mo: "16-23", di: "-", mi: "16-23", do: "16-23", fr: "16-23", sa: "16-23", so: "16-22" },
  { mitarbeiter: "David Koch", mo: "11-16", di: "11-16", mi: "-", do: "11-16", fr: "11-16", sa: "11-18", so: "11-17" },
  { mitarbeiter: "Eva Lang", mo: "09-17", di: "-", mi: "09-17", do: "09-17", fr: "09-20", sa: "09-22", so: "10-18" },
];

export const lieferanten = [
  {
    id: "L1",
    name: "Metzger Hoffmann",
    kontakt: "Hans Hoffmann",
    telefon: "05251 / 12 34 56",
    email: "bestellung@metzger-hoffmann.de",
    kategorie: "Fleisch & Geflügel",
    lieferzeit: "1 Tag",
    mindestbestellwert: 80,
    zahlungsziel: 14,
  },
  {
    id: "L2",
    name: "Gemüse Meyer",
    kontakt: "Maria Meyer",
    telefon: "05251 / 98 76 54",
    email: "info@gemuese-meyer.de",
    kategorie: "Obst & Gemüse",
    lieferzeit: "Täglich",
    mindestbestellwert: 30,
    zahlungsziel: 7,
  },
  {
    id: "L3",
    name: "Feinkost Bauer",
    kontakt: "Klaus Bauer",
    telefon: "0521 / 44 55 66",
    email: "order@feinkost-bauer.de",
    kategorie: "Feinkost & Öle",
    lieferzeit: "2 Tage",
    mindestbestellwert: 50,
    zahlungsziel: 30,
  },
  {
    id: "L4",
    name: "Bäckerei Zulieferer",
    kontakt: "Thomas Becker",
    telefon: "05251 / 33 22 11",
    email: "lieferung@baeckerei-zul.de",
    kategorie: "Backwaren & Mehl",
    lieferzeit: "Täglich",
    mindestbestellwert: 20,
    zahlungsziel: 7,
  },
  {
    id: "L5",
    name: "Fisch Seidel",
    kontakt: "Peter Seidel",
    telefon: "040 / 77 88 99",
    email: "bestellung@fisch-seidel.de",
    kategorie: "Fisch & Meeresfrüchte",
    lieferzeit: "1 Tag",
    mindestbestellwert: 100,
    zahlungsziel: 14,
  },
  {
    id: "L6",
    name: "Weinhaus Stein",
    kontakt: "Renate Stein",
    telefon: "06131 / 55 44 33",
    email: "order@weinhaus-stein.de",
    kategorie: "Getränke & Wein",
    lieferzeit: "3 Tage",
    mindestbestellwert: 150,
    zahlungsziel: 30,
  },
  {
    id: "L7",
    name: "Molkerei Nord",
    kontakt: "Jens Nordmann",
    telefon: "0431 / 11 22 33",
    email: "info@molkerei-nord.de",
    kategorie: "Milchprodukte",
    lieferzeit: "Täglich",
    mindestbestellwert: 25,
    zahlungsziel: 7,
  },
];

export const lagerbestand = [
  { artikel: "Rindfleisch", menge: 8,  einheit: "kg",  minimum: 10, bestellmenge: 15, preis: 18.5, lieferantId: "L1", autoBestellung: true },
  { artikel: "Kartoffeln",  menge: 45, einheit: "kg",  minimum: 20, bestellmenge: 50, preis: 0.8,  lieferantId: "L2", autoBestellung: false },
  { artikel: "Olivenöl",    menge: 3,  einheit: "L",   minimum: 5,  bestellmenge: 10, preis: 8.9,  lieferantId: "L3", autoBestellung: true },
  { artikel: "Mehl",        menge: 22, einheit: "kg",  minimum: 10, bestellmenge: 25, preis: 0.6,  lieferantId: "L4", autoBestellung: false },
  { artikel: "Tomaten",     menge: 12, einheit: "kg",  minimum: 8,  bestellmenge: 20, preis: 2.1,  lieferantId: "L2", autoBestellung: true },
  { artikel: "Lachs",       menge: 4,  einheit: "kg",  minimum: 6,  bestellmenge: 10, preis: 22.0, lieferantId: "L5", autoBestellung: true },
  { artikel: "Rotwein",     menge: 24, einheit: "Fl.", minimum: 12, bestellmenge: 24, preis: 6.5,  lieferantId: "L6", autoBestellung: false },
  { artikel: "Sahne",       menge: 2,  einheit: "L",   minimum: 4,  bestellmenge: 8,  preis: 1.9,  lieferantId: "L7", autoBestellung: true },
];

export const bestellhistorie = [
  { id: "B001", artikel: "Rindfleisch", menge: 15, einheit: "kg", lieferant: "Metzger Hoffmann", datum: "28.04.2026", status: "geliefert", gesamt: 277.5, art: "auto" },
  { id: "B002", artikel: "Lachs",       menge: 10, einheit: "kg", lieferant: "Fisch Seidel",     datum: "27.04.2026", status: "geliefert", gesamt: 220.0, art: "manuell" },
  { id: "B003", artikel: "Sahne",       menge: 8,  einheit: "L",  lieferant: "Molkerei Nord",    datum: "29.04.2026", status: "unterwegs", gesamt: 15.2,  art: "auto" },
  { id: "B004", artikel: "Olivenöl",    menge: 10, einheit: "L",  lieferant: "Feinkost Bauer",   datum: "30.04.2026", status: "bestellt",  gesamt: 89.0,  art: "auto" },
];

export const steuerdaten = {
  quartal: "Q1 2026",
  umsatzGesamt: 52890,
  umsatzsteuer: 8445,
  vorsteuer: 3210,
  zahlbar: 5235,
  naechsteFaelligkeit: "10.05.2026",
  ausgaben: [
    { kategorie: "Personal", betrag: 18400 },
    { kategorie: "Wareneinkauf", betrag: 12800 },
    { kategorie: "Miete", betrag: 4200 },
    { kategorie: "Energie", betrag: 1840 },
    { kategorie: "Sonstiges", betrag: 2100 },
  ],
};

export const kpiDaten = {
  tagesUmsatz: 2840,
  wochenUmsatz: 13810,
  monatsUmsatz: 52890,
  gewinnMarge: 31.2,
  offeneTische: 8,
  gesamtTische: 16,
  durchschnittsBon: 42.5,
  zufriedenheit: 4.3,
};
