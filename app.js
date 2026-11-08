"use strict";

const STORE_KEY = "sivani.patients.v1";
const BACKUP_KEY = "sivani.lastBackup";
const $ = (id) => document.getElementById(id);

let patients = loadAll();
let currentId = null;
let saveTimer = null;

// ---------- Storage ----------

function loadAll() {
  try {
    return JSON.parse(localStorage.getItem(STORE_KEY)) || {};
  } catch (e) {
    return {};
  }
}

function persist() {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(patients));
    // Read back to be sure the data is really on the device.
    const back = JSON.parse(localStorage.getItem(STORE_KEY));
    if (currentId && JSON.stringify(back[currentId]) !== JSON.stringify(patients[currentId])) {
      throw new Error("verify failed");
    }
    setStatus("נשמר ✓", "ok");
    return true;
  } catch (e) {
    setStatus("לא נשמר! הורידי גיבוי עכשיו", "err");
    return false;
  }
}

function scheduleSave() {
  setStatus("שומר…", "");
  clearTimeout(saveTimer);
  saveTimer = setTimeout(flushSave, 300);
}

function flushSave() {
  clearTimeout(saveTimer);
  saveTimer = null;
  if (currentId) patients[currentId].updated = new Date().toISOString();
  persist();
}

function setStatus(text, kind) {
  const el = $("saveStatus");
  el.textContent = text;
  el.className = "save-status " + kind;
}

function newId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function emptyPatient() {
  const now = new Date().toISOString();
  return { id: newId(), created: now, updated: now, fields: {}, blood: [], bloodNotes: "" };
}

// Ask the browser not to clear our data when space is low.
if (navigator.storage && navigator.storage.persist) navigator.storage.persist();

// Save at once when she leaves the page or puts the phone away.
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden" && saveTimer) flushSave();
});
window.addEventListener("pagehide", () => { if (saveTimer) flushSave(); });

// ---------- List view ----------

function showList() {
  if (saveTimer) flushSave();
  currentId = null;
  $("listView").hidden = false;
  $("editView").hidden = true;
  $("backBtn").hidden = true;
  $("title").textContent = "תיקי מטופלות";
  setStatus("", "");
  renderList();
  window.scrollTo(0, 0);
}

function renderList() {
  const q = $("search").value.trim();
  const list = Object.values(patients)
    .filter((p) => !q || (p.fields.name || "").includes(q))
    .sort((a, b) => b.updated.localeCompare(a.updated));
  const ul = $("patientList");
  ul.replaceChildren();
  for (const p of list) {
    const li = document.createElement("li");
    const btn = document.createElement("button");
    btn.className = "patient";
    const name = document.createElement("strong");
    name.textContent = p.fields.name || "ללא שם";
    const meta = document.createElement("span");
    meta.className = "muted";
    const age = p.fields.age ? " · " + p.fields.age : "";
    meta.textContent = age + " · עודכן " + new Date(p.updated).toLocaleDateString("he-IL");
    btn.append(name, meta);
    btn.onclick = () => openPatient(p.id);
    li.append(btn);
    ul.append(li);
  }
  $("emptyMsg").hidden = Object.keys(patients).length > 0;
  renderBackupWarning();
}

function renderBackupWarning() {
  const count = Object.keys(patients).length;
  const last = localStorage.getItem(BACKUP_KEY);
  const days = last ? (Date.now() - new Date(last).getTime()) / 86400000 : Infinity;
  const warn = $("backupWarn");
  if (count > 0 && days > 7) {
    warn.textContent = last
      ? "הגיבוי האחרון לפני " + Math.floor(days) + " ימים. מומלץ להוריד גיבוי חדש."
      : "עדיין לא הורדת גיבוי. מומלץ להוריד גיבוי עכשיו.";
    warn.hidden = false;
  } else {
    warn.hidden = true;
  }
}

// ---------- Edit view ----------

function openPatient(id) {
  currentId = id;
  $("listView").hidden = true;
  $("editView").hidden = false;
  $("backBtn").hidden = false;
  $("hideName").checked = false;
  renderForm();
  updateTitle();
  setStatus("נשמר ✓", "ok");
  window.scrollTo(0, 0);
}

