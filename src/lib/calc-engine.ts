export interface CalcError {
  message: string;
}

export class ExpressionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ExpressionError";
  }
}

type Tok =
  | { type: "number"; value: number }
  | { type: "ident"; value: string }
  | { type: "op"; value: string }
  | { type: "paren"; value: "(" | ")" }
  | { type: "pipe"; value: "|" }
  | { type: "fact"; value: "!" }
  | { type: "comma"; value: "," }
  | { type: "end"; value: "" };

export const FUNCTION_ARITY: Record<string, number> = {
  sin: 1, cos: 1, tan: 1, asin: 1, acos: 1, atan: 1,
  sinh: 1, cosh: 1, tanh: 1, asinh: 1, acosh: 1, atanh: 1,
  ln: 1, log: 1, log2: 1, log10: 1, sqrt: 1, cbrt: 1,
  abs: 1, floor: 1, ceil: 1, round: 1, exp: 1, sign: 1,
  min: 2, max: 2,
};

export const CONSTANTS: Record<string, number> = {
  pi: Math.PI,
  e: Math.E,
  tau: Math.PI * 2,
  phi: (1 + Math.sqrt(5)) / 2,
  inf: Infinity,
};

function isAlpha(c: string): boolean {
  return /[a-zA-Z]/.test(c);
}

function tokenize(input: string): Tok[] {
  const tokens: Tok[] = [];
  const n = input.length;
  let i = 0;

  while (i < n) {
    const c = input[i];
    if (/\s/.test(c)) { i++; continue; }

    if (/[0-9]/.test(c) || (c === "." && i + 1 < n && /[0-9]/.test(input[i + 1]))) {
      let j = i;
      while (j < n && /[0-9.]/.test(input[j])) j++;
      if (j < n && (input[j] === "e" || input[j] === "E")) {
        let k = j + 1;
        if (k < n && (input[k] === "+" || input[k] === "-")) k++;
        if (k < n && /[0-9]/.test(input[k])) {
          while (k < n && /[0-9]/.test(input[k])) k++;
          j = k;
        }
      }
      const value = parseFloat(input.slice(i, j));
      if (Number.isNaN(value)) throw new ExpressionError(`Invalid number "${input.slice(i, j)}"`);
      tokens.push({ type: "number", value });
      i = j;
      continue;
    }

    if (isAlpha(c)) {
      let j = i;
      while (j < n && (isAlpha(input[j]) || /[0-9]/.test(input[j]))) j++;
      tokens.push({ type: "ident", value: input.slice(i, j).toLowerCase() });
      i = j;
      continue;
    }

    if (c === "(") { tokens.push({ type: "paren", value: "(" }); i++; continue; }
    if (c === ")") { tokens.push({ type: "paren", value: ")" }); i++; continue; }
    if (c === ",") { tokens.push({ type: "comma", value: "," }); i++; continue; }
    if (c === "|") { tokens.push({ type: "pipe", value: "|" }); i++; continue; }
    if (c === "!") { tokens.push({ type: "fact", value: "!" }); i++; continue; }
    if ("+-*/^%".includes(c)) { tokens.push({ type: "op", value: c }); i++; continue; }
    throw new ExpressionError(`Unexpected character "${c}"`);
  }
  tokens.push({ type: "end", value: "" });
  return tokens;
}

export function gamma(z: number): number {
  if (z < 0.5) return Math.PI / (Math.sin(Math.PI * z) * gamma(1 - z));
  if (!Number.isFinite(z)) return Infinity;
  const g = 7;
  const c = [
    0.99999999999980993, 676.5203681218851, -1259.1392167224028,
    771.32342877765313, -176.61502916214059, 12.507343278686905,
    -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7,
  ];
  z -= 1;
  let x = c[0];
  for (let i = 1; i < g + 2; i++) x += c[i] / (z + i);
  const t = z + g + 0.5;
  return Math.sqrt(2 * Math.PI) * Math.pow(t, z + 0.5) * Math.exp(-t) * x;
}

export function factorial(n: number): number {
  if (n < 0) return NaN;
  if (n === Math.floor(n)) {
    if (n > 170) return Infinity;
    let r = 1;
    for (let i = 2; i <= n; i++) r *= i;
    return r;
  }
  return gamma(n + 1);
}

