import { evalExpression, FUNCTION_ARITY, CONSTANTS } from "./calc-engine";

export interface SplitEquation {
  lhs: string;
  rhs: string;
}

export function splitEquation(input: string): SplitEquation {
  const s = input.trim();
  let depth = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === "(" || c === "[") depth++;
    else if (c === ")" || c === "]") depth--;
    else if (c === "=" && depth === 0) {
      const prev = s[i - 1];
      const next = s[i + 1];
      if (prev === "=" || prev === "!" || prev === "<" || prev === ">" || next === "=") continue;
      return { lhs: s.slice(0, i).trim(), rhs: s.slice(i + 1).trim() };
    }
  }
  return { lhs: s, rhs: "0" };
}

/**
 * Normalizes a function or equation expression for graphing.
 * E.g., "y = x^2 + x + 2" -> "x^2 + x + 2"
 *       "f(x) = x^2 + x + 2" -> "x^2 + x + 2"
 *       "x^2 + x + 2 = y" -> "x^2 + x + 2"
 *       "2x + 3 = 7" -> "(2x + 3) - (7)"
 */
export function parseGraphExpr(input: string): string {
  const s = input.trim();
  if (!s) return "";

  // Strip common assignment prefixes if present without any other '='
  const cleanAssign = s.replace(/^(?:y|f\([a-zA-Z]\)|y\([a-zA-Z]\)|g\([a-zA-Z]\))\s*=\s*/i, "");
  if (!cleanAssign.includes("=")) {
    return cleanAssign;
  }

  const { lhs, rhs } = splitEquation(s);
  const lClean = lhs.trim().toLowerCase();
  const rClean = rhs.trim().toLowerCase();

  // If LHS is y or function notation f(x)
  if (lClean === "y" || /^[a-z]\([a-z]\)$/.test(lClean)) {
    return rhs;
  }
  // If RHS is y or function notation f(x)
  if (rClean === "y" || /^[a-z]\([a-z]\)$/.test(rClean)) {
    return lhs;
  }

  return `(${lhs}) - (${rhs})`;
}

/**
 * Detect unknown identifiers in expressions.
 * When `allowE` is true, single-letter `e` is kept as a variable (used for formula solving
 * like `E = m*c^2`), while named constants pi/tau/phi/inf remain reserved.
 */
export function detectVariables(exprs: string[], allowE = false): string[] {
  const set = new Set<string>();
  const reserved: Record<string, number> = allowE
    ? { ...FUNCTION_ARITY, pi: 0, tau: 0, phi: 0, inf: 0 }
    : { ...FUNCTION_ARITY, ...CONSTANTS };
  for (const e of exprs) {
    const matches = e.match(/[a-zA-Z][a-zA-Z0-9]*/g) || [];
    for (const m of matches) {
      const lower = m.toLowerCase();
      if (lower in reserved) continue;
      set.add(lower);
    }
  }
  return [...set];
}

export function evalAt(expr: string, vars: Record<string, number>): number | null {
  try {
    const v = evalExpression(expr, { variables: vars });
    return Number.isFinite(v) ? v : null;
  } catch {
    return null;
  }
}

export function makeEquationFunction(lhs: string, rhs: string, variable: string): (x: number) => number {
  return (x) => {
    const vars: Record<string, number> = { [variable]: x };
    const l = evalExpression(lhs, { variables: vars });
    const r = evalExpression(rhs, { variables: vars });
    return l - r;
  };
}

/**
 * Find real roots of f over [lo, hi] using bisection (sign changes) + Newton (tangencies).
 */
