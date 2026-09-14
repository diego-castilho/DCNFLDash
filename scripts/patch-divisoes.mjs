/**
 * Acrescenta conferência e divisão ao catálogo de times.
 * Escrito à mão porque é informação estável (a última mudança de divisão na NFL
 * foi em 2002) e não vale depender de uma chamada de rede para isso.
 * Roda uma vez; é idempotente.
 */
import { lerJson, gravarJson } from "./lib/comum.mjs";

const DIVISOES = {
  AFC: {
    Norte: ["BAL", "CIN", "CLE", "PIT"],
    Sul:   ["HOU", "IND", "JAX", "TEN"],
    Leste: ["BUF", "MIA", "NE", "NYJ"],
    Oeste: ["DEN", "KC", "LV", "LAC"]
  },
  NFC: {
    Norte: ["CHI", "DET", "GB", "MIN"],
    Sul:   ["ATL", "CAR", "NO", "TB"],
    Leste: ["DAL", "NYG", "PHI", "WAS"],
    Oeste: ["ARI", "LAR", "SF", "SEA"]
  }
};

const times = lerJson("dados/times.json");
let n = 0;
for (const [conferencia, divisoes] of Object.entries(DIVISOES)) {
  for (const [divisao, siglas] of Object.entries(divisoes)) {
    for (const s of siglas) {
      if (!times[s]) throw new Error(`sigla ${s} não existe em dados/times.json`);
      times[s] = { ...times[s], conferencia, divisao };
      n++;
    }
  }
}
if (n !== 32) throw new Error(`esperava 32 times, mapeei ${n}`);
gravarJson("dados/times.json", times);
console.log("32 times com conferência e divisão");
