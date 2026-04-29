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
  { id: 1, name: "Anna Müller", rolle: "Köchin", stunden: 40, lohn: 16 },
  { id: 2, name: "Ben Schmidt", rolle: "Kellner", stunden: 32, lohn: 13 },
  { id: 3, name: "Clara Weber", rolle: "Kellnerin", stunden: 28, lohn: 13 },
  { id: 4, name: "David Koch", rolle: "Spüler", stunden: 20, lohn: 12 },
  { id: 5, name: "Eva Lang", rolle: "Köchin", stunden: 40, lohn: 15 },
];

export const dienstplan = [
  { mitarbeiter: "Anna Müller", mo: "09-17", di: "09-17", mi: "-", do: "09-17", fr: "11-20", sa: "11-22", so: "-" },
  { mitarbeiter: "Ben Schmidt", mo: "-", di: "16-23", mi: "16-23", do: "-", fr: "16-23", sa: "12-22", so: "12-21" },
  { mitarbeiter: "Clara Weber", mo: "16-23", di: "-", mi: "16-23", do: "16-23", fr: "16-23", sa: "16-23", so: "16-22" },
  { mitarbeiter: "David Koch", mo: "11-16", di: "11-16", mi: "-", do: "11-16", fr: "11-16", sa: "11-18", so: "11-17" },
  { mitarbeiter: "Eva Lang", mo: "09-17", di: "-", mi: "09-17", do: "09-17", fr: "09-20", sa: "09-22", so: "10-18" },
];

export const lagerbestand = [
  { artikel: "Rindfleisch", menge: 8, einheit: "kg", minimum: 10, preis: 18.5, lieferant: "Metzger Hoffmann" },
  { artikel: "Kartoffeln", menge: 45, einheit: "kg", minimum: 20, preis: 0.8, lieferant: "Gemüse Meyer" },
  { artikel: "Olivenöl", menge: 3, einheit: "L", minimum: 5, preis: 8.9, lieferant: "Feinkost Bauer" },
  { artikel: "Mehl", menge: 22, einheit: "kg", minimum: 10, preis: 0.6, lieferant: "Bäckerei Zulieferer" },
  { artikel: "Tomaten", menge: 12, einheit: "kg", minimum: 8, preis: 2.1, lieferant: "Gemüse Meyer" },
  { artikel: "Lachs", menge: 4, einheit: "kg", minimum: 6, preis: 22.0, lieferant: "Fisch Seidel" },
  { artikel: "Rotwein", menge: 24, einheit: "Fl.", minimum: 12, preis: 6.5, lieferant: "Weinhaus Stein" },
  { artikel: "Sahne", menge: 2, einheit: "L", minimum: 4, preis: 1.9, lieferant: "Molkerei Nord" },
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
