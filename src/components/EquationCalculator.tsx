import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Variable, Square, Grid3x3, Sigma, Play, Check, X, AlertTriangle, Eraser, LineChart,
} from "lucide-react";
import {
  splitEquation, detectVariables, evalAt, makeEquationFunction,
  findRoots, estimateDegree, polyCoeffs, fmtCoeff,
} from "../lib/calc-solve";
import EquationGraph from "./EquationGraph";

const spring = { type: "spring" as const, stiffness: 300, damping: 30 };

type Mode = "solve" | "quadratic" | "system" | "formula" | "graph";

const examples = [
  "2x + 3 = 7",
  "x^2 - 5x + 6 = 0",
  "3(x - 2) = x + 6",
  "x^2 = 4",
  "sin(x) = 0.5",
  "e^x = 2",
  "x^3 - x = 0",
];

function formatPoly(coeffs: number[], v: string): string {
  const parts: string[] = [];
  for (let i = coeffs.length - 1; i >= 0; i--) {
    const c = coeffs[i];
    if (Math.abs(c) < 1e-9) continue;
    const abs = Math.abs(c);
    const sign = c < 0 ? "-" : "+";
    const term =
      i === 0 ? fmtCoeff(abs)
      : i === 1 ? (abs === 1 ? v : `${fmtCoeff(abs)}${v}`)
      : (abs === 1 ? `${v}^${i}` : `${fmtCoeff(abs)}${v}^${i}`);
    if (parts.length === 0 && sign === "+") parts.push(term);
    else parts.push(`${sign} ${term}`);
  }
  return parts.join(" ") || "0";
}

interface RootInfo {
  x: number;
  lhs: number;
  rhs: number;
}

interface SolveReport {
  variable: string;
  lhs: string;
  rhs: string;
  steps: string[];
  roots: RootInfo[];
}

