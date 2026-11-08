// PDFo Comparo : algorithmes sans interface (testables hors navigateur).
// - diffSeq : différence entre deux suites de mots (préfixe/suffixe communs, ancres uniques
//   façon « patience diff », puis plus longue sous-suite commune sur les petits tronçons).
// - alignPages : appariement des pages (détection des pages insérées ou supprimées) par
//   alignement de Needleman-Wunsch sur une matrice de similarité.
// - fitSimilarity : recalage robuste (échelle + translation) à partir de points homologues,
//   par consensus (RANSAC déterministe) puis moindres carrés sur les points retenus.

// ---------------------------------------------------------------- Différence de suites
/**
 * Compare deux suites de clés (chaînes). Retourne une liste d'opérations compactes :
 * { op: "=", a, b, n } (n éléments communs à partir de a et b), { op: "-", a, n }, { op: "+", b, n }.
 */
export function diffSeq(A, B) {
  const ops = [];
  const push = (op, a, b, n) => {
    if (n <= 0) return;
    const last = ops[ops.length - 1];
    const contiguous = last && last.op === op && (
      op === "=" ? last.a + last.n === a && last.b + last.n === b :
      op === "-" ? last.a + last.n === a : last.b + last.n === b);
    if (contiguous) {
      last.n += n;
    } else {
      ops.push(op === "=" ? { op, a, b, n } : op === "-" ? { op, a, n } : { op, b, n });
    }
  };

  const solve = (a0, a1, b0, b1, depth) => {
    // Préfixe commun
    let p = 0;
    while (a0 + p < a1 && b0 + p < b1 && A[a0 + p] === B[b0 + p]) p++;
    // Suffixe commun
    let s = 0;
    while (a1 - s - 1 >= a0 + p && b1 - s - 1 >= b0 + p && A[a1 - s - 1] === B[b1 - s - 1]) s++;
    push("=", a0, b0, p);
    const ia0 = a0 + p, ia1 = a1 - s, ib0 = b0 + p, ib1 = b1 - s;
    const n = ia1 - ia0, m = ib1 - ib0;
    if (n === 0) push("+", ia0, ib0, m);
    else if (m === 0) push("-", ia0, ib0, n);
    else if (n * m <= 1_500_000 || depth > 40) lcs(ia0, ia1, ib0, ib1);
    else {
      const anchors = uniqueAnchors(ia0, ia1, ib0, ib1);
      if (!anchors.length) {
        // Aucune ancre : on remplace le bloc entier (cas de textes sans rapport).
        push("-", ia0, ib0, n);
        push("+", ia1, ib0, m);
      } else {
        let ca = ia0, cb = ib0;
        for (const [x, y] of anchors) {
          solve(ca, x, cb, y, depth + 1);
          push("=", x, y, 1);
          ca = x + 1; cb = y + 1;
        }
        solve(ca, ia1, cb, ib1, depth + 1);
      }
    }
    push("=", ia1, ib1, s);
  };

  // Plus longue sous-suite commune par programmation dynamique (tronçons modestes).
  const lcs = (a0, a1, b0, b1) => {
    const n = a1 - a0, m = b1 - b0;
    const W = m + 1;
    const T = new Uint32Array((n + 1) * W);
    for (let i = n - 1; i >= 0; i--) {
      for (let j = m - 1; j >= 0; j--) {
        T[i * W + j] = A[a0 + i] === B[b0 + j] ? T[(i + 1) * W + j + 1] + 1 : Math.max(T[(i + 1) * W + j], T[i * W + j + 1]);
      }
    }
    let i = 0, j = 0;
    while (i < n && j < m) {
      if (A[a0 + i] === B[b0 + j]) { push("=", a0 + i, b0 + j, 1); i++; j++; }
      else if (T[(i + 1) * W + j] >= T[i * W + j + 1]) { push("-", a0 + i, b0 + j, 1); i++; }
      else { push("+", a0 + i, b0 + j, 1); j++; }
    }
    if (i < n) push("-", a0 + i, b0 + j, n - i);
    if (j < m) push("+", a0 + n, b0 + j, m - j);
  };

  // Ancres : éléments présents une seule fois de chaque côté, puis plus longue sous-suite croissante.
  const uniqueAnchors = (a0, a1, b0, b1) => {
    const ca = new Map(), cb = new Map();
    for (let i = a0; i < a1; i++) { const k = A[i]; const v = ca.get(k); ca.set(k, v === undefined ? i : -1); }
    for (let j = b0; j < b1; j++) { const k = B[j]; const v = cb.get(k); cb.set(k, v === undefined ? j : -1); }
    const pairs = [];
    for (const [k, i] of ca) {
      if (i < 0) continue;
      const j = cb.get(k);
      if (j !== undefined && j >= 0) pairs.push([i, j]);
    }
    pairs.sort((p, q) => p[0] - q[0]);
    return lis(pairs);
  };

  solve(0, A.length, 0, B.length, 0);
  return ops;
}

