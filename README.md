# KITS Robotics & Automation Pvt. Ltd. — Quotation Studio

An enterprise-grade, offline-first Quotation, Technical Estimation & Commercial Proposal Generation System engineered for industrial automation, robotics integration, and turnkey engineering solutions.

---

## 🚀 Key Features

### 1. Accurate Indian GST & Financial Engine
- **Intra-State vs. Inter-State Auto Detection**: Automatically parses client GSTIN to determine the 2-digit state code (e.g. `27` -> Maharashtra, `24` -> Gujarat, `29` -> Karnataka).
- **Tax Breakdown**: Automatically applies CGST (50%) + SGST (50%) for intra-state supply, or IGST (100%) for inter-state supply.
- **HSN/SAC Wise Tax Summary**: Generates a standard GST tax schedule table for each HSN code.
- **Commercial Round-off**: Precise rounding to nearest Rupee with paise calculation.
- **Words Formatter**: Automatic conversion of totals to Indian currency words format (*"Rupees ... Only"*).

### 2. Engineering Scope & Proposal Layout
- **Line Items / Bill of Quantities (BOQ)**: Equipment items, industrial robotics, PLC panels, sensors, and engineering service mandays.
- **Optional Items**: Toggle optional scope items that display in the proposal with pricing without inflating the main commercial total.
- **Customer Scope & Site Readiness**: Dedicated section for foundation requirements, 415V 3-phase power supply, 6-bar dry pneumatic air, and crane unloading.
- **Exclusions & Clarifications**: Protects against project scope creep.
- **Internal Margin & Costing Analysis**: Shows cost vs. selling rate, gross profit, and margin % for internal sales management (hidden from client PDFs).

### 3. High-Definition Multi-Page PDF & Print Engine
- **Pixel-Perfect A4 Letterhead**: Includes company statutory details (GSTIN, PAN, CIN, MIDC Bhosari address), custom uploaded logo, banking coordinates for RTGS/NEFT remittance, and designated signatory block.
- **Print Optimization**: Configured with `@page` and `break-inside: avoid` CSS so table rows, summaries, and terms never break awkwardly across pages.
- **One-Click Export**: High-resolution PDF export via `jspdf` and `html2canvas`.

### 4. Database, Backup & Cloud Synchronization
- **Offline-First Snappy LocalStorage**: Works 100% offline with zero latency.
- **Live Google Firebase Firestore Sync**: One-click real-time backup and synchronization to Firebase.
- **Full JSON Backup & Restore**: One-click export of the entire database (quotes, clients, products, settings) and instant import on any workstation.
- **Revision Control**: Instant cloning and revision incrementing (`Rev 0` -> `Rev 1` -> `Rev 2`).

### 5. Client Directory & Item Catalog
- **Client Directory**: Customer records with auto-state detection from GSTIN, contact persons, emails, and billing/shipping addresses.
- **Quick-Save Client**: Add new clients directly while typing a quotation.
- **Catalog Management**: Standard library of robotic arms, PLC panels, gantries, vision cameras, and engineering mandays.

---

## 🛠️ Tech Stack
- **Framework**: [React 19](https://react.dev/)
- **Build Tool**: [Vite 8](https://vite.dev/) with Rolldown bundler
- **Styling**: [Tailwind CSS v4](https://tailwindcss.com/)
- **Icons**: [Lucide React](https://lucide.dev/)
- **Cloud Database**: [Firebase Firestore](https://firebase.google.com/)
- **PDF Generation**: [jsPDF](https://github.com/parallax/jsPDF) & [html2canvas](https://html2canvas.hertzen.com/)
- **Linter**: [Oxlint](https://oxc.rs/) (0 warnings, 0 errors)

---

## 💻 Development & Build

```bash
# Start development server
npm run dev

# Run production build
npm run build

# Preview production build
npm run preview
```

---

## 📁 Project Structure

```
├── src/
│   ├── components/
│   │   ├── Navbar.jsx            # Top navigation, enterprise badge, Firebase status
│   │   ├── Dashboard.jsx         # KPI metrics, quotations list, status filters, CSV export
│   │   ├── QuotationEditor.jsx   # BOQ editor, HSN picker, site readiness, terms, live GST
│   │   ├── QuotationPreview.jsx  # Letterhead, commercial offer, A4 print layout, PDF download
│   │   ├── ClientsManager.jsx    # Customer directory with GSTIN state auto-detection
│   │   ├── ProductsManager.jsx   # Equipment & engineering services catalog
│   │   ├── SettingsModal.jsx     # Company profile, bank RTGS details, Firebase, JSON backup
│   │   └── ShareModal.jsx        # One-click WhatsApp & email formatted quotation dispatch
│   ├── services/
│   │   ├── db.js                 # LocalStorage persistence, sequential numbering, backup/restore
│   │   ├── firebase.js           # Firebase Firestore initialization & live sync
│   │   ├── initialData.js        # Default sample industrial robotics & automation data
│   │   └── pdfGenerator.js       # Multi-page A4 PDF rendering engine
│   ├── utils/
│   │   ├── formatters.js         # Indian currency (₹) & date formatters
│   │   ├── gstHelper.js          # Indian GST state codes, HSN codes, and tax calculation
│   │   └── numberToWords.js      # Large Indian number-to-words converter (Crores & Lakhs)
│   ├── App.jsx                   # Central state orchestrator with toast notification system
│   ├── index.css                 # Tailwind v4 setup & multi-page @media print styling
│   └── main.jsx                  # Application entry point
├── package.json
└── vite.config.js
```
