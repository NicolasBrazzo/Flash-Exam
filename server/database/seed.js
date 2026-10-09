// =============================================================================
// Seed del database — utente unico dell'applicazione (+ dati demo opzionali)
// =============================================================================
// Esecuzione:  npm run seed  (da dentro server/)
//
// Il sito ha una sola utente: le credenziali NON stanno nel codice, ma nelle
// variabili d'ambiente SEED_EMAIL, SEED_PASSWORD, SEED_FIRST_NAME,
// SEED_LAST_NAME (vedi .env.example).
//
// Idempotente: usa upsert con onConflict sull'email, quindi può essere
// rilanciato senza creare duplicati (e aggiorna la password se la cambi nel
// .env). Punta al database configurato in .env (SUPABASE_URL / SUPABASE_KEY),
// quindi funziona sia in locale sia per popolare il DB usato dal deploy.
//
// Dati demo: solo con SEED_DEMO=true aggiunge i due argomenti "[DEMO] ..." di
// database/demoData.js. Passano per lo schema e la deduplica dell'import,
// quindi rilanciare il seed non crea duplicati. Non usarlo sul DB del deploy.
// =============================================================================

require("dotenv").config();
const bcrypt = require("bcrypt");
const supabase = require("../config/db_connection");
const { findTopicByName, createTopic } = require("../models/topic.model");
const {
  getQuestionPromptsByTopic,
  createQuestions,
} = require("../models/question.model");
const { questionsImportSchema } = require("../schemas/questionsImport.schema");
const { formatZodError } = require("../utils/zodError");
const { selectNewQuestions, isDemoEnabled } = require("../utils/importQuestions");
const demoData = require("./demoData");

// Non importiamo config/jwt.js (fail-fast su JWT_SECRET, qui non serve)
const SALT_ROUNDS = Number(process.env.SALT_ROUNDS) || 10;

const USERS_TABLE = "FE_Users";

const REQUIRED_ENV = [
  "SEED_EMAIL",
  "SEED_PASSWORD",
  "SEED_FIRST_NAME",
  "SEED_LAST_NAME",
];

const readSeedUser = () => {
  const missing = REQUIRED_ENV.filter((name) => !process.env[name]);

  if (missing.length > 0) {
    throw new Error(
      `Variabili d'ambiente mancanti: ${missing.join(", ")}. Compilale nel file .env (vedi .env.example).`
    );
  }

  return {
    email: process.env.SEED_EMAIL.trim(),
    password: process.env.SEED_PASSWORD,
    first_name: process.env.SEED_FIRST_NAME.trim(),
    last_name: process.env.SEED_LAST_NAME.trim(),
  };
};

const seedUser = async () => {
  const user = readSeedUser();
  const hashedPassword = await bcrypt.hash(user.password, SALT_ROUNDS);

  const { error } = await supabase.from(USERS_TABLE).upsert(
    {
      email: user.email,
      password: hashedPassword,
      first_name: user.first_name,
      last_name: user.last_name,
    },
    { onConflict: "email" }
  );

  if (error) {
    throw new Error(`Errore su ${user.email}: ${error.message}`);
  }

  console.log(`Utente pronto: ${user.email} (${user.first_name} ${user.last_name})`);
};

// Stessi passi di POST /import/questions, per ogni argomento demo
const seedDemoTopic = async (payload) => {
  const parsed = questionsImportSchema.safeParse(payload);
  if (!parsed.success) {
    throw new Error(`Dati demo non validi: ${formatZodError(parsed.error).join("; ")}`);
  }

  const { topic, questions } = parsed.data;

  let savedTopic = await findTopicByName(topic.name);
  const created = !savedTopic;
  if (created) {
    savedTopic = await createTopic({ name: topic.name });
  }

  const existingPrompts = created ? [] : await getQuestionPromptsByTopic(savedTopic.id);
  const rows = selectNewQuestions(questions, existingPrompts, savedTopic.id);

  if (rows.length > 0) {
    await createQuestions(rows);
  }

  console.log(
    `Argomento demo "${savedTopic.name}": ${rows.length} inserite, ${questions.length - rows.length} saltate`
  );
};

const seedDemo = async () => {
  for (const payload of demoData) {
    await seedDemoTopic(payload);
  }
};

const main = async () => {
  console.log("Seed del database in corso...\n");
  await seedUser();
  if (isDemoEnabled(process.env)) {
    await seedDemo();
  }
  console.log("\nSeed completato.");
};

main().catch((err) => {
  console.error("Seed fallito:", err.message);
  process.exit(1);
});