/** Plus longue sous-suite strictement croissante en y (paires déjà triées par x). */
function lis(pairs) {
  const tails = [], prev = new Array(pairs.length);
  const tailIdx = [];
  for (let k = 0; k < pairs.length; k++) {
    const y = pairs[k][1];
    let lo = 0, hi = tails.length;
    while (lo < hi) { const mid = (lo + hi) >> 1; if (tails[mid] < y) lo = mid + 1; else hi = mid; }
    tails[lo] = y;
    tailIdx[lo] = k;
    prev[k] = lo > 0 ? tailIdx[lo - 1] : -1;
  }
  const out = [];
  let k = tailIdx[tails.length - 1];
  while (k !== undefined && k >= 0) { out.push(pairs[k]); k = prev[k]; }
  return out.reverse();
}

/**
 * Regroupe les opérations en changements : suites contiguës de suppressions et d'ajouts.
 * Deux changements séparés par un seul mot commun très court (ponctuation, « de », « à »)
 * sont fusionnés pour rester lisibles.
 */
export function groupChanges(ops, A) {
  const out = [];
  let cur = null;
  let pendingEq = null;
  let ca = 0, cb = 0; // prochains indices dans A et B
  for (const o of ops) {
    if (o.op === "=") {
      if (cur) {
        if (o.n === 1 && A[o.a] && A[o.a].length <= 2 && !pendingEq) { pendingEq = o; ca = o.a + 1; cb = o.b + 1; continue; }
        out.push(cur); cur = null; pendingEq = null;
      }
      ca = o.a + o.n; cb = o.b + o.n;
      continue;
    }
    // aPos / bPos : position du changement dans chaque suite (utile pour un ajout pur).
    if (!cur) cur = { aPos: o.op === "-" ? o.a : ca, bPos: o.op === "+" ? o.b : cb, del: [], add: [] };
    if (pendingEq) {
      // Le mot commun intercalé fait partie des deux côtés du changement fusionné.
      cur.del.push([pendingEq.a, 1]); cur.add.push([pendingEq.b, 1]);
      pendingEq = null;
    }
    if (o.op === "-") { cur.del.push([o.a, o.n]); ca = o.a + o.n; } else { cur.add.push([o.b, o.n]); cb = o.b + o.n; }
  }
  if (cur) out.push(cur);
  // Indices plats (mots supprimés et ajoutés) pour chaque changement.
  return out.map(c => {
    const del = [], add = [];
    for (const [a, n] of c.del) for (let i = 0; i < n; i++) del.push(a + i);
    for (const [b, n] of c.add) for (let i = 0; i < n; i++) add.push(b + i);
    const kind = del.length && add.length ? "mod" : del.length ? "del" : "add";
    return { kind, del, add, aPos: c.aPos, bPos: c.bPos };
  }).filter(c => c.del.length || c.add.length);
}

/** Clé de comparaison d'un mot : Unicode normalisé, guillemets et tirets unifiés. */
export function wordKey(s, ignoreCase) {
  let k = s.normalize("NFKC")
    .replace(/[‘’ʼ]/g, "'")
    .replace(/[“”«»]/g, '"')
    .replace(/[‐-―−]/g, "-");
  if (ignoreCase) k = k.toLocaleLowerCase();
  return k;
}

// ---------------------------------------------------------------- Appariement des pages
/**
 * Alignement de Needleman-Wunsch. S[i][j] : similarité (0..1) de la page i (A) et j (B).
 * Retourne des paires { a, b } (a ou b à null pour une page supprimée ou insérée), dans l'ordre.
 */
export function alignPages(S, n, m, gap = 0.25) {
  const W = m + 1;
  const F = new Float64Array((n + 1) * W);
  const P = new Uint8Array((n + 1) * W); // 1 diag, 2 haut (A seule), 3 gauche (B seule)
  for (let i = 1; i <= n; i++) { F[i * W] = -gap * i; P[i * W] = 2; }
  for (let j = 1; j <= m; j++) { F[j] = -gap * j; P[j] = 3; }
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      // Petit bonus à la diagonale pour départager les égalités (pages vides, gabarits identiques).
      const d = F[(i - 1) * W + j - 1] + S[i - 1][j - 1] + (i === j ? 1e-6 : 0);
      const u = F[(i - 1) * W + j] - gap;
      const l = F[i * W + j - 1] - gap;
      if (d >= u && d >= l) { F[i * W + j] = d; P[i * W + j] = 1; }
      else if (u >= l) { F[i * W + j] = u; P[i * W + j] = 2; }
      else { F[i * W + j] = l; P[i * W + j] = 3; }
    }
  }
  const out = [];
  let i = n, j = m;
  while (i > 0 || j > 0) {
    const p = P[i * W + j];
    if (p === 1) { out.push({ a: i - 1, b: j - 1 }); i--; j--; }
    else if (p === 2) { out.push({ a: i - 1, b: null }); i--; }
    else { out.push({ a: null, b: j - 1 }); j--; }
  }
  return out.reverse();
}