export function evalExpression(
  input: string,
  options?: { variables?: Record<string, number>; degrees?: boolean }
): number {
  const vars = options?.variables || {};
  const degrees = options?.degrees ?? false;
  if (!input.trim()) throw new ExpressionError("Empty expression");

  const toks = tokenize(input);
  let pos = 0;

  const peek = (): Tok => toks[pos];
  const next = (): Tok => toks[pos++];
  const expect = (type: string, value?: string) => {
    const t = peek();
    if (t.type !== type) throw new ExpressionError("Unexpected token");
    if (value !== undefined && String(t.value) !== value) throw new ExpressionError("Unexpected token");
    pos++;
    return t;
  };

  const startsPrimary = (t: Tok): boolean =>
    t.type === "number" || t.type === "ident" || (t.type === "paren" && t.value === "(");

  const parseExpression = (): number => {
    let value = parseTerm();
    while (peek().type === "op" && (peek().value === "+" || peek().value === "-")) {
      const op = next().value;
      const rhs = parseTerm();
      value = op === "+" ? value + rhs : value - rhs;
    }
    return value;
  };

  const parseTerm = (): number => {
    let value = parseUnary();
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const t = peek();
      if (t.type === "op" && (t.value === "*" || t.value === "/" || t.value === "%")) {
        const op = next().value;
        const rhs = parseUnary();
        value = op === "*" ? value * rhs : op === "/" ? value / rhs : value % rhs;
        continue;
      }
      if (startsPrimary(t)) {
        // Implicit multiplication: 2x, 2(x+1), x sin(x), 3!
        value = value * parseUnary();
        continue;
      }
      break;
    }
    return value;
  };

  const parseUnary = (): number => {
    const t = peek();
    if (t.type === "op" && (t.value === "-" || t.value === "+")) {
      const op = next().value;
      const operand = parseUnary();
      return op === "-" ? -operand : operand;
    }
    return parsePower();
  };

  const parsePower = (): number => {
    const base = parsePostfix();
    if (peek().type === "op" && peek().value === "^") {
      next();
      const exp = parseUnary();
      return Math.pow(base, exp);
    }
    return base;
  };

  const parsePostfix = (): number => {
    let value = parsePrimary();
    while (peek().type === "fact") {
      next();
      value = factorial(value);
    }
    return value;
  };

  const parsePrimary = (): number => {
    const t = peek();
    if (t.type === "number") { next(); return t.value; }
    if (t.type === "ident") {
      const name = String(next().value);
      if (name in FUNCTION_ARITY) {
        expect("paren", "(");
        const args: number[] = [parseExpression()];
        while (peek().type === "comma") {
          next();
          args.push(parseExpression());
        }
        expect("paren", ")");
        return applyFunction(name, args, degrees);
      }
      if (name in vars) return vars[name];
      if (name in CONSTANTS) return CONSTANTS[name];
      throw new ExpressionError(`Unknown symbol "${name}"`);
    }
    if (t.type === "paren" && t.value === "(") {
      next();
      const value = parseExpression();
      expect("paren", ")");
      return value;
    }
    if (t.type === "pipe") {
      next();
      const value = parseExpression();
      expect("pipe");
      return Math.abs(value);
    }
    throw new ExpressionError("Unexpected token");
  };

  const result = parseExpression();
  if (peek().type !== "end") throw new ExpressionError("Unexpected token");
  return result;
}

function applyFunction(name: string, args: number[], deg: boolean): number {
  const a = args[0];
  switch (name) {
    case "sin": return deg ? Math.sin((a * Math.PI) / 180) : Math.sin(a);
    case "cos": return deg ? Math.cos((a * Math.PI) / 180) : Math.cos(a);
    case "tan": return deg ? Math.tan((a * Math.PI) / 180) : Math.tan(a);
    case "asin": { const r = Math.asin(a); return deg ? (r * 180) / Math.PI : r; }
    case "acos": { const r = Math.acos(a); return deg ? (r * 180) / Math.PI : r; }
    case "atan": { const r = Math.atan(a); return deg ? (r * 180) / Math.PI : r; }
    case "sinh": return Math.sinh(a);
    case "cosh": return Math.cosh(a);
    case "tanh": return Math.tanh(a);
    case "asinh": return Math.asinh(a);
    case "acosh": return Math.acosh(a);
    case "atanh": return Math.atanh(a);
    case "ln": return Math.log(a);
    case "log": case "log10": return Math.log10(a);
    case "log2": return Math.log2(a);
    case "sqrt": return Math.sqrt(a);
    case "cbrt": return Math.cbrt(a);
    case "abs": return Math.abs(a);
    case "floor": return Math.floor(a);
    case "ceil": return Math.ceil(a);
    case "round": return Math.round(a);
    case "exp": return Math.exp(a);
    case "sign": return Math.sign(a);
    case "min": return Math.min(args[0], args[1]);
    case "max": return Math.max(args[0], args[1]);
    default: throw new ExpressionError(`Unknown function "${name}"`);
  }
}

export function formatNumber(n: number, maxDigits = 12): string {
  if (Number.isNaN(n)) return "NaN";
  if (n === Infinity) return "∞";
  if (n === -Infinity) return "-∞";
  if (Object.is(n, -0)) return "0";
  if (Math.abs(n) < 1e-15) return "0";
  if (Math.abs(n) >= 1e12 || (Math.abs(n) < 1e-9 && n !== 0)) {
    return n.toExponential(Math.min(6, Math.max(0, maxDigits - 4)));
  }
  const s = n.toPrecision(maxDigits);
  const trimmed = parseFloat(s).toString();
  return trimmed;
}

export function tryEval(input: string, options?: { variables?: Record<string, number>; degrees?: boolean }): { ok: true; value: number } | { ok: false; error: string } {
  try {
    return { ok: true, value: evalExpression(input, options) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error" };
  }
}
