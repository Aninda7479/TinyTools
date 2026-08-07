export interface UnitDef {
  id: string;
  name: string;
  symbol: string;
  factor: number;
  offset?: number;
}

export interface UnitCategory {
  id: string;
  label: string;
  units: UnitDef[];
}

export const unitCategories: UnitCategory[] = [
  {
    id: "length",
    label: "Length",
    units: [
      { id: "m", name: "Meter", symbol: "m", factor: 1 },
      { id: "km", name: "Kilometer", symbol: "km", factor: 1000 },
      { id: "cm", name: "Centimeter", symbol: "cm", factor: 0.01 },
      { id: "mm", name: "Millimeter", symbol: "mm", factor: 0.001 },
      { id: "um", name: "Micrometer", symbol: "µm", factor: 1e-6 },
      { id: "nm", name: "Nanometer", symbol: "nm", factor: 1e-9 },
      { id: "mi", name: "Mile", symbol: "mi", factor: 1609.344 },
      { id: "yd", name: "Yard", symbol: "yd", factor: 0.9144 },
      { id: "ft", name: "Foot", symbol: "ft", factor: 0.3048 },
      { id: "in", name: "Inch", symbol: "in", factor: 0.0254 },
      { id: "nmi", name: "Nautical mile", symbol: "nmi", factor: 1852 },
      { id: "au", name: "Astronomical unit", symbol: "au", factor: 149597870700 },
      { id: "ly", name: "Light year", symbol: "ly", factor: 9.4607304725808e15 },
      { id: "pc", name: "Parsec", symbol: "pc", factor: 3.0856775814913673e16 },
      { id: "mil", name: "Mil", symbol: "mil", factor: 0.0000254 },
    ],
  },
  {
    id: "weight",
    label: "Weight",
    units: [
      { id: "kg", name: "Kilogram", symbol: "kg", factor: 1 },
      { id: "g", name: "Gram", symbol: "g", factor: 0.001 },
      { id: "mg", name: "Milligram", symbol: "mg", factor: 1e-6 },
      { id: "ug", name: "Microgram", symbol: "µg", factor: 1e-9 },
      { id: "t", name: "Metric ton", symbol: "t", factor: 1000 },
      { id: "lb", name: "Pound", symbol: "lb", factor: 0.45359237 },
      { id: "oz", name: "Ounce", symbol: "oz", factor: 0.028349523125 },
      { id: "st", name: "Stone", symbol: "st", factor: 6.35029318 },
      { id: "ton", name: "Short ton", symbol: "ton", factor: 907.18474 },
      { id: "lt", name: "Long ton", symbol: "lt", factor: 1016.0469088 },
      { id: "carat", name: "Carat", symbol: "ct", factor: 0.0002 },
      { id: "grain", name: "Grain", symbol: "gr", factor: 6.479891e-5 },
    ],
  },
  {
    id: "temperature",
    label: "Temperature",
    units: [
      { id: "c", name: "Celsius", symbol: "°C", factor: 1 },
      { id: "f", name: "Fahrenheit", symbol: "°F", factor: 5 / 9, offset: -32 },
      { id: "k", name: "Kelvin", symbol: "K", factor: 1, offset: -273.15 },
      { id: "r", name: "Rankine", symbol: "°R", factor: 5 / 9, offset: -491.67 },
    ],
  },
  {
    id: "area",
    label: "Area",
    units: [
      { id: "m2", name: "Square meter", symbol: "m²", factor: 1 },
      { id: "km2", name: "Square kilometer", symbol: "km²", factor: 1e6 },
      { id: "cm2", name: "Square centimeter", symbol: "cm²", factor: 0.0001 },
      { id: "mm2", name: "Square millimeter", symbol: "mm²", factor: 1e-6 },
      { id: "ha", name: "Hectare", symbol: "ha", factor: 10000 },
      { id: "acre", name: "Acre", symbol: "ac", factor: 4046.8564224 },
      { id: "mi2", name: "Square mile", symbol: "mi²", factor: 2589988.110336 },
      { id: "ft2", name: "Square foot", symbol: "ft²", factor: 0.09290304 },
      { id: "in2", name: "Square inch", symbol: "in²", factor: 0.00064516 },
      { id: "yd2", name: "Square yard", symbol: "yd²", factor: 0.83612736 },
    ],
  },
  {
    id: "volume",
    label: "Volume",
    units: [
      { id: "l", name: "Liter", symbol: "L", factor: 0.001 },
      { id: "ml", name: "Milliliter", symbol: "mL", factor: 0.000001 },
      { id: "m3", name: "Cubic meter", symbol: "m³", factor: 1 },
      { id: "cm3", name: "Cubic centimeter", symbol: "cm³", factor: 0.000001 },
      { id: "gal", name: "US gallon", symbol: "gal", factor: 0.003785411784 },
      { id: "qt", name: "US quart", symbol: "qt", factor: 0.000946352946 },
      { id: "pt", name: "US pint", symbol: "pt", factor: 0.000473176473 },
      { id: "cup", name: "US cup", symbol: "cup", factor: 0.0002365882365 },
      { id: "floz", name: "US fluid ounce", symbol: "fl oz", factor: 0.0000295735295625 },
      { id: "tbsp", name: "Tablespoon", symbol: "tbsp", factor: 0.00001478676478125 },
      { id: "tsp", name: "Teaspoon", symbol: "tsp", factor: 0.00000492892159375 },
      { id: "gal_imp", name: "Imperial gallon", symbol: "imp gal", factor: 0.00454609 },
      { id: "cuft", name: "Cubic foot", symbol: "ft³", factor: 0.028316846592 },
      { id: "cuin", name: "Cubic inch", symbol: "in³", factor: 0.000016387064 },
      { id: "bbl", name: "Oil barrel", symbol: "bbl", factor: 0.158987294928 },
    ],
  },
  {
    id: "time",
    label: "Time",
    units: [
      { id: "s", name: "Second", symbol: "s", factor: 1 },
      { id: "ms", name: "Millisecond", symbol: "ms", factor: 0.001 },
      { id: "us", name: "Microsecond", symbol: "µs", factor: 1e-6 },
      { id: "ns", name: "Nanosecond", symbol: "ns", factor: 1e-9 },
      { id: "min", name: "Minute", symbol: "min", factor: 60 },
      { id: "h", name: "Hour", symbol: "h", factor: 3600 },
      { id: "d", name: "Day", symbol: "d", factor: 86400 },
      { id: "wk", name: "Week", symbol: "wk", factor: 604800 },
      { id: "mo", name: "Month (30d)", symbol: "mo", factor: 2592000 },
      { id: "yr", name: "Year (365d)", symbol: "yr", factor: 31536000 },
      { id: "decade", name: "Decade", symbol: "decade", factor: 315360000 },
      { id: "century", name: "Century", symbol: "century", factor: 3153600000 },
    ],
  },
  {
    id: "speed",
    label: "Speed",
    units: [
      { id: "mps", name: "Meter/second", symbol: "m/s", factor: 1 },
      { id: "kmh", name: "Kilometer/hour", symbol: "km/h", factor: 0.2777777777777778 },
      { id: "mph", name: "Mile/hour", symbol: "mph", factor: 0.44704 },
      { id: "knot", name: "Knot", symbol: "kn", factor: 0.5144444444444445 },
      { id: "fts", name: "Foot/second", symbol: "ft/s", factor: 0.3048 },
      { id: "mach", name: "Mach", symbol: "Mach", factor: 343 },
      { id: "c", name: "Speed of light", symbol: "c", factor: 299792458 },
    ],
  },
  {
    id: "data",
    label: "Data",
    units: [
      { id: "b", name: "Bit", symbol: "b", factor: 1 },
      { id: "B", name: "Byte", symbol: "B", factor: 8 },
      { id: "kb", name: "Kilobit", symbol: "kb", factor: 1000 },
      { id: "kB", name: "Kilobyte", symbol: "kB", factor: 8000 },
      { id: "mb", name: "Megabit", symbol: "Mb", factor: 1e6 },
      { id: "mB", name: "Megabyte", symbol: "MB", factor: 8e6 },
      { id: "gb", name: "Gigabit", symbol: "Gb", factor: 1e9 },
      { id: "gB", name: "Gigabyte", symbol: "GB", factor: 8e9 },
      { id: "tb", name: "Terabit", symbol: "Tb", factor: 1e12 },
      { id: "tB", name: "Terabyte", symbol: "TB", factor: 8e12 },
      { id: "kib", name: "Kibibit", symbol: "Kib", factor: 1024 },
      { id: "kibB", name: "Kibibyte", symbol: "KiB", factor: 8192 },
      { id: "mibB", name: "Mebibyte", symbol: "MiB", factor: 8388608 },
      { id: "gibB", name: "Gibibyte", symbol: "GiB", factor: 8589934592 },
      { id: "tibB", name: "Tebibyte", symbol: "TiB", factor: 8796093022208 },
    ],
  },
  {
    id: "angle",
    label: "Angle",
    units: [
      { id: "deg", name: "Degree", symbol: "°", factor: Math.PI / 180 },
      { id: "rad", name: "Radian", symbol: "rad", factor: 1 },
      { id: "grad", name: "Gradian", symbol: "grad", factor: Math.PI / 200 },
      { id: "arcmin", name: "Arcminute", symbol: "'", factor: Math.PI / 10800 },
      { id: "arcsec", name: "Arcsecond", symbol: '"', factor: Math.PI / 648000 },
      { id: "turn", name: "Turn", symbol: "tr", factor: Math.PI * 2 },
    ],
  },
  {
    id: "energy",
    label: "Energy",
    units: [
      { id: "j", name: "Joule", symbol: "J", factor: 1 },
      { id: "kj", name: "Kilojoule", symbol: "kJ", factor: 1000 },
      { id: "cal", name: "Calorie", symbol: "cal", factor: 4.184 },
      { id: "kcal", name: "Kilocalorie", symbol: "kcal", factor: 4184 },
      { id: "wh", name: "Watt-hour", symbol: "Wh", factor: 3600 },
      { id: "kwh", name: "Kilowatt-hour", symbol: "kWh", factor: 3600000 },
      { id: "btu", name: "British thermal unit", symbol: "Btu", factor: 1055.05585262 },
      { id: "ev", name: "Electronvolt", symbol: "eV", factor: 1.602176634e-19 },
      { id: "erg", name: "Erg", symbol: "erg", factor: 1e-7 },
      { id: "ftlb", name: "Foot-pound", symbol: "ft·lb", factor: 1.3558179483314004 },
    ],
  },
  {
    id: "power",
    label: "Power",
    units: [
      { id: "w", name: "Watt", symbol: "W", factor: 1 },
      { id: "kw", name: "Kilowatt", symbol: "kW", factor: 1000 },
      { id: "mw", name: "Megawatt", symbol: "MW", factor: 1e6 },
      { id: "hp", name: "Horsepower (mech)", symbol: "hp", factor: 745.6998715822702 },
      { id: "hp_metric", name: "Horsepower (metric)", symbol: "PS", factor: 735.49875 },
      { id: "btuh", name: "Btu/hour", symbol: "Btu/h", factor: 0.2930710701722222 },
      { id: "dbm", name: "Decibel-milliwatt", symbol: "dBm", factor: 0.001 },
    ],
  },
  {
    id: "pressure",
    label: "Pressure",
    units: [
      { id: "pa", name: "Pascal", symbol: "Pa", factor: 1 },
      { id: "kpa", name: "Kilopascal", symbol: "kPa", factor: 1000 },
      { id: "bar", name: "Bar", symbol: "bar", factor: 100000 },
      { id: "mbar", name: "Millibar", symbol: "mbar", factor: 100 },
      { id: "atm", name: "Atmosphere", symbol: "atm", factor: 101325 },
      { id: "psi", name: "Pound/sq inch", symbol: "psi", factor: 6894.757293168 },
      { id: "mmhg", name: "Millimeter Hg", symbol: "mmHg", factor: 133.322387415 },
      { id: "torr", name: "Torr", symbol: "Torr", factor: 133.32236842105263 },
      { id: "inHg", name: "Inch Hg", symbol: "inHg", factor: 3386.389 },
    ],
  },
  {
    id: "frequency",
    label: "Frequency",
    units: [
      { id: "hz", name: "Hertz", symbol: "Hz", factor: 1 },
      { id: "khz", name: "Kilohertz", symbol: "kHz", factor: 1000 },
      { id: "mhz", name: "Megahertz", symbol: "MHz", factor: 1e6 },
      { id: "ghz", name: "Gigahertz", symbol: "GHz", factor: 1e9 },
      { id: "rpm", name: "Revolutions/min", symbol: "rpm", factor: 1 / 60 },
    ],
  },
];

export function toBase(category: UnitCategory, value: number, fromId: string): number {
  const unit = category.units.find((u) => u.id === fromId);
  if (!unit) throw new Error(`Unknown unit ${fromId}`);
  return (value + (unit.offset || 0)) * unit.factor;
}

export function fromBase(category: UnitCategory, baseValue: number, toId: string): number {
  const unit = category.units.find((u) => u.id === toId);
  if (!unit) throw new Error(`Unknown unit ${toId}`);
  return baseValue / unit.factor - (unit.offset || 0);
}

export function convertValue(category: UnitCategory, value: number, fromId: string, toId: string): number {
  return fromBase(category, toBase(category, value, fromId), toId);
}

export function formatUnitValue(v: number, maxDigits = 10): string {
  if (Number.isNaN(v)) return "NaN";
  if (v === Infinity) return "∞";
  if (v === -Infinity) return "-∞";
  if (Math.abs(v) !== 0 && (Math.abs(v) >= 1e12 || Math.abs(v) < 1e-9)) {
    return v.toExponential(6);
  }
  const s = parseFloat(v.toPrecision(maxDigits)).toString();
  return s;
}