function runSolve(input: string): { ok: true; report: SolveReport } | { ok: false; error: string } {
  const { lhs, rhs } = splitEquation(input);
  if (!lhs.trim() || !rhs.trim()) {
    return { ok: false, error: "Enter an equation like 2x + 3 = 7." };
  }
  const vars = detectVariables([lhs, rhs]);
  if (vars.length === 0) {
    const l = evalAt(lhs, {});
    const r = evalAt(rhs, {});
    if (l === null || r === null) return { ok: false, error: "Could not parse the equation." };
    if (Math.abs(l - r) < 1e-9) return { ok: false, error: "This is an identity — true for every value." };
    return { ok: false, error: "This statement is false — no value satisfies it." };
  }
  if (vars.length > 1) {
    return { ok: false, error: `Equation has multiple unknowns: ${vars.join(", ")}. Solve for one at a time.` };
  }
  const variable = vars[0];
  const lhsCheck = evalAt(lhs, { [variable]: 0 });
  const rhsCheck = evalAt(rhs, { [variable]: 0 });
  if (lhsCheck === null || rhsCheck === null) {
    return { ok: false, error: "Could not parse one side of the equation." };
  }

  const f = makeEquationFunction(lhs, rhs, variable);
  const steps: string[] = [`Given: ${lhs} = ${rhs}`, `Standard form: ${lhs} − (${rhs}) = 0`];
  const roots: RootInfo[] = [];

  const degree = estimateDegree(f);
  if (degree === 0) {
    const c = lhsCheck - rhsCheck;
    if (Math.abs(c) < 1e-9) return { ok: false, error: "This is an identity — true for every value." };
    return { ok: false, error: `No solution: the equation reduces to ${fmtCoeff(c)} = 0.` };
  }
  if (degree === 1) {
    const coeffs = polyCoeffs(f, 1);
    if (!coeffs) return { ok: false, error: "Could not determine coefficients." };
    const c = coeffs[0];
    const b = coeffs[1];
    steps.push(`This is linear: ${formatPoly(coeffs, variable)} = 0`);
    steps.push(`${variable} = −${fmtCoeff(c)} / ${fmtCoeff(b)}`);
    const root = -c / b;
    steps.push(`${variable} = ${fmtCoeff(root)}`);
    roots.push({ x: root, lhs: evalAt(lhs, { [variable]: root })!, rhs: evalAt(rhs, { [variable]: root })! });
  } else if (degree === 2) {
    const coeffs = polyCoeffs(f, 2);
    if (!coeffs) return { ok: false, error: "Could not determine coefficients." };
    const a = coeffs[2];
    const b = coeffs[1];
    const c = coeffs[0];
    steps.push(`This is quadratic: ${formatPoly(coeffs, variable)} = 0`);
    steps.push(`a = ${fmtCoeff(a)}, b = ${fmtCoeff(b)}, c = ${fmtCoeff(c)}`);
    const D = b * b - 4 * a * c;
    steps.push(`Δ = b² − 4ac = ${fmtCoeff(b)}² − 4·${fmtCoeff(a)}·${fmtCoeff(c)} = ${fmtCoeff(D)}`);
    if (D > 0) {
      const r1 = (-b + Math.sqrt(D)) / (2 * a);
      const r2 = (-b - Math.sqrt(D)) / (2 * a);
      steps.push(`Δ > 0 → two distinct real roots:`);
      steps.push(`${variable}₁ = (−${fmtCoeff(b)} + √${fmtCoeff(D)}) / (2·${fmtCoeff(a)}) = ${fmtCoeff(r1)}`);
      steps.push(`${variable}₂ = (−${fmtCoeff(b)} − √${fmtCoeff(D)}) / (2·${fmtCoeff(a)}) = ${fmtCoeff(r2)}`);
      roots.push({ x: r1, lhs: evalAt(lhs, { [variable]: r1 })!, rhs: evalAt(rhs, { [variable]: r1 })! });
      roots.push({ x: r2, lhs: evalAt(lhs, { [variable]: r2 })!, rhs: evalAt(rhs, { [variable]: r2 })! });
    } else if (Math.abs(D) < 1e-9) {
      const r = -b / (2 * a);
      steps.push(`Δ = 0 → one repeated root:`);
      steps.push(`${variable} = −b/(2a) = ${fmtCoeff(r)}`);
      roots.push({ x: r, lhs: evalAt(lhs, { [variable]: r })!, rhs: evalAt(rhs, { [variable]: r })! });
    } else {
      const real = -b / (2 * a);
      const imag = Math.sqrt(-D) / (2 * a);
      steps.push(`Δ < 0 → no real roots.`);
      steps.push(`Complex roots: ${fmtCoeff(real)} ± ${fmtCoeff(imag)}·i`);
    }
  } else {
    if (degree !== null && degree >= 3) {
      steps.push(`Polynomial of degree ${degree} — solving numerically over [−100, 100].`);
    } else {
      steps.push(`No closed-form solution — solving numerically over [−100, 100].`);
    }
    const found = findRoots(f);
    if (found.length === 0) {
      steps.push("No real roots found in the search range.");
    } else {
      steps.push(`Found ${found.length} real solution${found.length > 1 ? "s" : ""}:`);
    }
    for (const x of found) {
      roots.push({ x, lhs: evalAt(lhs, { [variable]: x })!, rhs: evalAt(rhs, { [variable]: x })! });
    }
  }

  return { ok: true, report: { variable, lhs, rhs, steps, roots } };
}

function parseNum(s: string): number {
  const v = parseFloat(s);
  return Number.isNaN(v) ? 0 : v;
}

const det3 = (m: number[][]): number =>
  m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) -
  m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) +
  m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0]);

