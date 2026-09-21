import { APP_NAME } from "../constants/app";

// Home dell'area privata (rotta "/"): pagina di atterraggio dopo il login.
// Vuota per ora: le funzionalità del progetto arriveranno qui.
export const Home = () => {
  return (
    <div className="px-6 py-6">
      <h1 className="text-2xl font-semibold">{APP_NAME}</h1>
    </div>
  );
};
