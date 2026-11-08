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
    } else if (sec.type === "images") {
      box.append(renderImages(p));
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

  const upload = document.createElement("label");
  upload.className = "btn primary";
  upload.textContent = "העלאת טופס בדיקות (PDF או צילום)";
  const fileIn = document.createElement("input");
  fileIn.type = "file";
  fileIn.accept = "application/pdf,.pdf,image/*";
  fileIn.hidden = true;
  const uploadStatus = document.createElement("p");
  uploadStatus.className = "muted small";
  uploadStatus.textContent = "הטופס נקרא במכשיר בלבד ולא נשמר. נשמרים רק הערכים, בלי שם, ת״ז או תאריך לידה.";
  fileIn.onchange = () => {
    const f = fileIn.files[0];
    fileIn.value = "";
    if (f) uploadLabForm(p, f, uploadStatus);
  };
  upload.append(fileIn);
  wrap.append(upload, uploadStatus);

  wrap.append(renderAbnormal(p));

  const legend = document.createElement("p");
  legend.className = "muted small";
  legend.textContent = "כל הערכים. אפשר לתקן כל ערך. ערך מעל הטווח מסומן באדום, ערך מתחת לטווח מסומן בכחול.";
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
      refreshAbnormal(p);
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

// ---------- Abnormal values ----------

function abnormalRows(p) {
  return p.blood.filter((r) => r.name && bloodFlag(r));
}

function renderAbnormal(p) {
  const box = document.createElement("div");
  box.id = "abnormalBox";
  fillAbnormal(box, p);
  return box;
}

function refreshAbnormal(p) {
  const box = $("abnormalBox");
  if (box) fillAbnormal(box, p);
}

function fillAbnormal(box, p) {
  const list = abnormalRows(p);
  box.replaceChildren();
  box.className = "abnormal";
  box.hidden = p.blood.every((r) => String(r.result).trim() === "");
  const h = document.createElement("h3");
  h.textContent = list.length ? "ערכים חריגים (" + list.length + ")" : "אין ערכים חריגים";
  box.append(h);
  for (const r of list) {
    const flag = bloodFlag(r);
    const line = document.createElement("div");
    line.className = "abn-line " + flag;
    const arrow = document.createElement("span");
    arrow.className = "arrow";
    arrow.textContent = flag === "high" ? "↑ גבוה" : "↓ נמוך";
    const txt = document.createElement("span");
    txt.className = "ltr";
    const range = r.low || r.high ? "  (" + (r.low || "") + " – " + (r.high || "") + ")" : "";
    txt.textContent = r.name + ": " + r.result + " " + (r.unit || "") + range;
    line.append(arrow, txt);
    box.append(line);
  }
}

// ---------- Lab form upload ----------

async function uploadLabForm(p, file, statusEl) {
  const say = (t) => { statusEl.textContent = t; };
  try {
    const lines = await readLabFile(file, say);
    const found = parseLabLines(lines);
    if (!found.length) {
      say("לא מצאתי ערכים בטופס. אפשר להקליד אותם בטבלה.");
      return;
    }
    say("נמצאו " + found.length + " ערכים. בדקי ואשרי.");
    const chosen = await reviewFound(found);
    if (!chosen) { say("בוטל. שום דבר לא נוסף."); return; }
    let added = 0, updated = 0;
    for (const f of chosen) {
      const mine = p.blood.find((r) => r.name.toLowerCase() === f.name.toLowerCase());
      if (mine) {
        Object.assign(mine, { result: f.result, unit: f.unit || mine.unit, low: f.low || mine.low, high: f.high || mine.high });
        updated++;
      } else {
        p.blood.push(f);
        added++;
      }
    }
    flushSave();
    renderForm();
    const box = $("abnormalBox");
    if (box) box.scrollIntoView({ behavior: "smooth", block: "start" });
    setStatus("נוספו " + added + ", עודכנו " + updated + " ✓", "ok");
  } catch (e) {
    say("לא הצלחתי לקרוא את הקובץ. אפשר להקליד את הערכים בטבלה.");
  }
}

// Shows the found values. She removes rows that do not belong. Returns the chosen rows or null.
function reviewFound(found) {
  return new Promise((resolve) => {
    const dlg = $("reviewDialog");
    const list = $("reviewRows");
    list.replaceChildren();
    const head = document.createElement("div");
    head.className = "review-row review-head";
    for (const t of ["", "בדיקה", "תוצאה", "מ-", "עד"]) {
      const s = document.createElement("span");
      s.textContent = t;
      s.className = t === "" ? "rv-check" : t === "בדיקה" ? "rv-name" : "rv-num";
      head.append(s);
    }
    list.append(head);
    const checks = found.map((f) => {
      const row = document.createElement("div");
      row.className = "review-row " + bloodFlag(f);
      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.checked = true;
      cb.setAttribute("aria-label", "להוסיף את " + f.name);
      const name = document.createElement("span");
      name.className = "ltr rv-name";
      name.textContent = f.name + (f.unit ? " (" + f.unit + ")" : "");
      row.append(cb, name);
      for (const [key, ph] of [["result", "תוצאה"], ["low", "מ-"], ["high", "עד"]]) {
        const input = document.createElement("input");
        input.className = "rv-num";
        input.inputMode = "decimal";
        input.placeholder = ph;
        input.setAttribute("aria-label", ph);
        input.value = f[key] || "";
        input.addEventListener("input", () => {
          f[key] = input.value;
          row.className = "review-row " + bloodFlag(f);
        });
        row.append(input);
      }
      list.append(row);
      return cb;
    });
    dlg.hidden = false;
    const done = (ok) => {
      dlg.hidden = true;
      $("reviewOk").onclick = $("reviewCancel").onclick = null;
      resolve(ok ? found.filter((_, i) => checks[i].checked) : null);
    };
    $("reviewOk").onclick = () => done(true);
    $("reviewCancel").onclick = () => done(false);
  });
}

// ---------- Images ----------

function renderImages(p) {
  const wrap = document.createElement("div");
  wrap.className = "images";
  const add = document.createElement("label");
  add.className = "btn";
  add.textContent = "+ הוספת תמונות";
  const fileIn = document.createElement("input");
  fileIn.type = "file";
  fileIn.accept = "image/*";
  fileIn.multiple = true;
  fileIn.hidden = true;
  add.append(fileIn);
  const grid = document.createElement("div");
  grid.className = "image-grid";
  wrap.append(add, grid);

  const patientId = p.id;
  const draw = async () => {
    const list = await getImages(patientId);
    if (currentId !== patientId) return;
    grid.replaceChildren();
    for (const img of list) grid.append(renderImageCard(img, draw));
  };
  fileIn.onchange = async () => {
    const files = [...fileIn.files];
    fileIn.value = "";
    setStatus("שומר תמונות…", "");
    try {
      for (const f of files) {
        const data = await resizeImage(f);
        await putImage({ id: newId(), patientId, data, caption: "", created: new Date().toISOString() });
      }
      p.updated = new Date().toISOString();
      persist();
      await draw();
    } catch (e) {
      setStatus("תמונה לא נשמרה! נסי שוב", "err");
    }
  };
  draw();
  return wrap;
}

function renderImageCard(img, redraw) {
  const card = document.createElement("div");
  card.className = "image-card";
  const pic = document.createElement("img");
  pic.src = img.data;
  pic.alt = img.caption || "תמונה";
  const cap = document.createElement("input");
  cap.placeholder = "תיאור (לא חובה)";
  cap.value = img.caption || "";
  let t = null;
  cap.addEventListener("input", () => {
    setStatus("שומר…", "");
    clearTimeout(t);
    t = setTimeout(() => {
      img.caption = cap.value;
      putImage(img).then(() => setStatus("נשמר ✓", "ok"), () => setStatus("לא נשמר!", "err"));
    }, 300);
  });
  const del = document.createElement("button");
  del.type = "button";
  del.className = "btn danger small-btn";
  del.textContent = "מחיקה";
  del.onclick = async () => {
    if (!confirm("למחוק את התמונה?")) return;
    await deleteImage(img.id);
    redraw();
  };
  card.append(pic, cap, del);
  return card;
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

function pdfBloodTable(rows) {
  const table = el("table", "pdf-table");
  const tr0 = el("tr");
  ["בדיקה", "תוצאה", "טווח תקין"].forEach((h) => tr0.append(el("th", null, h)));
  table.append(tr0);
  for (const r of rows) {
    const tr = el("tr", bloodFlag(r));
    tr.append(el("td", "ltr", r.name));
    const res = el("td", "ltr");
    res.append(el("b", null, r.result + " "), document.createTextNode(r.unit || ""));
    tr.append(res);
    const range = r.low || r.high ? (r.low || "") + " – " + (r.high || "") : "";
    tr.append(el("td", "ltr", range));
    table.append(tr);
  }
  return table;
}

function buildPdfDoc(p, hideName, images) {
  const doc = el("div", "pdf-doc");
  const name = hideName ? "" : (p.fields.name || "");
  doc.append(el("h1", "pdf-title", name ? "תיק מטופלת – " + name : "תיק מטופלת"));

  for (const sec of SCHEMA) {
    if (sec.type === "images") {
      if (!images.length) continue;
      const s = el("section", "pdf-sec");
      s.append(el("h2", "pdf-sec-head", sec.title));
      for (const img of images) {
        const f = el("figure", "pdf-figure");
        const pic = el("img");
        pic.src = img.data;
        f.append(pic);
        if (img.caption) f.append(el("figcaption", "pdf-small", img.caption));
        s.append(f);
      }
      doc.append(s);
      continue;
    }
    if (sec.type === "blood") {
      const filled = p.blood.filter((r) => r.name && String(r.result).trim() !== "");
      if (!filled.length && !p.bloodNotes) continue;
      const s = el("section", "pdf-sec");
      s.append(el("h2", "pdf-sec-head", sec.title));
      if (p.fields["blood.date"]) s.append(el("p", "pdf-small", "תאריך הבדיקות: " + formatDate(p.fields["blood.date"])));
      if (filled.length) {
        const abn = abnormalRows(p).filter((r) => String(r.result).trim() !== "");
        s.append(el("h3", "pdf-label", abn.length ? "ערכים חריגים (" + abn.length + ")" : "אין ערכים חריגים"));
        if (abn.length) s.append(pdfBloodTable(abn));
        s.append(el("h3", "pdf-label", "כל הערכים"));
        s.append(pdfBloodTable(filled));
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
  host.replaceChildren(buildPdfDoc(p, hideName, await getImages(p.id)));
  await Promise.all([...host.querySelectorAll("img")].map((i) => i.decode().catch(() => {})));
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
        pagebreak: { mode: ["css"], avoid: [".pdf-field", "tr", ".pdf-sec-head", ".pdf-title", ".pdf-figure", ".pdf-label"] },
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

async function exportBackup() {
  const images = await getAllImages();
  const data = JSON.stringify({ app: "sivani", version: 2, exported: new Date().toISOString(), patients, images });
  saveBlob(new Blob([data], { type: "application/json" }), "גיבוי-תיקים-" + new Date().toISOString().slice(0, 10) + ".json");
  localStorage.setItem(BACKUP_KEY, new Date().toISOString());
  renderBackupWarning();
}

function importBackup(file) {
  const reader = new FileReader();
  reader.onload = async () => {
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
      let pics = 0;
      for (const img of data.images || []) {
        if (img && img.id && img.patientId && img.data) { await putImage(img); pics++; }
      }
      setStatus("", "");
      renderList();
      alert("הגיבוי נטען. נוספו " + added + " תיקים, עודכנו " + updated + ", נטענו " + pics + " תמונות.");
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
  deleteImagesOf(currentId);
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
