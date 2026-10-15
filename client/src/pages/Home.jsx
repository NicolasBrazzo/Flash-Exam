import { Link } from "react-router-dom";
import { Layers } from "lucide-react";
import { APP_NAME } from "../constants/app";
import { Button } from "@/components/ui/button";

// Home dell'area privata (rotta "/"): pagina di atterraggio dopo il login.
// Solo i collegamenti alle funzioni del sito.
export const Home = () => {
  return (
    <div className="space-y-6 px-6 py-6">
      <h1 className="text-2xl font-semibold">{APP_NAME}</h1>
      <Button asChild className="h-11 px-4">
        <Link to="/flashcard">
          <Layers />
          Flashcard
        </Link>
      </Button>
    </div>
  );
};
