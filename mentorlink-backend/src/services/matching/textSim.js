// TF-IDF + cosine similarity in plain JavaScript. No external AI API.

// \p{M} keeps Bangla vowel signs attached to their letters.
const tokenize = (text = '') => text.toLowerCase().split(/[^\p{L}\p{M}\p{N}]+/u).filter(Boolean);

/** docs: string[] -> array of Map(term -> tfidf weight), same order. */
function buildTfidf(docs) {
  const tokenized = docs.map(tokenize);
  const N = docs.length;
  const df = new Map();
  for (const toks of tokenized) for (const t of new Set(toks)) df.set(t, (df.get(t) || 0) + 1);
  const idf = (t) => Math.log((1 + N) / (1 + df.get(t))) + 1; // smoothed idf, always > 0
  return tokenized.map((toks) => {
    const tf = new Map();
    for (const t of toks) tf.set(t, (tf.get(t) || 0) + 1);
    const vec = new Map();
    for (const [t, c] of tf) vec.set(t, (c / (toks.length || 1)) * idf(t));
    return vec;
  });
}

function cosine(a, b) {
  let dot = 0, na = 0, nb = 0;
  for (const [t, w] of a) { na += w * w; if (b.has(t)) dot += w * b.get(t); }
  for (const w of b.values()) nb += w * w;
  return na && nb ? dot / (Math.sqrt(na) * Math.sqrt(nb)) : 0;
}

module.exports = { tokenize, buildTfidf, cosine };
