# OrderEntry – Frontend Requirements

This document describes the requirements for the frontend implementation of the **OrderEntry GUI**,  
based on FHIR master data (`ActivityDefinition`, `SpecimenDefinition`, `ObservationDefinition`).

---

## Configuration

- Set `NEXT_PUBLIC_FHIR_BASE` in your environment (e.g. `.env.local`).
- Example: `NEXT_PUBLIC_FHIR_BASE=https://jwefxdpeebldi4q2.myfritz.net:9443/fhir`

## 🇬🇧 English Version

### Step 1 – Main Categories (e.g. Chemistry, Hematology, Routine, Microbiology)

- **FHIR field:** `ActivityDefinition.topic.coding.display` → contains the main category (e.g. *Microbiology*).  
- **GUI behavior:** Each click filters `ActivityDefinition` by topic.

**Button example:**
```html
<button>${ActivityDefinition.topic.coding.display}</button>
```

**FHIR API example:**
```http
GET [baseUrl]/ActivityDefinition?topic=MIBI
```

---

### Step 2 – Subgroups & Filters (inside a category)

- `ActivityDefinition.description` → clinical context (e.g. *Helminths / Parasites*)  
- `ActivityDefinition.subtitle` → specimen description (e.g. *Stool, native*)  
- `ActivityDefinition.code.coding.code` → LIS code or synonyms  

**GUI Implementation:**
- Filter bar: Material, Context, Frequency  
- Search field → searches across `code.display` + `description`  

---

### Step 3 – Material-based Grouping (Specimen)

- `ActivityDefinition.extension.valueReference` → reference to `SpecimenDefinition`  
- `SpecimenDefinition.typeCollected.text` → specimen name (e.g. *Stool, Blood, Urine*)  
- `SpecimenDefinition.container.description` → container (e.g. *Serum tube, Stool tube*)  

**GUI Implementation:**
- Alternative view: “Materials” as entry point instead of categories  
- Clicking “Blood” → displays all `ActivityDefinition` with `Specimen=Blood`  

**FHIR API example:**
```http
GET [baseUrl]/SpecimenDefinition?identifier=AA
```

---

### Step 4 – Usability Features

**FHIR fields for features:**
- `ActivityDefinition.code.coding.display` → Autocomplete search  
- `ActivityDefinition.relatedArtifact.url` → link to lab manual/documentation  
- `ActivityDefinition.extension.valueQuantity` → minimum volume (plausibility check)  
- `ObservationDefinition` (optional) → detailed analyses, reference ranges  

**GUI Implementation:**
- Autocomplete search field (test name, synonyms, LIS code)  
- Favorites list (local or per patient session)  
- Visual icons per material (Blood 🩸, Urine 💧, Stool 💩, Swab 🧪)  
- Drag & Drop → add tests to the order  

---

### ✅ Summary for Developers

1. **Categories (topics)**  
2. **Subgroups & Filters (description, subtitle, code)**  
3. **Material-based View (SpecimenDefinition)**  
4. **Usability Extensions (search, favorites, icons, links, volume check)**  

---

## 🇩🇪 Deutsche Version

### Schritt 1 – Hauptkategorien (z. B. Chemie, Hämatologie, Routine, Mikrobiologie)

- **FHIR-Feld:** `ActivityDefinition.topic.coding.display` → enthält die Fachkategorie (z. B. Mikrobiologie).  
- **GUI-Verhalten:** Jeder Klick filtert `ActivityDefinition` nach topic.  

**Button-Beispiel:**
```html
<button>${ActivityDefinition.topic.coding.display}</button>
```

**FHIR-API-Beispiel:**
```http
GET [baseUrl]/ActivityDefinition?topic=MIBI
```

---

### Schritt 2 – Subgruppen & Filter (innerhalb einer Kategorie)

- `ActivityDefinition.description` → klinischer Kontext (z. B. *Helminthen / Parasiten*)  
- `ActivityDefinition.subtitle` → Probenbeschreibung (z. B. *Stuhl, nativ*)  
- `ActivityDefinition.code.coding.code` → LIS-Code oder Synonyme  

**GUI-Umsetzung:**
- Filterleiste: Material, Kontext, Häufigkeit  
- Suchfeld → durchsucht `code.display` + `description`  

---

### Schritt 3 – Material-basierte Gruppierung (Specimen)

- `ActivityDefinition.extension.valueReference` → verweist auf `SpecimenDefinition`  
- `SpecimenDefinition.typeCollected.text` → Material-Name (z. B. *Stuhl, Blut, Urin*)  
- `SpecimenDefinition.container.description` → Behälter (z. B. *Serumröhrchen, Stuhlröhrchen*)  

**GUI-Umsetzung:**
- Zweite Ansicht: „Materialien“ als Einstieg statt Kategorien  
- Klick auf „Blut“ → zeigt alle ActivityDefinitions mit Specimen=Blut  

**FHIR-API-Beispiel:**
```http
GET [baseUrl]/SpecimenDefinition?identifier=AA
```

---

### Schritt 4 – Usability-Features

**FHIR-Felder für Features:**
- `ActivityDefinition.code.coding.display` → Autocomplete-Suche  
- `ActivityDefinition.relatedArtifact.url` → Link zum Laborhandbuch / Doku  
- `ActivityDefinition.extension.valueQuantity` → Mindestvolumen (für Plausibilitätsprüfung)  
- `ObservationDefinition` (optional) → detaillierte Analysen, Referenzbereiche  

**GUI-Umsetzung:**
- Suchfeld mit Autocomplete (Testname, Synonyme, LIS-Code)  
- Favoritenliste (lokal oder patientenbezogen speichern)  
- Visuelle Icons pro Material (Blut 🩸, Urin 💧, Stuhl 💩, Abstrich 🧪)  
- Drag & Drop → Tests in die Auftragserstellung ziehen  

---

### ✅ Zusammenfassung für Entwickler

1. **Kategorien (Topics)**  
2. **Subgruppen & Filter (Beschreibung, Subtitle, Code)**  
3. **Material-Ansicht (SpecimenDefinition)**  
4. **Usability-Erweiterungen (Suche, Favoriten, Icons, Links, Volumenprüfung)**
