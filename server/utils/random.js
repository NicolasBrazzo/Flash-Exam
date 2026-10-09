// Estrazione casuale (pura: il generatore si può passare, per i test)

// Copia mescolata con Fisher-Yates; l'input non viene modificato
const shuffle = (array, rng = Math.random) => {
  const out = [...array];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
};

// n elementi distinti a caso (tutti, mescolati, se n supera la lunghezza)
const pickRandom = (array, n, rng = Math.random) => {
  if (!Number.isInteger(n) || n <= 0) return [];
  return shuffle(array, rng).slice(0, n);
};

module.exports = { shuffle, pickRandom };