function updateTitle() {
  const p = patients[currentId];
  $("title").textContent = p.fields.name ? "תיק – " + p.fields.name : "תיק חדש";
}

function renderForm() {
  const p = patients[currentId];
  const form = $("form");
  form.replaceChildren();
  for (const sec of SCHEMA) {
    const box = document.createElement("fieldset");
    box.className = "section";
    const head = document.createElement("legend");
    head.textContent = sec.title;
    box.append(head);
    if (sec.type === "blood") {
      box.append(renderBlood(p));
    } else {
      const wrap = document.createElement("div");
      wrap.className = sec.type === "grid" ? "grid" : "stack";
      for (const [key, label, inputType] of sec.fields) {
        wrap.append(renderField(p, sec, key, label, inputType));
      }
      box.append(wrap);
    }
    form.append(box);
  }
  form.querySelectorAll("textarea").forEach(autoGrow);
}

function renderField(p, sec, key, label, inputType) {
  const fullKey = sec.id + "." + key;
  const lab = document.createElement("label");
  lab.className = "field";
  const span = document.createElement("span");
  span.textContent = label;
  let input;
  if (sec.type === "grid") {
    input = document.createElement("input");
    input.type = inputType || "text";
  } else {
    input = document.createElement("textarea");
    input.rows = 2;
  }
  input.value = p.fields[fullKey] || "";
  input.addEventListener("input", () => {
    p.fields[fullKey] = input.value;
    if (fullKey === "general.name") {
      p.fields.name = input.value;
      updateTitle();
    }
    if (fullKey === "general.age") p.fields.age = input.value;
    if (input.tagName === "TEXTAREA") autoGrow(input);
    scheduleSave();
  });
  lab.append(span, input);
  return lab;
}

function autoGrow(t) {
  t.style.height = "auto";
  t.style.height = t.scrollHeight + 2 + "px";
}

// ---------- Blood tests ----------

function bloodFlag(row) {
  const v = parseFloat(String(row.result).replace(",", "."));
  const lo = parseFloat(String(row.low).replace(",", "."));
  const hi = parseFloat(String(row.high).replace(",", "."));
  if (isNaN(v)) return "";
  if (!isNaN(lo) && v < lo) return "low";
  if (!isNaN(hi) && v > hi) return "high";
  return "";
}

function renderBlood(p) {
  const wrap = document.createElement("div");
  wrap.className = "blood";

  const dateLab = document.createElement("label");
  dateLab.className = "field";
  const dateSpan = document.createElement("span");
  dateSpan.textContent = "תאריך הבדיקות";
  const dateIn = document.createElement("input");
  dateIn.type = "date";
  dateIn.value = p.fields["blood.date"] || "";
  dateIn.addEventListener("input", () => { p.fields["blood.date"] = dateIn.value; scheduleSave(); });
  dateLab.append(dateSpan, dateIn);
  wrap.append(dateLab);

  const legend = document.createElement("p");
  legend.className = "muted small";
  legend.textContent = "כתבי תוצאה וטווח תקין. ערך מעל הטווח מסומן באדום, ערך מתחת לטווח מסומן בכחול.";
  wrap.append(legend);

  const rows = document.createElement("div");
  rows.className = "blood-rows";
  p.blood.forEach((row, i) => rows.append(renderBloodRow(p, row, i)));
  wrap.append(rows);

  const btns = document.createElement("div");
  btns.className = "row";
  const add = document.createElement("button");
  add.type = "button";
  add.className = "btn";
  add.textContent = "+ שורה";
  add.onclick = () => {
    p.blood.push({ name: "", result: "", unit: "", low: "", high: "" });
    scheduleSave();
    renderForm();
    const inputs = $("form").querySelectorAll(".blood-row:last-child input");
    if (inputs[0]) inputs[0].focus();
  };
  const common = document.createElement("button");
  common.type = "button";
  common.className = "btn";
  common.textContent = "הוספת בדיקות נפוצות";
  common.onclick = () => {
    const have = new Set(p.blood.map((r) => r.name));
    for (const [name, unit] of COMMON_BLOOD_TESTS) {
      if (!have.has(name)) p.blood.push({ name, result: "", unit, low: "", high: "" });
    }
    scheduleSave();
    renderForm();
  };
  btns.append(add, common);
  wrap.append(btns);

  const notesLab = document.createElement("label");
  notesLab.className = "field";
  const notesSpan = document.createElement("span");
  notesSpan.textContent = "הערות לבדיקות";
  const notes = document.createElement("textarea");
  notes.rows = 2;
  notes.value = p.bloodNotes || "";
  notes.addEventListener("input", () => { p.bloodNotes = notes.value; autoGrow(notes); scheduleSave(); });
  notesLab.append(notesSpan, notes);
  wrap.append(notesLab);
  return wrap;
}

