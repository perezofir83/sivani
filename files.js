// Images storage (IndexedDB) and reading lab forms (PDF or photo).
// Everything runs on the device. No file is sent to a server.
"use strict";

// ---------- Images in IndexedDB ----------

let dbPromise = null;

function openDb() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open("sivani", 1);
      req.onupgradeneeded = () => {
        const store = req.result.createObjectStore("images", { keyPath: "id" });
        store.createIndex("patientId", "patientId");
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  return dbPromise;
}

async function dbRun(mode, fn) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("images", mode);
    const out = fn(tx.objectStore("images"));
    tx.oncomplete = () => resolve(out && "result" in out ? out.result : undefined);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

function getImages(patientId) {
  return dbRun("readonly", (s) => s.index("patientId").getAll(patientId))
    .then((list) => list.sort((a, b) => a.created.localeCompare(b.created)));
}
function getAllImages() { return dbRun("readonly", (s) => s.getAll()); }
function putImage(img) { return dbRun("readwrite", (s) => s.put(img)); }
function deleteImage(id) { return dbRun("readwrite", (s) => s.delete(id)); }
async function deleteImagesOf(patientId) {
  const list = await getImages(patientId);
  await dbRun("readwrite", (s) => list.forEach((img) => s.delete(img.id)));
}

// Make the photo smaller so many photos fit on the device.
function resizeImage(file, maxSide = 1600, quality = 0.82) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
      const c = document.createElement("canvas");
      c.width = Math.round(img.width * scale);
      c.height = Math.round(img.height * scale);
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL("image/jpeg", quality));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("bad image")); };
    img.src = url;
  });
}

// ---------- Reading a lab form ----------

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = src;
    s.onload = resolve;
    s.onerror = () => reject(new Error("load failed: " + src));
    document.head.append(s);
  });
}

async function loadPdfJs() {
  if (!window.pdfjsLib) {
    await loadScript("vendor/pdf.min.js");
    window.pdfjsLib.GlobalWorkerOptions.workerSrc = "vendor/pdf.worker.min.js";
  }
  return window.pdfjsLib;
}

// Text recognition (OCR) for photos and scanned forms. The program downloads once;
// the photo itself stays on the device.
let ocrWorker = null;
async function ocr(image, onStatus) {
  if (!window.Tesseract) {
    onStatus("טוענת זיהוי טקסט (פעם ראשונה, צריך אינטרנט)…");
    await loadScript("https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js");
  }
  if (!ocrWorker) ocrWorker = await window.Tesseract.createWorker("eng");
  const { data } = await ocrWorker.recognize(await prepareForOcr(image));
  // OCR often drops the point in "0.5". A number never starts with 0 and another digit.
  return data.text.split("\n").map((l) => l.replace(/(^|[^\d.,])0(\d)/g, "$10.$2"));
}

// Make the picture bigger and gray. OCR reads small digits and points better this way.
async function prepareForOcr(image) {
  const bmp = image instanceof HTMLCanvasElement ? image : await createImageBitmap(image);
  const scale = Math.min(3, Math.max(1, 2400 / bmp.width));
  const c = document.createElement("canvas");
  c.width = Math.round(bmp.width * scale);
  c.height = Math.round(bmp.height * scale);
  const ctx = c.getContext("2d");
  ctx.filter = "grayscale(1) contrast(1.4)";
  ctx.drawImage(bmp, 0, 0, c.width, c.height);
  return c;
}

// Join the text pieces of a PDF page into lines by their height on the page.
function pageLines(items) {
  const rows = [];
  for (const it of items) {
    if (!it.str || !it.str.trim()) continue;
    const y = it.transform[5], x = it.transform[4];
    let row = rows.find((r) => Math.abs(r.y - y) < 3);
    if (!row) { row = { y, parts: [] }; rows.push(row); }
    row.parts.push({ x, s: it.str });
  }
  return rows
    .sort((a, b) => b.y - a.y)
    .map((r) => r.parts.sort((a, b) => a.x - b.x).map((p) => p.s).join("  "));
}

async function readLabFile(file, onStatus) {
  const isPdf = file.type === "application/pdf" || /\.pdf$/i.test(file.name);
  if (!isPdf) {
    onStatus("קוראת את התמונה…");
    return ocr(file, onStatus);
  }
  onStatus("קוראת את ה-PDF…");
  const pdfjs = await loadPdfJs();
  const pdf = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
  let lines = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    lines = lines.concat(pageLines(content.items));
  }
  if (lines.join("").replace(/\s/g, "").length > 80) return lines;
  // A scanned PDF has no text. Draw each page and read it with OCR.
  lines = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    onStatus("מזהה טקסט בעמוד " + i + " מתוך " + pdf.numPages + "…");
    const page = await pdf.getPage(i);
    const vp = page.getViewport({ scale: 2 });
    const canvas = document.createElement("canvas");
    canvas.width = vp.width;
    canvas.height = vp.height;
    await page.render({ canvasContext: canvas.getContext("2d"), viewport: vp }).promise;
    lines = lines.concat(await ocr(canvas, onStatus));
  }
  return lines;
}
