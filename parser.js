// Reads blood test values from the text of a lab form.
// It keeps only: test name, result, unit and range. It never keeps names, ID numbers or dates.
"use strict";

// [name, unit, aliases]. Longer aliases are tried first, so "hemoglobin a1c" wins over "hemoglobin".
const LAB_TESTS = [
  ["Glucose", "mg/dl", ["glucose fasting", "glucose", "glu"]],
  ["HbA1c", "%", ["hemoglobin a1c", "hba1c", "a1c"]],
  ["Creatinine", "mg/dl", ["creatinine", "creat"]],
  ["eGFR", "ml/min/1.73m²", ["egfr", "gfr"]],
  ["Urea", "mg/dl", ["urea", "bun"]],
  ["Uric Acid", "mg/dl", ["uric acid"]],
  ["Potassium (K+)", "mmol/l", ["potassium"]],
  ["Sodium (Na)", "mmol/l", ["sodium"]],
  ["Calcium", "mg/dl", ["calcium"]],
  ["Magnesium", "mg/dl", ["magnesium"]],
  ["Phosphorus", "mg/dl", ["phosphorus", "phosphate"]],
  ["Albumin", "g/dl", ["albumin"]],
  ["Bilirubin Direct", "mg/dl", ["bilirubin direct", "direct bilirubin"]],
  ["Bilirubin Total", "mg/dl", ["bilirubin total", "total bilirubin", "bilirubin"]],
  ["ALP", "U/l", ["alkaline phosphatase", "alp"]],
  ["ALT", "U/l", ["alt (gpt)", "alt", "gpt"]],
  ["AST", "U/l", ["ast (got)", "ast", "got"]],
  ["GGT", "U/l", ["ggt"]],
  ["CRP", "mg/l", ["c-reactive protein", "crp"]],
  ["WBC", "10*3/µl", ["wbc", "white blood cells"]],
  ["RBC", "10*6/µl", ["rbc", "red blood cells"]],
  ["Hemoglobin", "g/dl", ["hemoglobin", "haemoglobin", "hgb", "hb"]],
  ["Hematocrit", "%", ["hematocrit", "hct"]],
  ["MCV", "fl", ["mcv"]],
  ["MCHC", "g/dl", ["mchc"]],
  ["MCH", "pg/cell", ["mch"]],
  ["RDW", "%", ["rdw-cv", "rdw"]],
  ["Platelets", "10*3/µl", ["platelets", "plt"]],
  ["MPV", "fl", ["mpv"]],
  ["Neutrophils", "", ["neutrophils", "neut"]],
  ["Lymphocytes", "", ["lymphocytes", "lymph"]],
  ["Monocytes", "", ["monocytes", "mono"]],
  ["Eosinophils", "", ["eosinophils", "eos"]],
  ["Basophils", "", ["basophils", "baso"]],
  ["PT", "sec", ["pt"]],
  ["INR", "", ["inr"]],
  ["PTT", "sec", ["aptt", "ptt"]],
  ["Ferritin", "ng/ml", ["ferritin"]],
  ["TIBC", "µg/dl", ["tibc", "iron binding capacity"]],
  ["Transferrin", "mg/dl", ["transferrin"]],
  ["Iron", "µg/dl", ["iron", "fe"]],
  ["Vitamin B12", "pg/ml", ["vitamin b12", "vit b12", "vit. b12", "b12", "cobalamin"]],
  ["Folic Acid", "ng/ml", ["folic acid", "folate"]],
  ["Vitamin D", "ng/ml", ["vitamin d", "vit d", "vit. d", "25-oh", "25(oh)"]],
  ["TSH", "mIU/l", ["tsh"]],
  ["Free T4", "pmol/l", ["free t4", "t4 free", "ft4"]],
  ["Free T3", "pmol/l", ["free t3", "t3 free", "ft3"]],
  ["LH", "IU/L", ["lh"]],
  ["FSH", "IU/L", ["fsh"]],
  ["Estradiol E2", "pmol/L", ["estradiol", "e2"]],
  ["Progesterone", "nmol/L", ["progesterone"]],
  ["Testosterone Total", "nmol/L", ["testosterone total", "total testosterone", "testosterone"]],
  ["DHEA-S", "µmol/L", ["dhea-s", "dheas", "dhea sulfate", "dhea-so4"]],
  ["Prolactin", "mIU/L", ["prolactin"]],
  ["AMH", "ng/ml", ["anti mullerian hormone", "amh"]],
  ["Cortisol", "nmol/l", ["cortisol"]],
  ["Insulin", "µIU/ml", ["insulin"]],
  ["Cholesterol Total", "mg/dl", ["cholesterol total", "total cholesterol", "cholesterol"]],
  ["HDL", "mg/dl", ["hdl cholesterol", "hdl"]],
  ["LDL", "mg/dl", ["ldl cholesterol", "ldl"]],
  ["Triglycerides", "mg/dl", ["triglycerides", "tg"]],
];