/** Similarité de Dice entre deux multiensembles de mots (Map mot → nombre). */
export function dice(ma, na, mb, nb) {
  if (!na || !nb) return 0;
  let common = 0;
  const [small, big] = ma.size < mb.size ? [ma, mb] : [mb, ma];
  for (const [k, c] of small) { const d = big.get(k); if (d) common += Math.min(c, d); }
  return (2 * common) / (na + nb);
}

/** Corrélation (Pearson) entre deux empreintes de même taille ; 0 si l'une est uniforme. */
export function correlation(x, y) {
  const n = x.length;
  let sx = 0, sy = 0;
  for (let i = 0; i < n; i++) { sx += x[i]; sy += y[i]; }
  const mx = sx / n, my = sy / n;
  let cxy = 0, cxx = 0, cyy = 0;
  for (let i = 0; i < n; i++) {
    const dx = x[i] - mx, dy = y[i] - my;
    cxy += dx * dy; cxx += dx * dx; cyy += dy * dy;
  }
  if (cxx < 1e-9 || cyy < 1e-9) return cxx < 1e-9 && cyy < 1e-9 ? 1 : 0;
  return cxy / Math.sqrt(cxx * cyy);
}

// ---------------------------------------------------------------- Recalage
/**
 * Transformation x' = s·x + tx, y' = s·y + ty qui amène les points a sur les points b.
 * pts : [{ ax, ay, bx, by }]. tol : écart admis (mêmes unités). Déterministe.
 * Retourne { s, tx, ty, inliers, n } ou null si le consensus est trop faible.
 */
export function fitSimilarity(pts, tol, { minInliers = 4, maxScale = 2, accept = () => true } = {}) {
  const n = pts.length;
  if (n < 2) return null;
  const count = (s, tx, ty) => {
    let c = 0;
    for (const p of pts) if (Math.hypot(s * p.ax + tx - p.bx, s * p.ay + ty - p.by) <= tol) c++;
    return c;
  };
  const cands = [{ s: 1, tx: 0, ty: 0, prior: 0 }];
  // Translations pures proposées par chaque point (le cas le plus courant : simple décalage).
  for (const p of pts) cands.push({ s: 1, tx: p.bx - p.ax, ty: p.by - p.ay, prior: 1 });
  // Échelle + translation proposées par des paires de points éloignés (générateur déterministe).
  let seed = 12345;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  const tries = Math.min(400, (n * (n - 1)) / 2);
  for (let t = 0; t < tries; t++) {
    const i = Math.floor(rnd() * n), j = Math.floor(rnd() * n);
    if (i === j) continue;
    const p = pts[i], q = pts[j];
    const da = Math.hypot(p.ax - q.ax, p.ay - q.ay);
    if (da < 20 * tol) continue;
    const s = Math.hypot(p.bx - q.bx, p.by - q.by) / da;
    if (!(s > 1 / maxScale && s < maxScale)) continue;
    cands.push({ s, tx: p.bx - s * p.ax, ty: p.by - s * p.ay, prior: 2 });
  }
  let best = null;
  for (const c of cands) {
    if (!accept(c.s, c.tx, c.ty)) continue; // transformation invraisemblable pour une impression
    c.inliers = count(c.s, c.tx, c.ty);
    if (!best || c.inliers > best.inliers || (c.inliers === best.inliers && c.prior < best.prior)) best = c;
  }
  if (!best || best.inliers < Math.min(minInliers, n)) return null;
  // Préférer « aucun décalage » s'il explique presque aussi bien les points.
  const id = cands[0];
  if (id.inliers >= 0.9 * best.inliers && id.inliers >= Math.min(minInliers, n)) best = id;
  // Affinage : moindres carrés sur les points retenus (deux passes).
  const unrefined = { s: best.s, tx: best.tx, ty: best.ty };
  let { s, tx, ty } = best;
  for (let pass = 0; pass < 2; pass++) {
    const inl = pts.filter(p => Math.hypot(s * p.ax + tx - p.bx, s * p.ay + ty - p.by) <= tol * (pass ? 1 : 1.5));
    if (inl.length < 2) break;
    let max = 0, may = 0, mbx = 0, mby = 0;
    for (const p of inl) { max += p.ax; may += p.ay; mbx += p.bx; mby += p.by; }
    max /= inl.length; may /= inl.length; mbx /= inl.length; mby /= inl.length;
    let num = 0, den = 0;
    for (const p of inl) {
      const dx = p.ax - max, dy = p.ay - may;
      num += dx * (p.bx - mbx) + dy * (p.by - mby);
      den += dx * dx + dy * dy;
    }
    let s2 = den > 1e-6 ? num / den : 1;
    if (Math.abs(s2 - 1) < 0.002 || den < 1e-6) s2 = 1; // échelle 1 si l'écart est négligeable
    s = s2;
    tx = mbx - s * max;
    ty = mby - s * may;
  }
  if (Math.abs(tx) < 0.05 && Math.abs(ty) < 0.05 && s === 1) { tx = 0; ty = 0; }
  if (!accept(s, tx, ty)) ({ s, tx, ty } = unrefined);
  return { s, tx, ty, inliers: count(s, tx, ty), n };
}
