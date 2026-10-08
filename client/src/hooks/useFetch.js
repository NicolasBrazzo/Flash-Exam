import { useState, useEffect, useCallback, useRef } from "react";

/**
 * 
 * Serve per le LETTURE (GET). Gestisce loading, errore e dati della chiamata.
 *
 * Deps: Metti nelle deps ogni variabile che, se cambia, deve far ripartire la chiamata.
 * 
 */
export function useFetch(asyncFn, deps = []) {
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // La funzione piu' recente sta in un ref: load resta stabile e il refetch
  // usa sempre l'ultima versione di asyncFn.
  const asyncFnRef = useRef(asyncFn);
  useEffect(() => {
    asyncFnRef.current = asyncFn;
  });

  const load = useCallback(async () => {
    try {
      const result = await asyncFnRef.current();
      setData(result);
      setError(null);
    } catch (err) {
      setError(err.message || "Si è verificato un errore");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const refetch = useCallback(() => {
    setIsLoading(true);
    setError(null);
    return load();
  }, [load]);

  // Se cambia una delle deps si torna allo stato di caricamento gia' nel render
  // (nessun setState sincrono dentro l'effetto).
  const [prevDeps, setPrevDeps] = useState(deps);
  if (
    prevDeps.length !== deps.length ||
    prevDeps.some((d, i) => !Object.is(d, deps[i]))
  ) {
    setPrevDeps(deps);
    setIsLoading(true);
    setError(null);
  }

  // Riparte quando cambia una delle deps passate dal chiamante.
  useEffect(() => {
    load();
  }, [load, ...deps]);

  return { data, isLoading, error, refetch };
}
