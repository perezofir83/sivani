// Sections and fields of the intake file. Change this file to add or remove fields.
// type: "short" = one line, "long" = free text, "grid" = short fields in two columns.
const SCHEMA = [
  {
    id: "general", title: "א. פרטים כלליים", type: "grid",
    fields: [
      ["name", "שם"], ["intakeDate", "תאריך פגישה", "date"],
      ["sex", "מין"], ["age", "גיל"],
      ["marital", "מצב משפחתי"], ["residence", "מקום מגורים"],
      ["occupation", "עיסוק"], ["build", "מבנה גוף"],
      ["heightWeight", "גובה ומשקל"], ["skin", "גוון עור"],
      ["hair", "שיער"], ["eyes", "עיניים"],
      ["origin", "מוצא אתני"], ["drinking", "שתייה ביום"],
      ["phone", "טלפון"],
    ],
  },
  {
    id: "goals", title: "ב. מטרות הטיפול", type: "long",
    fields: [["primary", "מטרה ראשונית"], ["secondary", "מטרה משנית"], ["tertiary", "מטרה שלישונית"]],
  },
  {
    id: "systems", title: "ג. סימנים ותסמינים לפי מערכות", type: "long",
    fields: [
      ["sleep", "שינה"], ["pain", "כאבים"], ["emotional", "רקע רגשי"],
      ["endocrine", "מערכת אנדוקרינית ורבייה"], ["urinary", "מערכת השתן"],
      ["digestive", "מערכת העיכול"], ["respiratory", "מערכת הנשימה"],
      ["skinSystem", "עור"], ["other", "מערכות אחרות"], ["general", "מצב כללי"],
    ],
  },
  {
    id: "meds", title: "ד. תרופות, תוספים וצמחי מרפא", type: "long",
    fields: [["medications", "תרופות ותוספי תזונה"], ["substances", "שימוש בחומרים"], ["herbs", "צמחי מרפא ותכשירים"]],
  },
  {
    id: "lifestyle", title: "ה. דפוסי חיים", type: "long",
    fields: [
      ["nutrition", "תזונה"], ["sleepPattern", "שינה"], ["activity", "פעילות גופנית"],
      ["work", "עבודה"], ["family", "משפחה"], ["couple", "זוגיות"],
      ["selfImage", "קשר עם עצמה ודימוי גוף"], ["personalTime", "זמן אישי ויצירה"],
    ],
  },
  {
    id: "tests", title: "ו. בדיקות רפואיות ומסמכים", type: "long",
    fields: [["tests", "בדיקות"]],
  },
  { id: "blood", title: "ז. בדיקות דם", type: "blood" },
  { id: "images", title: "ח. תמונות", type: "images" },
  {
    id: "summary", title: "ט. סיכום והמלצות", type: "long",
    fields: [["assessment", "התרשמות"], ["plan", "תוכנית טיפול והמלצות"], ["followup", "מעקב"]],
  },
];

// Common blood tests: name and unit. The lab range changes from lab to lab, so she types it.
const COMMON_BLOOD_TESTS = [
  ["Glucose", "mg/dl"], ["Creatinine", "mg/dl"], ["eGFR", "ml/min/1.73m²"],
  ["Potassium (K+)", "mmol/l"], ["Sodium (Na)", "mmol/l"], ["Calcium", "mg/dl"],
  ["Bilirubin Total", "mg/dl"], ["ALP", "U/l"], ["ALT", "U/l"], ["AST", "U/l"],
  ["WBC", "10*3/µl"], ["RBC", "10*6/µl"], ["Hemoglobin", "g/dl"], ["Hematocrit", "%"],
  ["MCV", "fl"], ["MCH", "pg/cell"], ["MCHC", "g/dl"], ["RDW", "%"],
  ["Platelets", "10*3/µl"], ["MPV", "fl"],
  ["Ferritin", "ng/ml"], ["Iron", "µg/dl"], ["Vitamin B12", "pg/ml"], ["Vitamin D", "ng/ml"],
  ["TSH", "mIU/l"], ["Free T4", "pmol/l"],
  ["LH", "IU/L"], ["FSH", "IU/L"], ["Estradiol E2", "pmol/L"], ["Progesterone", "nmol/L"],
  ["Testosterone Total", "nmol/L"], ["DHEA-S", "µmol/L"], ["Prolactin", "mIU/L"], ["AMH", "ng/ml"],
  ["Cholesterol Total", "mg/dl"], ["HDL", "mg/dl"], ["LDL", "mg/dl"], ["Triglycerides", "mg/dl"],
];
