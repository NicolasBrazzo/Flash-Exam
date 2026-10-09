// =============================================================================
// Dati demo del seed (solo con SEED_DEMO=true, vedi seed.js)
// =============================================================================
// Due argomenti di prova per provare simulazione e flashcard finché non
// esistono i JSON veri. Stesso formato del JSON di import (docs/PROGETTO.md):
// passano per questionsImportSchema e per la stessa deduplica dell'import.
// =============================================================================

module.exports = [
  {
    topic: { name: "[DEMO] Capacità giuridica e capacità d'agire" },
    questions: [
      {
        prompt: "Quando si acquista la capacità giuridica?",
        answer:
          "La capacità giuridica si acquista al momento della nascita. I diritti che la legge riconosce al concepito sono subordinati all'evento della nascita.",
        rubric: [
          { id: "c1", concept: "si acquista con la nascita", weight: 2 },
          { id: "c2", concept: "i diritti del concepito sono subordinati alla nascita", weight: 1 },
        ],
        references: ["1"],
      },
      {
        prompt: "Che cos'è la capacità d'agire e quando si acquista?",
        answer:
          "È l'idoneità a compiere validamente atti giuridici con cui acquistare ed esercitare diritti. Si acquista con la maggiore età, al compimento del diciottesimo anno.",
        rubric: [
          { id: "c1", concept: "idoneità a compiere validamente atti giuridici", weight: 2 },
          { id: "c2", concept: "si acquista con la maggiore età (18 anni)", weight: 2 },
        ],
        references: ["2"],
      },
      {
        prompt: "Che differenza c'è tra interdizione e inabilitazione?",
        answer:
          "L'interdizione riguarda l'abituale infermità di mente che rende incapaci di provvedere ai propri interessi e toglie la capacità d'agire (tutore). L'inabilitazione riguarda casi meno gravi: l'inabilitato compie da solo gli atti di ordinaria amministrazione, per quelli di straordinaria serve l'assistenza del curatore.",
        rubric: [
          { id: "c1", concept: "l'interdizione toglie la capacità d'agire ed è affidata a un tutore", weight: 2 },
          { id: "c2", concept: "l'inabilitato compie da solo l'ordinaria amministrazione, per la straordinaria serve l'assistenza del curatore", weight: 2 },
          { id: "c3", concept: "l'inabilitazione è prevista per i casi meno gravi", weight: 1 },
        ],
        references: ["414", "415"],
      },
      {
        prompt: "Che cos'è l'amministrazione di sostegno?",
        answer:
          "È una misura di protezione per chi, per infermità o menomazione fisica o psichica, non può provvedere ai propri interessi, anche solo in parte o temporaneamente. Il giudice tutelare indica gli atti che richiedono l'amministratore; per il resto la capacità resta.",
        rubric: [
          { id: "c1", concept: "protegge chi non può provvedere ai propri interessi, anche in parte o temporaneamente", weight: 2 },
          { id: "c2", concept: "il giudice tutelare indica gli atti che richiedono l'amministratore", weight: 1 },
          { id: "c3", concept: "il beneficiario conserva la capacità per gli altri atti", weight: 1 },
        ],
        references: ["404"],
      },
    ],
  },
  {
    topic: { name: "[DEMO] Le obbligazioni" },
    questions: [
      {
        prompt: "Quali sono le fonti delle obbligazioni?",
        answer:
          "Le obbligazioni derivano dal contratto, dal fatto illecito e da ogni altro atto o fatto idoneo a produrle in conformità dell'ordinamento giuridico.",
        rubric: [
          { id: "c1", concept: "contratto e fatto illecito", weight: 2 },
          { id: "c2", concept: "ogni altro atto o fatto idoneo secondo l'ordinamento", weight: 1 },
        ],
        references: ["1173"],
      },
      {
        prompt: "Che caratteristiche deve avere la prestazione oggetto dell'obbligazione?",
        answer:
          "La prestazione deve essere suscettibile di valutazione economica e deve corrispondere a un interesse del creditore, che può essere anche non patrimoniale.",
        rubric: [
          { id: "c1", concept: "patrimonialità: suscettibile di valutazione economica", weight: 2 },
          { id: "c2", concept: "interesse del creditore, anche non patrimoniale", weight: 2 },
        ],
        references: ["1174"],
      },
      {
        prompt: "Che cos'è l'obbligazione naturale?",
        answer:
          "È un dovere morale o sociale: il suo adempimento non si può pretendere in giudizio, ma chi ha pagato spontaneamente, essendo capace, non può chiedere la restituzione di quanto prestato.",
        rubric: [
          { id: "c1", concept: "dovere morale o sociale non coercibile", weight: 2 },
          { id: "c2", concept: "irripetibilità della prestazione eseguita spontaneamente", weight: 2 },
          { id: "c3", concept: "chi paga deve essere capace", weight: 1 },
        ],
        references: ["2034"],
      },
      {
        prompt: "Che differenza c'è tra obbligazione solidale e parziaria?",
        answer:
          "Nella solidale passiva ciascun debitore può essere costretto ad adempiere per l'intero e l'adempimento di uno libera gli altri; nella parziaria ognuno risponde solo della sua parte. Tra condebitori la solidarietà si presume.",
        rubric: [
          { id: "c1", concept: "nella solidale ciascuno può essere tenuto per l'intero", weight: 2 },
          { id: "c2", concept: "nella parziaria ciascuno risponde solo della propria quota", weight: 2 },
          { id: "c3", concept: "la solidarietà passiva si presume", weight: 1 },
        ],
        references: [],
      },
    ],
  },
];