export function findRoots(f: (x: number) => number, opts?: { lo?: number; hi?: number }): number[] {
  const lo = opts?.lo ?? -100;
  const hi = opts?.hi ?? 100;
  const N = 8000;
  const eps = 1e-9;
  const roots: number[] = [];

  const addRoot = (start: number) => {
    if (!Number.isFinite(start)) return;
    let x = start;
    for (let k = 0; k < 60; k++) {
      let fx: number | null = null;
      try {
        const v = f(x);
        fx = Number.isFinite(v) ? v : null;
      } catch {
        fx = null;
      }
      if (fx === null) break;
      if (Math.abs(fx) < 1e-10) break;
      const h = 1e-6 * Math.max(1, Math.abs(x));
      let fph: number | null = null;
      let fmh: number | null = null;
      try {
        fph = f(x + h);
        fmh = f(x - h);
      } catch {
        fph = null;
        fmh = null;
      }
      if (fph === null || fmh === null) break;
      const fd = (fph - fmh) / (2 * h);
      if (!Number.isFinite(fd) || Math.abs(fd) < 1e-12) break;
      const next = x - fx / fd;
      if (!Number.isFinite(next) || Math.abs(next) > 1e7) break;
      if (Math.abs(next - x) < 1e-12) break;
      x = next;
    }
    // Only accept genuine roots
    let fxFinal: number | null = null;
    try {
      const v = f(x);
      fxFinal = Number.isFinite(v) ? v : null;
    } catch {
      fxFinal = null;
    }
    if (fxFinal === null || Math.abs(fxFinal) > 1e-6) return;
    if (x < lo || x > hi) return;
    if (Math.abs(x) < 1e-4) x = 0;
    const tol = 1e-5 * Math.max(1, Math.abs(x));
    if (roots.some((s) => Math.abs(s - x) < tol)) return;
    roots.push(x);
  };

  // 1. Bisection over sign changes (odd-multiplicity roots)
  let prevX = lo;
  let prevY: number | null = null;
  for (let i = 0; i <= N; i++) {
    const x = lo + (i / N) * (hi - lo);
    let y: number | null = null;
    try {
      const v = f(x);
      y = Number.isFinite(v) ? v : null;
    } catch {
      y = null;
    }
    if (y === null) {
      prevY = null;
      prevX = x;
      continue;
    }
    if (prevY !== null && prevY * y < 0) {
      let a = prevX;
      let b = x;
      let fa = prevY;
      for (let k = 0; k < 120; k++) {
        const mid = (a + b) / 2;
        let fm: number | null = null;
        try {
          const v = f(mid);
          fm = Number.isFinite(v) ? v : null;
        } catch {
          fm = null;
        }
        if (fm === null) break;
        if (Math.abs(fm) < eps) {
          addRoot(mid);
          break;
        }
        if (fa * fm <= 0) {
          b = mid;
        } else {
          a = mid;
          fa = fm;
        }
      }
      if (Math.abs(f((a + b) / 2)) >= eps) addRoot((a + b) / 2);
    }
    prevY = y;
    prevX = x;
  }

  // 2. Newton-Raphson from a grid of starts (catches even-multiplicity/tangent roots)
  const M = 200;
  for (let i = 0; i <= M; i++) {
    addRoot(lo + (i / M) * (hi - lo));
  }

  roots.sort((a, b) => a - b);
  return roots;
}

function gaussianSolve(matrix: number[][]): number[] | null {
  const n = matrix.length;
  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let r = col + 1; r < n; r++) {
      if (Math.abs(matrix[r][col]) > Math.abs(matrix[pivot][col])) pivot = r;
    }
    if (Math.abs(matrix[pivot][col]) < 1e-12) return null;
    [matrix[col], matrix[pivot]] = [matrix[pivot], matrix[col]];
    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const factor = matrix[r][col] / matrix[col][col];
      for (let c = col; c <= n; c++) matrix[r][c] -= factor * matrix[col][c];
    }
  }
  return matrix.map((row, i) => row[n] / row[i]);
}

/**
 * Estimate the polynomial degree of f via finite differences (0..maxDegree).
 * Returns null when f is not (low-degree) polynomial.
 */
export function estimateDegree(f: (x: number) => number, maxDegree = 6): number | null {
  const pts: (number | null)[] = [];
  for (let x = 0; x < 28; x++) {
    try {
      const v = f(x);
      pts.push(Number.isFinite(v) ? v : null);
    } catch {
      pts.push(null);
    }
  }
  if (pts.some((p) => p === null)) return null;
  const values = pts as number[];
  if (values.every((v) => Math.abs(v) < 1e-8)) return 0;
  let cur = values;
  for (let d = 1; d <= maxDegree + 2; d++) {
    const next: number[] = [];
    for (let i = 0; i < cur.length - 1; i++) next.push(cur[i + 1] - cur[i]);
    cur = next;
    if (cur.length === 0) return null;
    const maxAbs = Math.max(...cur.map(Math.abs));
    if (maxAbs < 1e-6) return d - 1;
  }
  return null;
}

/**
 * Fit polynomial coefficients [c0, c1, ..., cd] such that f(x) ≈ Σ c_i x^i.
 */
export function polyCoeffs(f: (x: number) => number, degree: number): number[] | null {
  const rows: number[][] = [];
  for (let x = 0; x <= degree; x++) {
    let v: number | null = null;
    try {
      const val = f(x);
      v = Number.isFinite(val) ? val : null;
    } catch {
      v = null;
    }
    if (v === null) return null;
    const row: number[] = [];
    for (let p = 0; p <= degree; p++) row.push(Math.pow(x, p));
    row.push(v);
    rows.push(row);
  }
  return gaussianSolve(rows);
}

export function fmtCoeff(n: number): string {
  if (Math.abs(n) < 1e-10) return "0";
  const r = Math.round(n * 1e8) / 1e8;
  if (Number.isInteger(r)) return String(r);
  return parseFloat(r.toPrecision(10)).toString();
}