export default function EquationCalculator() {
  const [mode, setMode] = useState<Mode>("solve");

  // Solve tab
  const [equation, setEquation] = useState("x^2 - 5x + 6 = 0");

  // Quadratic tab
  const [qa, setQa] = useState("1");
  const [qb, setQb] = useState("-5");
  const [qc, setQc] = useState("6");

  // System tab
  const [sysSize, setSysSize] = useState<2 | 3>(2);
  const [sys, setSys] = useState<string[][]>([
    ["1", "2", "5"],
    ["3", "-1", "8"],
  ]);
  const [sys3, setSys3] = useState<string[][]>([
    ["2", "1", "-1", "3"],
    ["1", "-3", "2", "-1"],
    ["3", "1", "1", "9"],
  ]);

  // Formula tab
  const [formula, setFormula] = useState("F = m*a");
  const [target, setTarget] = useState("a");
  const [knowns, setKnowns] = useState<Record<string, string>>({ f: "10", m: "2" });

  const solveReport = useMemo(() => runSolve(equation), [equation]);

  const quadraticReport = useMemo(() => {
    const a = parseNum(qa);
    const b = parseNum(qb);
    const c = parseNum(qc);
    const steps: string[] = [`Equation: ${fmtCoeff(a)}x² + ${fmtCoeff(b)}x + ${fmtCoeff(c)} = 0`];
    if (Math.abs(a) < 1e-12) {
      if (Math.abs(b) < 1e-12) {
        steps.push("a = 0 and b = 0 — not a solvable equation (c ≠ 0).");
      } else {
        steps.push(`a = 0 — this is actually linear: x = ${fmtCoeff(-c / b)}`);
      }
      return { steps, roots: [] as { x: number; complex: boolean }[], D: 0, vertex: null as { x: number; y: number } | null, up: false };
    }
    const D = b * b - 4 * a * c;
    steps.push(`a = ${fmtCoeff(a)}, b = ${fmtCoeff(b)}, c = ${fmtCoeff(c)}`);
    steps.push(`Δ = b² − 4ac = ${fmtCoeff(b)}² − 4·(${fmtCoeff(a)})·(${fmtCoeff(c)}) = ${fmtCoeff(D)}`);
    const roots: { x: number; complex: boolean }[] = [];
    if (D > 0) {
      const r1 = (-b + Math.sqrt(D)) / (2 * a);
      const r2 = (-b - Math.sqrt(D)) / (2 * a);
      steps.push("Δ > 0 → two distinct real roots");
      steps.push(`x₁ = (−b + √Δ) / 2a = ${fmtCoeff(r1)}`);
      steps.push(`x₂ = (−b − √Δ) / 2a = ${fmtCoeff(r2)}`);
      roots.push({ x: r1, complex: false }, { x: r2, complex: false });
    } else if (Math.abs(D) < 1e-12) {
      const r = -b / (2 * a);
      steps.push("Δ = 0 → one repeated real root");
      steps.push(`x = −b/2a = ${fmtCoeff(r)}`);
      roots.push({ x: r, complex: false });
    } else {
      const real = -b / (2 * a);
      const imag = Math.sqrt(-D) / (2 * a);
      steps.push("Δ < 0 → no real roots (two complex conjugate roots)");
      steps.push(`x = ${fmtCoeff(real)} ± ${fmtCoeff(imag)}i`);
      roots.push({ x: real, complex: true }, { x: imag, complex: true });
    }
    const vx = -b / (2 * a);
    const vy = -D / (4 * a);
    steps.push(`Vertex: (${fmtCoeff(vx)}, ${fmtCoeff(vy)})`);
    steps.push(`Axis of symmetry: x = ${fmtCoeff(vx)}`);
    steps.push(`Opens ${a > 0 ? "upward" : "downward"} (a ${a > 0 ? ">" : "<"} 0)`);
    return { steps, roots, D, vertex: { x: vx, y: vy }, up: a > 0 };
  }, [qa, qb, qc]);

  const systemReport = useMemo(() => {
    const steps: string[] = [];
    if (sysSize === 2) {
      const [a1, b1, c1] = sys[0].map(parseNum);
      const [a2, b2, c2] = sys[1].map(parseNum);
      steps.push(`a₁x + b₁y = c₁  →  ${fmtCoeff(a1)}x + ${fmtCoeff(b1)}y = ${fmtCoeff(c1)}`);
      steps.push(`a₂x + b₂y = c₂  →  ${fmtCoeff(a2)}x + ${fmtCoeff(b2)}y = ${fmtCoeff(c2)}`);
      const D = a1 * b2 - a2 * b1;
      const Dx = c1 * b2 - c2 * b1;
      const Dy = a1 * c2 - a2 * c1;
      steps.push(`D  = a₁b₂ − a₂b₁ = ${fmtCoeff(a1)}·${fmtCoeff(b2)} − ${fmtCoeff(a2)}·${fmtCoeff(b1)} = ${fmtCoeff(D)}`);
      steps.push(`Dx = c₁b₂ − c₂b₁ = ${fmtCoeff(Dx)}`);
      steps.push(`Dy = a₁c₂ − a₂c₁ = ${fmtCoeff(Dy)}`);
      if (Math.abs(D) < 1e-12) {
        if (Math.abs(Dx) < 1e-12 && Math.abs(Dy) < 1e-12) {
          steps.push("D = 0 and Dx = Dy = 0 → infinitely many solutions (dependent system).");
        } else {
          steps.push("D = 0 but Dx or Dy ≠ 0 → no solution (inconsistent system).");
        }
        return { steps, solution: null as string[] | null };
      }
      const x = Dx / D;
      const y = Dy / D;
      steps.push(`x = Dx / D = ${fmtCoeff(Dx)} / ${fmtCoeff(D)} = ${fmtCoeff(x)}`);
      steps.push(`y = Dy / D = ${fmtCoeff(Dy)} / ${fmtCoeff(D)} = ${fmtCoeff(y)}`);
      return { steps, solution: [`x = ${fmtCoeff(x)}`, `y = ${fmtCoeff(y)}`] };
    }
    const m = sys3.map((row) => row.map(parseNum));
    steps.push(`[ ${m[0].slice(0, 3).map(fmtCoeff).join("  ")} ] [x]   [${fmtCoeff(m[0][3])}]`);
    steps.push(`[ ${m[1].slice(0, 3).map(fmtCoeff).join("  ")} ] [y] = [${fmtCoeff(m[1][3])}]`);
    steps.push(`[ ${m[2].slice(0, 3).map(fmtCoeff).join("  ")} ] [z]   [${fmtCoeff(m[2][3])}]`);
    const coeff = (r: number, i: number) => m[r][i];
    const dvec = [m[0][3], m[1][3], m[2][3]];
    const D = det3(m);
    steps.push(`D = ${fmtCoeff(coeff(0, 0))}·(${fmtCoeff(coeff(1, 1))}·${fmtCoeff(coeff(2, 2))} − ${fmtCoeff(coeff(1, 2))}·${fmtCoeff(coeff(2, 1))}) − ${fmtCoeff(coeff(0, 1))}·(...) + ${fmtCoeff(coeff(0, 2))}·(...) = ${fmtCoeff(D)}`);
    if (Math.abs(D) < 1e-12) {
      steps.push("D = 0 → no unique solution (singular matrix).");
      return { steps, solution: null };
    }
    const replaceCol = (i: number): number[][] =>
      m.map((row, r) => row.map((v, c) => (c === i ? dvec[r] : v)));
    const Dx = det3(replaceCol(0));
    const Dy = det3(replaceCol(1));
    const Dz = det3(replaceCol(2));
    steps.push(`Dx = ${fmtCoeff(Dx)}, Dy = ${fmtCoeff(Dy)}, Dz = ${fmtCoeff(Dz)}`);
    const x = Dx / D;
    const y = Dy / D;
    const z = Dz / D;
    steps.push(`x = Dx / D = ${fmtCoeff(x)}`);
    steps.push(`y = Dy / D = ${fmtCoeff(y)}`);
    steps.push(`z = Dz / D = ${fmtCoeff(z)}`);
    return { steps, solution: [`x = ${fmtCoeff(x)}`, `y = ${fmtCoeff(y)}`, `z = ${fmtCoeff(z)}`] };
  }, [sys, sys3, sysSize]);

  const formulaVars = useMemo(() => {
    const { lhs, rhs } = splitEquation(formula);
    return detectVariables([lhs, rhs], true);
  }, [formula]);

  const formulaReport = useMemo(() => {
    const { lhs, rhs } = splitEquation(formula);
    if (!lhs.trim() || !rhs.trim()) return { error: "Enter a formula like F = m*a.", steps: [] as string[], roots: [] as number[], targetVar: "" };
    if (formulaVars.length === 0) return { error: "No variables found in the formula.", steps: [] as string[], roots: [] as number[], targetVar: "" };
    const targetVar = target;
    if (!formulaVars.includes(targetVar)) return { error: "Pick a variable to solve for.", steps: [] as string[], roots: [] as number[], targetVar: "" };
    const otherVars = formulaVars.filter((v) => v !== targetVar);
    const vars: Record<string, number> = {};
    const steps: string[] = [`Formula: ${lhs} = ${rhs}`];
    let substituted = { lhs, rhs };
    for (const v of otherVars) {
      const val = parseNum(knowns[v] ?? "");
      vars[v] = val;
      const re = new RegExp(`\\b${v}\\b`, "g");
      substituted = { lhs: substituted.lhs.replace(re, fmtCoeff(val)), rhs: substituted.rhs.replace(re, fmtCoeff(val)) };
    }
    if (otherVars.length > 0) {
      steps.push(`Substituting known values → ${substituted.lhs} = ${substituted.rhs}`);
    }
    steps.push(`Solving for ${targetVar}:  ${substituted.lhs} − (${substituted.rhs}) = 0`);
    const f = makeEquationFunction(substituted.lhs, substituted.rhs, targetVar);
    const roots = findRoots(f);
    const steps2 = [...steps];
    if (roots.length === 0) {
      steps2.push("No solution found for the given values.");
      return { steps: steps2, roots: [] as number[], error: null as string | null, targetVar };
    }
    for (const r of roots) {
      steps2.push(`${targetVar} = ${fmtCoeff(r)}`);
    }
    return { steps: steps2, roots, error: null, targetVar };
  }, [formula, formulaVars, target, knowns]);

  const handleSetSys = (r: number, c: number, val: string) => {
    setSys((m) => m.map((row, ri) => (ri === r ? row.map((cell, ci) => (ci === c ? val : cell)) : row)));
  };
  const handleSetSys3 = (r: number, c: number, val: string) => {
    setSys3((m) => m.map((row, ri) => (ri === r ? row.map((cell, ci) => (ci === c ? val : cell)) : row)));
  };

  const modeTabs: { id: Mode; label: string; icon: typeof Variable }[] = [
    { id: "solve", label: "Solve", icon: Variable },
    { id: "quadratic", label: "Quadratic", icon: Square },
    { id: "system", label: "Linear System", icon: Grid3x3 },
    { id: "formula", label: "Formula", icon: Sigma },
    { id: "graph", label: "Graph", icon: LineChart },
  ];

  return (
    <div className="flex flex-col h-full gap-4">
      <h2 className="text-xl font-semibold">Equation Calculator</h2>

      <div className="flex gap-1 flex-wrap">
        {modeTabs.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => setMode(t.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                mode === t.id ? "bg-blue-500/20 text-blue-400 border-blue-500/30" : "border-border text-white/50 hover:text-white/80"
              }`}
            >
              <Icon className="w-3.5 h-3.5" /> {t.label}
            </button>
          );
        })}
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto pr-1">
        {mode === "solve" && (
          <div className="flex flex-col gap-4">
            <div className="rounded-2xl border border-border bg-surface/50 backdrop-blur-xl p-4">
              <label className="text-[10px] uppercase tracking-widest text-white/30">Equation</label>
              <div className="flex gap-2 mt-2">
                <input
                  value={equation}
                  onChange={(e) => setEquation(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && setEquation((v) => v)}
                  placeholder="e.g. 2x + 3 = 7"
                  spellCheck={false}
                  className="flex-1 bg-white/5 border border-border rounded-xl px-3 py-2.5 text-sm font-mono text-white/90 focus:outline-none focus:border-blue-500/50 placeholder:text-white/20"
                />
                <button
                  onClick={() => setEquation((v) => v + "")}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-500/20 text-blue-400 border border-blue-500/30 text-sm hover:bg-blue-500/30 transition-colors"
                >
                  <Play className="w-3.5 h-3.5" /> Solve
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5 mt-3">
                {examples.map((ex) => (
                  <button
                    key={ex}
                    onClick={() => setEquation(ex)}
                    className="px-2 py-1 rounded-lg bg-white/5 border border-border text-[10px] font-mono text-white/50 hover:bg-white/10 hover:text-white transition-colors"
                  >
                    {ex}
                  </button>
                ))}
              </div>
            </div>

            <SolveResult result={solveReport} />
          </div>
        )}

        {mode === "quadratic" && (
          <div className="flex flex-col gap-4">
            <div className="rounded-2xl border border-border bg-surface/50 backdrop-blur-xl p-4">
              <label className="text-[10px] uppercase tracking-widest text-white/30">ax² + bx + c = 0</label>
              <div className="flex items-end gap-3 mt-3">
                <CoeffField label="a" value={qa} onChange={setQa} accent="text-blue-400" />
                <CoeffField label="b" value={qb} onChange={setQb} accent="text-emerald-400" />
                <CoeffField label="c" value={qc} onChange={setQc} accent="text-pink-400" />
                <div className="flex-1" />
                <button onClick={() => { setQa("1"); setQb("-5"); setQc("6"); }}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/5 border border-border text-xs text-white/50 hover:text-white transition-colors">
                  <Eraser className="w-3 h-3" /> Reset
                </button>
              </div>
            </div>

            <Panel title="Solution">
              <Steps steps={quadraticReport.steps} />
              {quadraticReport.roots.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-3">
                  {quadraticReport.roots.map((r, i) => (
                    <div key={i} className="rounded-xl bg-blue-500/10 border border-blue-500/25 px-3 py-2.5">
                      <div className="text-[9px] uppercase tracking-widest text-blue-400/70">
                        {r.complex ? (i === 0 ? "Real part" : "Imaginary part") : `Root ${i + 1}`}
                      </div>
                      <div className="text-xl font-semibold text-blue-400 font-mono mt-0.5">
                        {r.complex ? `${fmtCoeff(r.x)} ${i === 1 ? "i" : "± i"}` : fmtCoeff(r.x)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {quadraticReport.vertex && (
                <div className="grid grid-cols-3 gap-2 mt-3">
                  <InfoCard label="Vertex" value={`(${fmtCoeff(quadraticReport.vertex.x)}, ${fmtCoeff(quadraticReport.vertex.y)})`} />
                  <InfoCard label="Discriminant Δ" value={fmtCoeff(quadraticReport.D)} />
                  <InfoCard label="Opens" value={quadraticReport.up ? "Upward" : "Downward"} />
                </div>
              )}
            </Panel>
          </div>
        )}

        {mode === "system" && (
          <div className="flex flex-col gap-4">
            <div className="flex gap-1">
              {([2, 3] as const).map((n) => (
                <button
                  key={n}
                  onClick={() => setSysSize(n)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                    sysSize === n ? "bg-blue-500/20 text-blue-400 border-blue-500/30" : "border-border text-white/50 hover:text-white/80"
                  }`}
                >
                  {n} × {n}
                </button>
              ))}
            </div>

            <div className="rounded-2xl border border-border bg-surface/50 backdrop-blur-xl p-4">
              {sysSize === 2 ? (
                <div className="flex flex-col gap-3">
                  <SystemRow vars={["x", "y"]} row={sys[0]} onChange={(i, v) => handleSetSys(0, i, v)} rowLabel="1" />
                  <SystemRow vars={["x", "y"]} row={sys[1]} onChange={(i, v) => handleSetSys(1, i, v)} rowLabel="2" />
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  <SystemRow vars={["x", "y", "z"]} row={sys3[0]} onChange={(i, v) => handleSetSys3(0, i, v)} rowLabel="1" />
                  <SystemRow vars={["x", "y", "z"]} row={sys3[1]} onChange={(i, v) => handleSetSys3(1, i, v)} rowLabel="2" />
                  <SystemRow vars={["x", "y", "z"]} row={sys3[2]} onChange={(i, v) => handleSetSys3(2, i, v)} rowLabel="3" />
                </div>
              )}
            </div>

            <Panel title="Cramer's Rule">
              <Steps steps={systemReport.steps} />
              {systemReport.solution && (
                <div className="flex flex-wrap gap-2 mt-3">
                  {systemReport.solution.map((s) => (
                    <div key={s} className="rounded-xl bg-blue-500/10 border border-blue-500/25 px-4 py-2.5">
                      <span className="text-lg font-semibold text-blue-400 font-mono">{s}</span>
                    </div>
                  ))}
                </div>
              )}
            </Panel>
          </div>
        )}

        {mode === "formula" && (
          <div className="flex flex-col gap-4">
            <div className="rounded-2xl border border-border bg-surface/50 backdrop-blur-xl p-4">
              <label className="text-[10px] uppercase tracking-widest text-white/30">Formula</label>
              <input
                value={formula}
                onChange={(e) => setFormula(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && setFormula((v) => v)}
                placeholder="e.g. F = m*a  or  v^2 = u^2 + 2*a*s"
                spellCheck={false}
                className="mt-2 w-full bg-white/5 border border-border rounded-xl px-3 py-2.5 text-sm font-mono text-white/90 focus:outline-none focus:border-blue-500/50 placeholder:text-white/20"
              />
              {formulaVars.length > 0 && (
                <>
                  <div className="flex flex-wrap items-end gap-4 mt-4">
                    <div>
                      <label className="text-[10px] uppercase tracking-widest text-white/30">Solve for</label>
                      <div className="flex gap-1.5 mt-1.5">
                        {formulaVars.map((v) => (
                          <button
                            key={v}
                            onClick={() => setTarget(v)}
                            className={`w-9 h-9 rounded-lg text-sm font-mono border transition-colors ${
                              target === v ? "bg-blue-500/20 text-blue-400 border-blue-500/30" : "bg-white/5 text-white/50 border-border hover:text-white"
                            }`}
                          >
                            {v}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2 flex-1">
                      {formulaVars.filter((v) => v !== target).map((v) => (
                        <label key={v} className="text-xs text-white/40">
                          {v} =
                          <input
                            value={knowns[v] ?? ""}
                            onChange={(e) => setKnowns((k) => ({ ...k, [v]: e.target.value }))}
                            inputMode="decimal"
                            className="ml-1.5 w-20 bg-white/5 border border-border rounded-lg px-2 py-1.5 text-sm font-mono text-white/90 focus:outline-none focus:border-blue-500/50"
                          />
                        </label>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>

            {formulaReport.error ? (
              <Panel title="Result"><p className="text-sm text-red-400">{formulaReport.error}</p></Panel>
            ) : (
              <Panel title="Solution">
                <Steps steps={formulaReport.steps} />
                {formulaReport.roots.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-3">
                    {formulaReport.roots.map((r, i) => (
                      <div key={i} className="rounded-xl bg-blue-500/10 border border-blue-500/25 px-4 py-2.5">
                        <span className="text-lg font-semibold text-blue-400 font-mono">
                          {formulaReport.targetVar} = {fmtCoeff(r)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </Panel>
            )}
          </div>
        )}

        {mode === "graph" && (
          <div className="flex flex-col gap-4">
            <div className="rounded-2xl border border-border bg-surface/50 backdrop-blur-xl p-4">
              <label className="text-[10px] uppercase tracking-widest text-white/30">Equation</label>
              <div className="flex gap-2 mt-2">
                <input
                  value={equation}
                  onChange={(e) => setEquation(e.target.value)}
                  placeholder="e.g. x^2 - 5x + 6 = 0"
                  spellCheck={false}
                  className="flex-1 bg-white/5 border border-border rounded-xl px-3 py-2.5 text-sm font-mono text-white/90 focus:outline-none focus:border-blue-500/50 placeholder:text-white/20"
                />
              </div>
              <div className="flex flex-wrap gap-1.5 mt-3">
                {examples.map((ex) => (
                  <button
                    key={ex}
                    onClick={() => setEquation(ex)}
                    className="px-2 py-1 rounded-lg bg-white/5 border border-border text-[10px] font-mono text-white/50 hover:bg-white/10 hover:text-white transition-colors"
                  >
                    {ex}
                  </button>
                ))}
              </div>
            </div>
            <EquationGraph equation={equation} />
          </div>
        )}
      </div>
    </div>
  );
}

function SolveResult({ result }: { result: { ok: true; report: SolveReport } | { ok: false; error: string } }) {
  return (
    <Panel title="Solution">
      <AnimatePresence mode="wait">
        {result.ok ? (
          <motion.div key="ok" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={spring}>
            <Steps steps={result.report.steps} />
            {result.report.roots.length > 0 ? (
              <div className="mt-4">
                <div className="text-[9px] uppercase tracking-widest text-white/30 mb-2">
                  {result.report.roots.length === 1 ? "Solution" : "Solutions"} for {result.report.variable}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {result.report.roots.map((r, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: i * 0.04, ...spring }}
                      className="rounded-xl bg-blue-500/10 border border-blue-500/25 px-3 py-2.5"
                    >
                      <div className="text-[9px] uppercase tracking-widest text-blue-400/70">{result.report.variable}{result.report.roots.length > 1 ? `${i + 1}` : ""}</div>
                      <div className="text-xl font-semibold text-blue-400 font-mono mt-0.5">{fmtCoeff(r.x)}</div>
                    </motion.div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-sm text-amber-400 mt-3">No real solutions.</p>
            )}
            {result.report.roots.length > 0 && (
              <div className="mt-4">
                <div className="text-[9px] uppercase tracking-widest text-white/30 mb-2">Verification</div>
                <div className="flex flex-col gap-1.5">
                  {result.report.roots.map((r, i) => {
                    const diff = Math.abs(r.lhs - r.rhs);
                    const ok = diff < 1e-4;
                    return (
                      <div key={i} className="flex items-center gap-2 text-xs">
                        {ok ? <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" /> : <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />}
                        <span className="text-white/50 font-mono">
                          {result.report.variable} = {fmtCoeff(r.x)}  →  LHS {fmtCoeff(r.lhs)} {ok ? "≈" : "≠"} RHS {fmtCoeff(r.rhs)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </motion.div>
        ) : (
          <motion.div key="err" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex items-center gap-2">
            <X className="w-4 h-4 text-red-400 shrink-0" />
            <p className="text-sm text-red-400">{result.error}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </Panel>
  );
}

function Steps({ steps }: { steps: string[] }) {
  return (
    <ol className="space-y-1.5">
      {steps.map((s, i) => (
        <motion.li
          key={`${i}-${s}`}
          initial={{ opacity: 0, x: -6 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: i * 0.02, ...spring }}
          className="flex items-start gap-2.5"
        >
          <span className="w-5 h-5 rounded-md bg-white/5 border border-border text-[10px] text-white/40 flex items-center justify-center shrink-0 mt-0.5">
            {i + 1}
          </span>
          <span className="text-xs text-white/70 font-mono leading-relaxed break-words">{s}</span>
        </motion.li>
      ))}
    </ol>
  );
}

function CoeffField({ label, value, onChange, accent }: { label: string; value: string; onChange: (v: string) => void; accent: string }) {
  return (
    <label className="flex flex-col gap-1">
      <span className={`text-xs font-mono ${accent}`}>{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        inputMode="decimal"
        className="w-24 bg-white/5 border border-border rounded-lg px-3 py-2 text-sm font-mono text-white/90 focus:outline-none focus:border-blue-500/50"
      />
    </label>
  );
}

function SystemRow({ vars, row, onChange, rowLabel }: { vars: string[]; row: string[]; onChange: (col: number, val: string) => void; rowLabel: string }) {
  const eqs: React.ReactNode[] = [];
  const n = vars.length;
  for (let i = 0; i < n; i++) {
    eqs.push(
      <div key={`c${i}`} className="flex items-center gap-1.5">
        <input
          value={row[i]}
          onChange={(e) => onChange(i, e.target.value)}
          inputMode="decimal"
          className="w-16 bg-white/5 border border-border rounded-lg px-2 py-1.5 text-center text-sm font-mono text-white/90 focus:outline-none focus:border-blue-500/50"
        />
        <span className="text-white/40 text-sm font-mono">{vars[i]}</span>
        {i < n - 1 && <span className="text-white/30 text-xs">+</span>}
      </div>
    );
  }
  eqs.push(
    <div key="eq" className="flex items-center gap-1.5">
      <span className="text-white/30 text-xs">=</span>
      <input
        value={row[n]}
        onChange={(e) => onChange(n, e.target.value)}
        inputMode="decimal"
        className="w-16 bg-white/5 border border-border rounded-lg px-2 py-1.5 text-center text-sm font-mono text-white/90 focus:outline-none focus:border-blue-500/50"
      />
    </div>
  );
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] text-white/30 w-4">{rowLabel}</span>
      <div className="flex items-center gap-2 flex-wrap">{eqs}</div>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={spring}
      className="rounded-2xl border border-border bg-surface/50 backdrop-blur-xl p-4"
    >
      <span className="text-[10px] uppercase tracking-widest text-white/30">{title}</span>
      <div className="mt-3">{children}</div>
    </motion.div>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-white/5 px-3 py-2.5">
      <div className="text-[9px] uppercase tracking-widest text-white/30">{label}</div>
      <div className="text-sm font-semibold text-white/90 font-mono mt-0.5 break-words">{value}</div>
    </div>
  );
}