function renderBloodRow(p, row, i) {
  const div = document.createElement("div");
  div.className = "blood-row " + bloodFlag(row);
  const cells = [
    ["name", "בדיקה", "name"],
    ["result", "תוצאה", "num"],
    ["unit", "יחידה", "unit"],
    ["low", "מ-", "num"],
    ["high", "עד", "num"],
  ];
  for (const [key, ph, cls] of cells) {
    const input = document.createElement("input");
    input.className = cls;
    input.placeholder = ph;
    input.setAttribute("aria-label", ph);
    input.value = row[key] || "";
    if (cls === "num") input.inputMode = "decimal";
    input.addEventListener("input", () => {
      row[key] = input.value;
      div.className = "blood-row " + bloodFlag(row);
      scheduleSave();
    });
    div.append(input);
  }
  const del = document.createElement("button");
  del.type = "button";
  del.className = "icon-btn del";
  del.textContent = "×";
  del.setAttribute("aria-label", "מחיקת שורה");
  del.onclick = () => { p.blood.splice(i, 1); scheduleSave(); renderForm(); };
  div.append(del);
  return div;
}

// ---------- PDF ----------

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}

function formatDate(v) {
  if (!v) return "";
  const d = new Date(v);
  return isNaN(d) ? v : d.toLocaleDateString("he-IL");
}

function buildPdfDoc(p, hideName) {
  const doc = el("div", "pdf-doc");
  const name = hideName ? "" : (p.fields.name || "");
  doc.append(el("h1", "pdf-title", name ? "תיק מטופלת – " + name : "תיק מטופלת"));

  for (const sec of SCHEMA) {
    if (sec.type === "blood") {
      const filled = p.blood.filter((r) => r.name && String(r.result).trim() !== "");
      if (!filled.length && !p.bloodNotes) continue;
      const s = el("section", "pdf-sec");
      s.append(el("h2", "pdf-sec-head", sec.title));
      if (p.fields["blood.date"]) s.append(el("p", "pdf-small", "תאריך הבדיקות: " + formatDate(p.fields["blood.date"])));
      if (filled.length) {
        const table = el("table", "pdf-table");
        const tr0 = el("tr");
        ["בדיקה", "תוצאה", "טווח תקין"].forEach((h) => tr0.append(el("th", null, h)));
        table.append(tr0);
        for (const r of filled) {
          const tr = el("tr", bloodFlag(r));
          tr.append(el("td", "ltr", r.name));
          const res = el("td", "ltr");
          res.append(el("b", null, r.result + " "), document.createTextNode(r.unit || ""));
          tr.append(res);
          const range = r.low || r.high ? (r.low || "") + " – " + (r.high || "") : "";
          tr.append(el("td", "ltr", range));
          table.append(tr);
        }
        s.append(table);
        s.append(el("p", "pdf-small", "אדום: מעל הטווח. כחול: מתחת לטווח."));
      }
      if (p.bloodNotes) {
        s.append(el("h3", "pdf-label", "הערות"));
        s.append(el("p", "pdf-text", p.bloodNotes));
      }
      doc.append(s);
      continue;
    }

    const items = sec.fields
      .filter(([key]) => !(hideName && sec.id === "general" && (key === "name" || key === "phone")))
      .map(([key, label, type]) => {
        const v = (p.fields[sec.id + "." + key] || "").trim();
        return [label, type === "date" ? formatDate(v) : v];
      })
      .filter(([, v]) => v);
    if (!items.length) continue;

    const s = el("section", "pdf-sec");
    s.append(el("h2", "pdf-sec-head", sec.title));
    if (sec.type === "grid") {
      const g = el("div", "pdf-grid");
      for (const [label, v] of items) {
        const f = el("div", "pdf-field");
        f.append(el("div", "pdf-small", label), el("div", "pdf-text", v));
        g.append(f);
      }
      s.append(g);
    } else {
      for (const [label, v] of items) {
        const f = el("div", "pdf-field");
        f.append(el("h3", "pdf-label", label), el("p", "pdf-text", v));
        s.append(f);
      }
    }
    doc.append(s);
  }
  return doc;
}

