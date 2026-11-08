# Sivani – patient intake files

A small Hebrew (RTL) web app for one therapist. She fills in an intake file for each patient, the app saves it, and she downloads it as a PDF.

## What it does

1. Shows a list of patient files and a "new patient" button.
2. Shows 8 sections: general details, treatment goals, symptoms by body system, medications and herbs, lifestyle, tests and documents, blood tests, summary.
3. Saves every field on the device while she types. The top bar shows "נשמר ✓" after each save.
4. Colors blood test rows: red when the result is above the range, blue when it is below the range.
5. Makes a PDF in the green design. An option hides the name and phone in the PDF.
6. Downloads a backup file (JSON) and loads it again on the same or another device.
7. Works without internet after the first visit (service worker). She can add it to the home screen.

## Where the data is

The patient data stays only in the browser of her device (localStorage). The app sends nothing to a server. This repository holds only code. Do not commit patient data or backup files.

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
- `app.js` – saving, list, form, blood table, PDF, backup
- `styles.css` – design for screen and PDF
- `sw.js`, `manifest.webmanifest`, `icons/` – offline use and home-screen icon
- `vendor/html2pdf.bundle.min.js` – html2pdf.js 0.10.1 (MIT), makes the PDF in the browser