const DIFF_TESTS = new Set(["Neutrophils", "Lymphocytes", "Monocytes", "Eosinophils", "Basophils"]);

function escapeRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }

const ALIASES = LAB_TESTS
  .flatMap(([name, unit, aliases]) => aliases.map((a) => ({ name, unit, re: new RegExp("(?<![A-Za-z])" + escapeRe(a) + "(?![A-Za-z])", "i"), len: a.length })))
  .sort((a, b) => b.len - a.len);

const NUM = "\\d+(?:[.,]\\d+)?";
const UNIT_RE = new RegExp(
  "(?<![A-Za-z])(" + [
    // OCR often reads the last "l" as "I", "|" or "1".
    "10\\s*[*^xX×]\\s*\\d+\\s*\\/\\s*(?:[µuμ]|mic|mc)?[lLI|]",
    "ml\\/min(?:\\/1[.,]73\\s*m(?:²|2)?)?",
    "[µuμnpm]?mol\\/[lLI|1]",
    "mEq\\/[lLI|1]",
    "[mµuμ]?I?U\\/m?[lLI|1]",
    "[mnpµuμ]?g\\/[dm]?[lLI|1]",
    "pg\\/cell",
    "k\\/[µuμ]l",
    "pg", "fl", "sec", "%",
  ].join("|") + ")(?![A-Za-z])",
  "i"
);
// "70 - 100", or a dotted line as in Maccabi forms: "70 ······*·· 100".
const RANGE_RE = new RegExp("(" + NUM + ")\\s*(?:[-–—]|[\\s.·•…*:_]{3,})\\s*(" + NUM + ")");
const BLOCKED_NAME = /^(page|date|tel|phone|fax|id|dr|lab|mr|mrs|ms|ref|reference|range|result|results|unit|units|test|name|age|sex|time|sample|collected|printed|report)\b/i;

function toNum(s) { return s.replace(",", "."); }

