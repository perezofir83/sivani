# Sivani – patient intake files

A small Hebrew (RTL) web app for one therapist. She fills in an intake file for each patient, the app saves it, and she downloads it as a PDF.

## What it does

1. Shows a list of patient files and a "new patient" button.
2. Shows 9 sections: general details, treatment goals, symptoms by body system, medications and herbs, lifestyle, tests and documents, blood tests, images, summary.
3. Saves every field on the device while she types. The top bar shows "נשמר ✓" after each save.
4. Reads a lab form (PDF or photo) and fills the blood test table. The form is read on the device and is not saved. Only test name, result, unit and range are kept, never names, ID numbers or dates. She checks and corrects the values in a review window before they are added. Photos and scanned PDFs use OCR (tesseract.js, downloaded once from jsDelivr), and OCR can drop a decimal point.
5. Shows all blood values and a separate box with abnormal values only: red when the result is above the range, blue when it is below the range.
6. Stores images (resized JPEG) in IndexedDB, with an optional caption.
7. Makes a PDF in the green design through the browser print dialog ("Save as PDF"), so the PDF has real Hebrew text and clean page breaks. An option hides the name and phone in the PDF.
8. Downloads a backup file (JSON, includes images) and loads it again on the same or another device.
9. Works without internet after the first visit (service worker). She can add it to the home screen.

## Where the data is

The patient data stays only in the browser of her device (localStorage for the files, IndexedDB for images). The app sends nothing to a server. This repository holds only code. Do not commit patient data or backup files.

If she clears the browser data or loses the device, the files are gone. For this reason she must download a backup file every week. The app shows a warning after 7 days without a backup.

## Change the fields

Edit `schema.js`. Each section has a title and a list of fields. After a change, update `VERSION` in `sw.js`.

## Run locally

```bash
python3 -m http.server 8790
```

Open http://localhost:8790.

## Files

- `index.html` – page layout
- `schema.js` – sections, fields and common blood tests
- `app.js` – saving, list, form, blood table, abnormal values, images, PDF, backup
- `parser.js` – reads blood test values from lab form text (`node` can test it)
- `files.js` – images in IndexedDB, reading PDF (pdf.js) and photos (OCR)
- `styles.css` – design for screen and PDF
- `sw.js`, `manifest.webmanifest`, `icons/` – offline use and home-screen icon
- `vendor/pdf.min.js`, `vendor/pdf.worker.min.js` – pdf.js 3.11.174 (Apache 2.0), reads the text of lab PDFs
