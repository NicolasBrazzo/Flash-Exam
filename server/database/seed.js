// =============================================================================
// Seed del database — utente unico dell'applicazione
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
// =============================================================================

require("dotenv").config();
const bcrypt = require("bcrypt");
const supabase = require("../config/db_connection");

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

const main = async () => {
  console.log("Seed del database in corso...\n");
  await seedUser();
  console.log("\nSeed completato.");
};

main().catch((err) => {
  console.error("Seed fallito:", err.message);
  process.exit(1);
});