// Remove things that can identify a person or confuse the parser: dates, times, long numbers.
function cleanLine(line) {
  return line
    .replace(/[‎‏‪-‮]/g, "")
    .replace(/\d{1,2}[./]\d{1,2}[./]\d{2,4}/g, " ")
    .replace(/\d{1,2}:\d{2}(:\d{2})?/g, " ")
    .replace(/\d{6,}/g, " ")
    // OCR reads a dotted range line ("70 ·····*·· 100") as letters, e.g. "70 eeeeeen teen 100".
    .replace(/(\d)\s*((?:[A-Za-z.,:;'`*|\[\]()™_~]{2,}\s*){1,3})(?=\d)/g, (m, d, junk) =>
      /^[A-Za-z]{1,3}\s*$/.test(junk) ? m : d + " ····· ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseValues(rest) {
  let unit = "";
  let result = "";
  const u = rest.match(UNIT_RE);
  if (u) {
    unit = u[1];
    // The result is the number just before the unit, if that number is not the end of a range.
    const head = rest.slice(0, u.index);
    const before = head.match(new RegExp("([<>]?\\s*" + NUM + ")\\s*$"));
    const rangeEnd = new RegExp(NUM + "\\s*[-–—]\\s*" + NUM + "\\s*$").test(head);
    if (before && !rangeEnd) {
      result = before[1];
      rest = head.slice(0, before.index) + " " + rest.slice(u.index + u[0].length);
    } else {
      rest = head + " " + rest.slice(u.index + u[0].length);
    }
  }
  let low = "", high = "";
  const r = rest.match(RANGE_RE);
  if (r) {
    low = toNum(r[1]);
    high = toNum(r[2]);
    rest = rest.slice(0, r.index) + " " + rest.slice(r.index + r[0].length);
  }
  const nums = rest.match(new RegExp("[<>]?\\s*" + NUM, "g")) || [];
  if (!result && nums.length) {
    // "<0.5" style values are results only if a range already exists.
    const plain = nums.find((n) => !/[<>]/.test(n)) || (low || high ? nums[0] : "");
    if (plain) { result = plain; nums.splice(nums.indexOf(plain), 1); }
  }
  // Two numbers left and no range found: they are the range ("3 13 6.1%").
  const plainLeft = nums.filter((n) => !/[<>]/.test(n)).map((n) => toNum(n.trim()));
  if (!low && !high && plainLeft.length === 2 && parseFloat(plainLeft[0]) < parseFloat(plainLeft[1])) {
    [low, high] = plainLeft;
  }
  if (!low && !high) {
    for (const n of nums) {
      const m = n.match(/([<>])\s*(.+)/);
      if (m && m[1] === "<") high = toNum(m[2]);
      if (m && m[1] === ">") low = toNum(m[2]);
    }
  }
  result = toNum(result.replace(/\s+/g, ""));
  return { result, unit, low, high, rest };
}

// lines: array of text lines from the form. Returns rows with no personal data.
function parseLabLines(lines) {
  const rows = [];
  const seen = new Set();
  for (const raw of lines) {
    const line = cleanLine(raw);
    if (!line || !/\d/.test(line)) continue;
    // The test name that starts first wins, so "MCH-Mean Cell Hemoglobin" is MCH.
    // On the same place, the longer name wins ("Hemoglobin A1c" over "Hemoglobin").
    let name = null, defUnit = "", rest = line, best = null;
    for (const a of ALIASES) {
      const m = line.match(a.re);
      if (m && (!best || m.index < best.m.index)) best = { a, m };
    }
    if (best) {
      name = best.a.name;
      defUnit = best.a.unit;
      rest = line.slice(0, best.m.index) + " " + line.slice(best.m.index + best.m[0].length);
    }
    const v = parseValues(rest);
    if (!v.result) continue;
    if (name && DIFF_TESTS.has(name)) {
      const pct = v.unit === "%" || (!v.unit && /%/.test(line));
      name = name + (pct ? " %" : " #");
      if (!v.unit && pct) v.unit = "%";
    }
    if (!name) {
      // Unknown test: accept it only when it has a range and a Latin name.
      if ((!v.low && !v.high) || !v.unit) continue;
      const words = v.rest.replace(/[<>]?\s*\d+(?:[.,]\d+)?/g, " ").match(/[A-Za-z][A-Za-z0-9 ()+\-./#%]*[A-Za-z0-9)%]/);
      if (!words) continue;
      name = words[0].trim();
      if (name.length < 2 || name.length > 40 || BLOCKED_NAME.test(name)) continue;
    }
    if (seen.has(name)) continue;
    seen.add(name);
    rows.push({ name, result: v.result, unit: v.unit || defUnit, low: v.low, high: v.high });
  }
  return rows;
}

if (typeof module !== "undefined") module.exports = { parseLabLines, LAB_TESTS };