async function downloadPdf() {
  if (saveTimer) flushSave();
  const p = patients[currentId];
  const hideName = $("hideName").checked;
  const host = $("pdfHost");
  host.replaceChildren(buildPdfDoc(p, hideName));
  const who = hideName ? "מטופלת" : (p.fields.name || "מטופלת");
  const filename = "תיק-" + who.replace(/[\\/:*?"<>|]/g, "") + "-" + new Date().toISOString().slice(0, 10) + ".pdf";
  const btn = $("pdfBtn");
  btn.disabled = true;
  btn.textContent = "מכינה PDF…";
  try {
    const blob = await html2pdf()
      .set({
        margin: [12, 10, 12, 10],
        image: { type: "jpeg", quality: 0.95 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
        pagebreak: { mode: ["css"], avoid: [".pdf-field", "tr", ".pdf-sec-head", ".pdf-title"] },
      })
      .from(host.firstChild)
      .outputPdf("blob");
    const file = new File([blob], filename, { type: "application/pdf" });
    // On a phone, the share sheet lets her save to Files or send in WhatsApp.
    if (navigator.canShare && navigator.canShare({ files: [file] }) && matchMedia("(pointer: coarse)").matches) {
      try { await navigator.share({ files: [file], title: filename }); }
      catch (e) { if (e.name !== "AbortError") saveBlob(blob, filename); }
    } else {
      saveBlob(blob, filename);
    }
  } catch (e) {
    alert("לא הצלחתי ליצור PDF. נסי שוב.");
  } finally {
    host.replaceChildren();
    btn.disabled = false;
    btn.textContent = "הורדת PDF";
  }
}

function saveBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

// ---------- Backup ----------

function exportBackup() {
  const data = JSON.stringify({ app: "sivani", version: 1, exported: new Date().toISOString(), patients }, null, 2);
  saveBlob(new Blob([data], { type: "application/json" }), "גיבוי-תיקים-" + new Date().toISOString().slice(0, 10) + ".json");
  localStorage.setItem(BACKUP_KEY, new Date().toISOString());
  renderBackupWarning();
}

function importBackup(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      if (data.app !== "sivani" || typeof data.patients !== "object") throw new Error("bad file");
      let added = 0, updated = 0;
      for (const p of Object.values(data.patients)) {
        if (!p || !p.id) continue;
        const mine = patients[p.id];
        if (!mine) { patients[p.id] = p; added++; }
        else if (p.updated > mine.updated) { patients[p.id] = p; updated++; }
      }
      persist();
      setStatus("", "");
      renderList();
      alert("הגיבוי נטען. נוספו " + added + " תיקים, עודכנו " + updated + ".");
    } catch (e) {
      alert("הקובץ הזה הוא לא גיבוי של תיקי מטופלות.");
    }
  };
  reader.readAsText(file);
}

// ---------- Wiring ----------

$("newBtn").onclick = () => {
  const p = emptyPatient();
  p.fields["general.intakeDate"] = new Date().toISOString().slice(0, 10);
  patients[p.id] = p;
  currentId = p.id;
  persist();
  openPatient(p.id);
};
$("backBtn").onclick = showList;
$("search").oninput = renderList;
$("pdfBtn").onclick = downloadPdf;
$("deleteBtn").onclick = () => {
  const p = patients[currentId];
  const name = p.fields.name || "ללא שם";
  if (!confirm("למחוק את התיק של " + name + "? אי אפשר לבטל את זה.")) return;
  delete patients[currentId];
  currentId = null;
  persist();
  showList();
};
$("exportBtn").onclick = exportBackup;
$("importInput").onchange = (e) => {
  if (e.target.files[0]) importBackup(e.target.files[0]);
  e.target.value = "";
};

if ("serviceWorker" in navigator && location.protocol !== "file:") {
  navigator.serviceWorker.register("sw.js");
}

showList();
