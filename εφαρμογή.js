/* Ερωτηματολόγια Απολλώνιο — εφαρμογή iPad
   Καμία ερώτηση δεν ζει εδώ: όλες έρχονται από τα ερωτήσεις_*.json.
   Οι απαντήσεις μένουν στο iPad (IndexedDB) μέχρι την εξαγωγή στο iCloud Drive (Web Share → Αρχεία). */
"use strict";

const ΕΚΔΟΣΗ_ΕΦΑΡΜΟΓΗΣ = "1.0.0";
const ΣΧΗΜΑ = 1;
const ΗΜΕΡΕΣ_ΔΙΑΤΗΡΗΣΗΣ = 30;

// ------------------------------------------------------------------ αποθήκη (IndexedDB)
const Αποθήκη = (() => {
  let db;
  function άνοιγμα() {
    if (db) return Promise.resolve(db);
    return new Promise((ok, fail) => {
      const αίτ = indexedDB.open("ερωτηματολόγια", 1);
      αίτ.onupgradeneeded = () => {
        const d = αίτ.result;
        const ε = d.createObjectStore("ερωτηματολόγια", { keyPath: "αναγνωριστικό" });
        ε.createIndex("κατάσταση", "κατάσταση");
        d.createObjectStore("πρόχειρο", { keyPath: "κλειδί" });
      };
      αίτ.onsuccess = () => { db = αίτ.result; ok(db); };
      αίτ.onerror = () => fail(αίτ.error);
    });
  }
  function tx(όνομα, τρόπος, fn) {
    return άνοιγμα().then(d => new Promise((ok, fail) => {
      const t = d.transaction(όνομα, τρόπος);
      const r = fn(t.objectStore(όνομα));
      t.oncomplete = () => ok(r && r.result !== undefined ? r.result : r);
      t.onerror = () => fail(t.error);
    }));
  }
  return {
    βάλε: (εγγ) => tx("ερωτηματολόγια", "readwrite", s => s.put(εγγ)),
    πάρε: (id) => tx("ερωτηματολόγια", "readonly", s => s.get(id)),
    όλα: () => tx("ερωτηματολόγια", "readonly", s => s.getAll()),
    σβήσε: (id) => tx("ερωτηματολόγια", "readwrite", s => s.delete(id)),
    πρόχειρο_βάλε: (δ) => tx("πρόχειρο", "readwrite", s => s.put({ κλειδί: "τρέχον", ...δ })),
    πρόχειρο_πάρε: () => tx("πρόχειρο", "readonly", s => s.get("τρέχον")),
    πρόχειρο_σβήσε: () => tx("πρόχειρο", "readwrite", s => s.delete("τρέχον")),
  };
})();

// ------------------------------------------------------------------ βοηθητικά
const $ = (id) => document.getElementById(id);
const el = (tag, attrs = {}, ...παιδιά) => {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "class") e.className = v;
    else if (k === "html") e.innerHTML = v;
    else if (k.startsWith("on")) e.addEventListener(k.slice(2), v);
    else if (v !== undefined && v !== null && v !== false) e.setAttribute(k, v === true ? "" : v);
  }
  for (const π of παιδιά) if (π !== null && π !== undefined) e.append(π.nodeType ? π : document.createTextNode(String(π)));
  return e;
};
const uuid = () => (crypto.randomUUID ? crypto.randomUUID() :
  "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, c => { const r = Math.random() * 16 | 0; return (c === "x" ? r : (r & 3 | 8)).toString(16); }));
const ΜΗΝΕΣ = ["Ιανουαρίου", "Φεβρουαρίου", "Μαρτίου", "Απριλίου", "Μαΐου", "Ιουνίου", "Ιουλίου", "Αυγούστου", "Σεπτεμβρίου", "Οκτωβρίου", "Νοεμβρίου", "Δεκεμβρίου"];
const ΜΗΝΕΣ_ΟΝΟΜ = ["Ιανουάριος", "Φεβρουάριος", "Μάρτιος", "Απρίλιος", "Μάιος", "Ιούνιος", "Ιούλιος", "Αύγουστος", "Σεπτέμβριος", "Οκτώβριος", "Νοέμβριος", "Δεκέμβριος"];
const σήμερα_iso = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
const τώρα_iso = () => { const d = new Date(), tz = -d.getTimezoneOffset(), σ = tz >= 0 ? "+" : "-", a = Math.abs(tz);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 19) + `${σ}${String(a / 60 | 0).padStart(2, "0")}:${String(a % 60).padStart(2, "0")}`; };
const ηλικία_από = (iso, ημ = new Date()) => { const [y, m, d] = iso.split("-").map(Number); let α = ημ.getFullYear() - y;
  if (ημ.getMonth() + 1 < m || (ημ.getMonth() + 1 === m && ημ.getDate() < d)) α--; return α; };
const ελλ_ημερομηνία = (iso) => { const [y, m, d] = iso.split("-").map(Number); return `${d} ${ΜΗΝΕΣ[m - 1]} ${y}`; };
const ώρα_κείμενο = (iso) => iso ? iso.slice(11, 16) : "";
const συσκευή = () => { try { return localStorage.getItem("συσκευή") || "iPad υποδοχής"; } catch { return "iPad υποδοχής"; } };

// ------------------------------------------------------------------ φωνή
const Φωνή = (() => {
  let φωνή = null, ενεργή = false;
  function επιλογή_φωνής() {
    if (!("speechSynthesis" in window)) return null;
    const όλες = speechSynthesis.getVoices().filter(v => (v.lang || "").toLowerCase().startsWith("el"));
    if (!όλες.length) return null;
    const βαθμός = v => (/premium/i.test(v.name + v.voiceURI) ? 3 : /enhanced|βελτιωμ/i.test(v.name + v.voiceURI) ? 2 : 1) + (v.localService ? 0.5 : 0);
    return όλες.sort((a, b) => βαθμός(b) - βαθμός(a))[0];
  }
  if ("speechSynthesis" in window) { speechSynthesis.onvoiceschanged = () => { φωνή = επιλογή_φωνής(); }; φωνή = επιλογή_φωνής(); }
  return {
    διαθέσιμη: () => "speechSynthesis" in window,
    πες(κείμενο, κουμπί) {
      if (!("speechSynthesis" in window)) return;
      if (ενεργή) { speechSynthesis.cancel(); ενεργή = false; κουμπί && κουμπί.classList.remove("ενεργή"); return; }
      if (!φωνή) φωνή = επιλογή_φωνής();
      const u = new SpeechSynthesisUtterance(κείμενο);
      u.lang = "el-GR"; if (φωνή) u.voice = φωνή; u.rate = 0.92;
      u.onend = u.onerror = () => { ενεργή = false; κουμπί && κουμπί.classList.remove("ενεργή"); };
      ενεργή = true; κουμπί && κουμπί.classList.add("ενεργή");
      speechSynthesis.cancel(); speechSynthesis.speak(u);
    },
    σταμάτα() { if ("speechSynthesis" in window) { speechSynthesis.cancel(); ενεργή = false; } }
  };
})();

// ------------------------------------------------------------------ ερωτήσεις
let ΚΟΙΝΕΣ, ΕΡΩΤΗΣΕΙΣ = {};
async function φόρτωσε_ερωτήσεις() {
  const [κ, ο, λ] = await Promise.all(["ερωτήσεις_κοινές.json", "ερωτήσεις_οστική.json", "ερωτήσεις_λιπομέτρηση.json"]
    .map(f => fetch(f, { cache: "no-cache" }).then(r => { if (!r.ok) throw new Error(f); return r.json(); })));
  ΚΟΙΝΕΣ = κ; ΕΡΩΤΗΣΕΙΣ = { οστική: ο, λιπομέτρηση: λ };
}

// ------------------------------------------------------------------ ροή ερωτηματολογίου
let Ροή = null; // {είδος, αναγνωριστικό, έναρξη, εξεταζόμενος{ημ_γέννησης, φύλο}, συμπλήρωση, απαντήσεις{}, θέση, οθόνες[]}

function χτίσε_οθόνες(είδος) {
  const ε = ΕΡΩΤΗΣΕΙΣ[είδος];
  const οθ = [];
  οθ.push({ κωδικός: "_ημ", τύπος: "ειδική", ειδική: "ημ_γέννησης", ενότητα: ΚΟΙΝΕΣ.ταυτοποίηση.τίτλος });
  οθ.push({ κωδικός: "_επιβ", τύπος: "ειδική", ειδική: "επιβεβαίωση", ενότητα: ΚΟΙΝΕΣ.ταυτοποίηση.τίτλος });
  οθ.push({ κωδικός: "_φύλο", τύπος: "επιλογή", κείμενο: ΚΟΙΝΕΣ.ταυτοποίηση.φύλο.κείμενο, επιλογές: ΚΟΙΝΕΣ.ταυτοποίηση.φύλο.επιλογές, ενότητα: ΚΟΙΝΕΣ.ταυτοποίηση.τίτλος, _σύστημα: "φύλο" });
  οθ.push({ κωδικός: "_συμπλ", τύπος: "επιλογή", κείμενο: ΚΟΙΝΕΣ.ταυτοποίηση.συμπλήρωση.κείμενο, επιλογές: ΚΟΙΝΕΣ.ταυτοποίηση.συμπλήρωση.επιλογές, ενότητα: ΚΟΙΝΕΣ.ταυτοποίηση.τίτλος, _σύστημα: "συμπλήρωση" });
  for (const σ of ΚΟΙΝΕΣ.πριν_την_εξέταση.οθόνες) οθ.push({ ...σ, ενότητα: ΚΟΙΝΕΣ.πριν_την_εξέταση.τίτλος, _κοινή: true });
  for (const εν of ε.ενότητες) for (const σ of εν.οθόνες) οθ.push({ ...σ, ενότητα: εν.τίτλος, όταν: [...(εν.όταν || []), ...(σ.όταν || [])] });
  return οθ;
}

function ισχύει(συνθήκες) {
  if (!συνθήκες || !συνθήκες.length) return true;
  const α = Ροή.απαντήσεις, εξ = Ροή.εξεταζόμενος;
  return συνθήκες.every(σ => {
    if ("φύλο" in σ) return εξ.φύλο === σ.φύλο;
    if ("ηλικία_κάτω" in σ) return εξ.ημ_γέννησης && ηλικία_από(εξ.ημ_γέννησης) < σ.ηλικία_κάτω;
    if ("ηλικία_από" in σ) return εξ.ημ_γέννησης && ηλικία_από(εξ.ημ_γέννησης) >= σ.ηλικία_από;
    if ("κωδικός" in σ) {
      const v = α[σ.κωδικός];
      if ("περιέχει" in σ) return Array.isArray(v) && v.includes(σ.περιέχει);
      return v === σ.τιμή;
    }
    return true;
  });
}

const ορατή = (i) => { const σ = Ροή.οθόνες[i]; return σ && ισχύει(σ.όταν); };

async function ξεκίνα(είδος) {
  Ροή = { είδος, αναγνωριστικό: uuid(), έναρξη: τώρα_iso(), εξεταζόμενος: { ημ_γέννησης: null, φύλο: null }, συμπλήρωση: null, απαντήσεις: {}, θέση: 0 };
  Ροή.οθόνες = χτίσε_οθόνες(είδος);
  await αποθήκευσε_πρόχειρο();
  δείξε_θέση(0);
}

async function συνέχισε_πρόχειρο(π) {
  Ροή = { είδος: π.είδος, αναγνωριστικό: π.αναγνωριστικό, έναρξη: π.έναρξη, εξεταζόμενος: π.εξεταζόμενος, συμπλήρωση: π.συμπλήρωση, απαντήσεις: π.απαντήσεις, θέση: π.θέση };
  Ροή.οθόνες = χτίσε_οθόνες(π.είδος);
  δείξε_θέση(Math.min(π.θέση, Ροή.οθόνες.length - 1));
}

function αποθήκευσε_πρόχειρο() {
  if (!Ροή) return Promise.resolve();
  const { οθόνες, ...υπόλοιπο } = Ροή;
  return Αποθήκη.πρόχειρο_βάλε(υπόλοιπο).catch(() => {});
}

function επόμενη() {
  let i = Ροή.θέση + 1;
  while (i < Ροή.οθόνες.length && !ορατή(i)) i++;
  if (i >= Ροή.οθόνες.length) return ολοκλήρωση();
  δείξε_θέση(i);
}
function προηγούμενη() {
  let i = Ροή.θέση - 1;
  while (i >= 0 && !ορατή(i)) i--;
  if (i < 0) { if (confirm("Να ακυρωθεί το ερωτηματολόγιο και να επιστρέψουμε στην αρχή;")) { Αποθήκη.πρόχειρο_σβήσε(); Ροή = null; αρχική(); } return; }
  δείξε_θέση(i);
}
function απάντησε(σ, τιμή, αυτόματα = true) {
  if (σ._σύστημα === "φύλο") Ροή.εξεταζόμενος.φύλο = τιμή;
  else if (σ._σύστημα === "συμπλήρωση") Ροή.συμπλήρωση = τιμή;
  else Ροή.απαντήσεις[σ.κωδικός] = τιμή;
  αποθήκευσε_πρόχειρο();
  if (αυτόματα) setTimeout(επόμενη, 180);
}
const τρέχουσα_τιμή = (σ) => σ._σύστημα === "φύλο" ? Ροή.εξεταζόμενος.φύλο : σ._σύστημα === "συμπλήρωση" ? Ροή.συμπλήρωση : Ροή.απαντήσεις[σ.κωδικός];

// ------------------------------------------------------------------ απόδοση οθονών
function καθάρισε() { Φωνή.σταμάτα(); $("οθόνη").innerHTML = ""; $("υποσέλιδο").innerHTML = ""; $("φωνή").hidden = true; $("πίσω").hidden = true; $("ενότητα").textContent = ""; $("πρόοδος-μπάρα").style.width = "0"; }

function κεφαλίδα(ενότητα, πρόοδος, πίσω, εκφώνηση) {
  $("ενότητα").textContent = ενότητα || "";
  document.querySelector(".κεφαλίδα").classList.toggle("χωρίς-πρόοδο", πρόοδος === null);
  $("πρόοδος-μπάρα").style.width = `${Math.round((πρόοδος || 0) * 100)}%`;
  $("πίσω").hidden = !πίσω; $("πίσω").onclick = πίσω || null;
  const φ = $("φωνή"); φ.classList.remove("ενεργή");
  if (εκφώνηση && Φωνή.διαθέσιμη()) { φ.hidden = false; φ.onclick = () => Φωνή.πες(εκφώνηση, φ); } else φ.hidden = true;
}

function δείξε_θέση(i) {
  Ροή.θέση = i; αποθήκευσε_πρόχειρο();
  const σ = Ροή.οθόνες[i];
  const σύνολο = Ροή.οθόνες.length;
  καθάρισε();
  const εκφ = κείμενο_εκφώνησης(σ);
  κεφαλίδα(σ.ενότητα, i / σύνολο, προηγούμενη, εκφ);
  const ο = $("οθόνη"), υ = $("υποσέλιδο");
  const απ = {
    ναι_όχι: () => απόδοση_επιλογών(σ, [{ τιμή: true, κείμενο: "ΝΑΙ", κλάση: "ναι", δείκτης: "✓" }, { τιμή: false, κείμενο: "ΟΧΙ", κλάση: "όχι", δείκτης: "✕" }]),
    επιλογή: () => απόδοση_επιλογών(σ, σ.επιλογές),
    κλίμακα: () => απόδοση_επιλογών(σ, ΕΡΩΤΗΣΕΙΣ[Ροή.είδος].κλίμακα_FES.map(x => ({ ...x, δείκτης: String(x.τιμή) })), "κλίμακα"),
    πολλαπλή: () => απόδοση_πολλαπλής(σ),
    αριθμός: () => απόδοση_αριθμού(σ),
    πληροφορία: () => απόδοση_πληροφορίας(σ),
    ειδική: () => ({ ημ_γέννησης: απόδοση_ημ_γέννησης, επιβεβαίωση: απόδοση_επιβεβαίωσης, εργαστηριακά: απόδοση_εργαστηριακών })[σ.ειδική](σ),
  }[σ.τύπος];
  if (!απ) { ο.append(el("p", { class: "σφάλμα" }, `Άγνωστος τύπος οθόνης: ${σ.τύπος}`)); υ.append(el("button", { class: "κουμπί", onclick: επόμενη }, "Συνέχεια")); return; }
  απ();
  ο.scrollTop = 0; window.scrollTo(0, 0);
}

function κείμενο_εκφώνησης(σ) {
  if (σ.εκφώνηση) return σ.εκφώνηση;
  if (σ.τύπος === "ειδική") return σ.ειδική === "ημ_γέννησης" ? ΚΟΙΝΕΣ.ταυτοποίηση.ημ_γέννησης.εκφώνηση : null;
  let τ = σ.κείμενο || "";
  if (σ.βοήθεια) τ += " " + σ.βοήθεια;
  if (σ.τύπος === "ναι_όχι") τ += " Ναι ή όχι;" + (σ.άγνωστο ? " Ή δεν γνωρίζω." : "");
  else if (σ.τύπος === "κλίμακα") τ += " Δεν με απασχολεί καθόλου, λίγο, αρκετά, ή πολύ;";
  else if (σ.επιλογές) τ += " " + σ.επιλογές.filter(e => !e.όταν || ισχύει(e.όταν)).map(e => e.κείμενο + (e.περιγραφή ? ", " + e.περιγραφή : "")).join(". ") + ".";
  return τ.replace(/\bcm\b/g, "εκατοστά").replace(/\bkg\b/g, "κιλά").replace(/\bmg\b/g, "μιλιγκράμ").replace(/π\.χ\./g, "για παράδειγμα").replace(/\bΧΑΠ\b/g, "χρόνια αποφρακτική πνευμονοπάθεια").replace(/\bHDL\b/g, "έιτς-ντι-έλ");
}

function απόδοση_ερώτησης(σ) {
  const ο = $("οθόνη");
  if (σ.τύπος === "κλίμακα" && ΕΡΩΤΗΣΕΙΣ[Ροή.είδος].κλίμακα_FES_εισαγωγή) ο.append(el("p", { class: "εισαγωγή" }, ΕΡΩΤΗΣΕΙΣ[Ροή.είδος].κλίμακα_FES_εισαγωγή));
  ο.append(el("h1", { class: "ερώτηση" }, σ.κείμενο));
  if (σ.βοήθεια) ο.append(el("p", { class: "βοήθεια" }, σ.βοήθεια));
  return ο;
}

function απόδοση_επιλογών(σ, επιλογές, κλάση = "") {
  const ο = απόδοση_ερώτησης(σ);
  const τρέχ = τρέχουσα_τιμή(σ);
  const λ = el("div", { class: "επιλογές " + κλάση });
  const κουμπιά = [];
  const πρόσθεσε = (e, δευτ) => {
    const b = el("button", { class: "επιλογή" + (e.κλάση ? " " + e.κλάση : "") + (δευτ ? " δευτερεύουσα" : "") + (τρέχ === e.τιμή ? " επιλεγμένη" : ""), type: "button" },
      el("span", { class: "δείκτης" }, e.δείκτης || (τρέχ === e.τιμή ? "✓" : "")),
      el("span", { class: "σώμα" }, e.κείμενο, e.περιγραφή ? el("span", { class: "περιγραφή" }, e.περιγραφή) : null));
    b.onclick = () => { κουμπιά.forEach(x => { x.classList.remove("επιλεγμένη"); if (!x.dataset.δείκτης) x.querySelector(".δείκτης").textContent = ""; });
      b.classList.add("επιλεγμένη"); if (!e.δείκτης) b.querySelector(".δείκτης").textContent = "✓"; απάντησε(σ, e.τιμή); };
    if (e.δείκτης) b.dataset.δείκτης = "1";
    κουμπιά.push(b); λ.append(b);
  };
  for (const e of επιλογές) if (!e.όταν || ισχύει(e.όταν)) πρόσθεσε(e);
  if (σ.άγνωστο && !επιλογές.some(e => e.τιμή === "άγνωστο")) πρόσθεσε({ τιμή: "άγνωστο", κείμενο: σ.ετικέτα_άγνωστο || "Δεν γνωρίζω" }, true);
  ο.append(λ);
}

function απόδοση_πολλαπλής(σ) {
  const ο = απόδοση_ερώτησης(σ);
  const τρέχ = new Set(Array.isArray(τρέχουσα_τιμή(σ)) ? τρέχουσα_τιμή(σ) : []);
  const λ = el("div", { class: "επιλογές" });
  const κουμπιά = new Map();
  const ανανέωσε = () => { for (const [τ, b] of κουμπιά) { const on = τρέχ.has(τ); b.classList.toggle("επιλεγμένη", on); b.querySelector(".δείκτης").textContent = on ? "✓" : ""; } συν.disabled = τρέχ.size === 0; };
  for (const e of σ.επιλογές) {
    if (e.όταν && !ισχύει(e.όταν)) continue;
    const b = el("button", { class: "επιλογή τετράγωνο" + (e.αποκλειστικό ? " δευτερεύουσα" : ""), type: "button" }, el("span", { class: "δείκτης" }), el("span", { class: "σώμα" }, e.κείμενο, e.περιγραφή ? el("span", { class: "περιγραφή" }, e.περιγραφή) : null));
    b.onclick = () => {
      if (e.αποκλειστικό) { τρέχ.clear(); τρέχ.add(e.τιμή); }
      else { for (const x of σ.επιλογές) if (x.αποκλειστικό) τρέχ.delete(x.τιμή); τρέχ.has(e.τιμή) ? τρέχ.delete(e.τιμή) : τρέχ.add(e.τιμή); }
      ανανέωσε();
    };
    κουμπιά.set(e.τιμή, b); λ.append(b);
  }
  ο.append(λ);
  const συν = el("button", { class: "κουμπί", type: "button", onclick: () => απάντησε(σ, [...τρέχ].filter(t => t !== "κανένα")) }, "Συνέχεια ›");
  $("υποσέλιδο").append(συν);
  ανανέωσε();
}

function απόδοση_αριθμού(σ) {
  const ο = απόδοση_ερώτησης(σ);
  const τρέχ = τρέχουσα_τιμή(σ);
  const inp = el("input", { type: "number", inputmode: "numeric", pattern: "[0-9]*", min: σ.ελάχιστο, max: σ.μέγιστο, value: typeof τρέχ === "number" ? τρέχ : "" });
  const σφ = el("p", { class: "σφάλμα" });
  ο.append(el("div", { class: "πεδίο-αριθμός" }, inp, σ.μονάδα ? el("span", { class: "μονάδα" }, σ.μονάδα) : null), σφ);
  const έλεγχος = () => { const v = inp.value === "" ? null : Number(inp.value);
    if (v === null) { σφ.textContent = ""; συν.disabled = true; return null; }
    if (!Number.isFinite(v) || (σ.ελάχιστο !== undefined && v < σ.ελάχιστο) || (σ.μέγιστο !== undefined && v > σ.μέγιστο)) { σφ.textContent = `Παρακαλώ τιμή από ${σ.ελάχιστο} έως ${σ.μέγιστο}.`; συν.disabled = true; return null; }
    σφ.textContent = ""; συν.disabled = false; return v; };
  inp.oninput = έλεγχος;
  inp.onkeydown = (e) => { if (e.key === "Enter") { const v = έλεγχος(); if (v !== null) απάντησε(σ, v); } };
  const συν = el("button", { class: "κουμπί", type: "button", onclick: () => { const v = έλεγχος(); if (v !== null) απάντησε(σ, v); } }, "Συνέχεια ›");
  const υ = $("υποσέλιδο");
  if (σ.άγνωστο) υ.append(el("button", { class: "κουμπί δευτερεύον", type: "button", onclick: () => απάντησε(σ, "άγνωστο") }, σ.ετικέτα_άγνωστο || "Δεν γνωρίζω"));
  υ.append(συν);
  έλεγχος();
  setTimeout(() => inp.focus(), 50);
}

function απόδοση_πληροφορίας(σ) {
  απόδοση_ερώτησης(σ);
  $("υποσέλιδο").append(el("button", { class: "κουμπί", type: "button", onclick: επόμενη }, (σ.κουμπί || "Συνέχεια") + " ›"));
}

function απόδοση_ημ_γέννησης(σ) {
  const ο = $("οθόνη");
  ο.append(el("h1", { class: "ερώτηση" }, ΚΟΙΝΕΣ.ταυτοποίηση.ημ_γέννησης.κείμενο));
  const τρέχ = Ροή.εξεταζόμενος.ημ_γέννησης ? Ροή.εξεταζόμενος.ημ_γέννησης.split("-").map(Number) : null;
  const έτος_τώρα = new Date().getFullYear();
  const ημ = el("select", { "aria-label": "Ημέρα" }, el("option", { value: "" }, "Ημέρα"), ...Array.from({ length: 31 }, (_, i) => el("option", { value: i + 1, selected: τρέχ && τρέχ[2] === i + 1 }, i + 1)));
  const μη = el("select", { "aria-label": "Μήνας" }, el("option", { value: "" }, "Μήνας"), ...ΜΗΝΕΣ_ΟΝΟΜ.map((m, i) => el("option", { value: i + 1, selected: τρέχ && τρέχ[1] === i + 1 }, m)));
  const ετ = el("select", { "aria-label": "Έτος" }, el("option", { value: "" }, "Έτος"), ...Array.from({ length: έτος_τώρα - 1915 }, (_, i) => έτος_τώρα - i).map(y => el("option", { value: y, selected: τρέχ && τρέχ[0] === y }, y)));
  const σφ = el("p", { class: "σφάλμα" });
  ο.append(el("div", { class: "τροχοί" }, ημ, μη, ετ), σφ);
  const έλεγχος = () => { const d = +ημ.value, m = +μη.value, y = +ετ.value;
    if (!d || !m || !y) { συν.disabled = true; σφ.textContent = ""; return null; }
    const ημν = new Date(y, m - 1, d);
    if (ημν.getMonth() !== m - 1 || ημν > new Date()) { συν.disabled = true; σφ.textContent = "Η ημερομηνία δεν είναι έγκυρη."; return null; }
    συν.disabled = false; σφ.textContent = ""; return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`; };
  [ημ, μη, ετ].forEach(s => s.onchange = έλεγχος);
  const συν = el("button", { class: "κουμπί", type: "button", onclick: () => { const v = έλεγχος(); if (v) { Ροή.εξεταζόμενος.ημ_γέννησης = v; αποθήκευσε_πρόχειρο(); επόμενη(); } } }, "Συνέχεια ›");
  $("υποσέλιδο").append(συν);
  έλεγχος();
}

function απόδοση_επιβεβαίωσης(σ) {
  const ο = $("οθόνη");
  const κ = ΚΟΙΝΕΣ.ταυτοποίηση.επιβεβαίωση.replace("{ημερομηνία}", ελλ_ημερομηνία(Ροή.εξεταζόμενος.ημ_γέννησης));
  ο.append(el("h1", { class: "ερώτηση" }, κ));
  $("φωνή").hidden = !Φωνή.διαθέσιμη(); $("φωνή").onclick = () => Φωνή.πες(κ, $("φωνή"));
  const λ = el("div", { class: "επιλογές" },
    el("button", { class: "επιλογή ναι", type: "button", onclick: () => setTimeout(επόμενη, 120) }, el("span", { class: "δείκτης" }, "✓"), el("span", { class: "σώμα" }, "ΝΑΙ, σωστά")),
    el("button", { class: "επιλογή όχι", type: "button", onclick: προηγούμενη }, el("span", { class: "δείκτης" }, "✕"), el("span", { class: "σώμα" }, "ΟΧΙ, να τη διορθώσω")));
  ο.append(λ);
}

function απόδοση_εργαστηριακών(σ) {
  const ο = απόδοση_ερώτησης(σ);
  const τρέχ = τρέχουσα_τιμή(σ) || {};
  const πεδία = {};
  const πλ = el("div", { class: "πλέγμα" });
  for (const π of σ.πεδία) {
    const inp = π.τύπος === "ημερομηνία" ? el("input", { type: "date", value: τρέχ[π.κλειδί] || "", max: σήμερα_iso() })
      : el("input", { type: "number", inputmode: "decimal", min: π.ελάχιστο, max: π.μέγιστο, value: τρέχ[π.κλειδί] ?? "", placeholder: π.μονάδα || "" });
    πεδία[π.κλειδί] = inp;
    πλ.append(el("div", { class: "πεδίο" }, el("label", {}, π.κείμενο + (π.μονάδα ? ` (${π.μονάδα})` : "")), inp));
  }
  ο.append(πλ);
  $("υποσέλιδο").append(el("button", { class: "κουμπί", type: "button", onclick: () => {
    const v = {}; for (const [k, inp] of Object.entries(πεδία)) v[k] = inp.value === "" ? null : (inp.type === "number" ? Number(inp.value) : inp.value);
    απάντησε(σ, v); } }, "Συνέχεια ›"));
}

// ------------------------------------------------------------------ συναρμολόγηση JSON εξόδου
function θέσε(obj, διαδρομή, τιμή) {
  const μέρη = διαδρομή.split(".");
  let o = obj;
  for (let i = 0; i < μέρη.length - 1; i++) {
    const k = μέρη[i];
    if (o[k] === false) return;                                   // γονέας ρητά «όχι» → δεν ανοίγει υποδομή
    if (o[k] === null || o[k] === undefined || o[k] === true) o[k] = {};
    if (typeof o[k] !== "object") return;
    o = o[k];
  }
  o[μέρη[μέρη.length - 1]] = τιμή;
}

function συναρμολόγηση() {
  const ε = ΕΡΩΤΗΣΕΙΣ[Ροή.είδος];
  const κοινά = {}, ειδικά = {};
  for (const σ of Ροή.οθόνες) {
    if (!σ.έξοδος) continue;
    const στόχος = σ._κοινή ? κοινά : ειδικά;
    const ορ = ισχύει(σ.όταν);
    const v = ορ ? (σ.κωδικός in Ροή.απαντήσεις ? Ροή.απαντήσεις[σ.κωδικός] : null) : null;
    if (σ.έξοδος.endsWith(".*")) {
      const βάση = σ.έξοδος.slice(0, -2);
      for (const e of σ.επιλογές) { if (e.αποκλειστικό) continue; if (e.όταν && !ισχύει(e.όταν)) { θέσε(στόχος, `${βάση}.${e.τιμή}`, null); continue; }
        θέσε(στόχος, `${βάση}.${e.τιμή}`, ορ ? Array.isArray(v) && v.includes(e.τιμή) : null); }
    } else θέσε(στόχος, σ.έξοδος, v);
  }
  // ομάδες που δεν ρωτήθηκαν καθόλου → null
  for (const k of Object.keys(ειδικά)) if (ειδικά[k] && typeof ειδικά[k] === "object" && !Array.isArray(ειδικά[k]) && Object.values(ειδικά[k]).every(x => x === null)) ειδικά[k] = null;
  // σκορ και παράγωγα
  if (Ροή.είδος === "οστική") {
    const α = (ειδικά["FES-I"] || {}).απαντήσεις; const λ = α ? Object.keys(α).sort((x, y) => x - y).map(k => α[k]) : [];
    ειδικά["FES-I"] = λ.length ? { απαντήσεις: λ, σκορ: λ.every(x => typeof x === "number") ? λ.reduce((s, x) => s + x, 0) : null } : null;
    const ι = ειδικά.ιστορικό || {};
    const δο = ε.δευτερογενής_οστεοπόρωση;
    const γ1 = (ειδικά.γυναικολογικό || {}).Γ1;
    const δευτερογενής = δο.νοσήματα.some(k => ι[k] === true) || (δο.ΣΔ_τύπου_1 && ι.Δ1 && ι.Δ1.τύπος === 1) || (typeof γ1 === "number" && γ1 < δο.πρώιμη_εμμηνόπαυση_κάτω);
    ι.Ι07_παράγωγο = δευτερογενής;
    ειδικά.FRAX_είσοδος = {
      previous_fracture: ι.Ι02 === true, parent_hip: ι.Ι03 === true, smoking: ι.Ι04 === true, glucocorticoids: ι.Ι05 === true,
      rheumatoid_arthritis: ι.Ι06 === true, secondary_osteoporosis: δευτερογενής, alcohol: ι.Ι08 === true,
      menopause_age: typeof γ1 === "number" ? γ1 : null,
    };
  } else {
    const α = (ειδικά["SARC-F"] || {}).απαντήσεις; const λ = α ? Object.keys(α).sort((x, y) => x - y).map(k => α[k]) : [];
    ειδικά["SARC-F"] = λ.length ? { απαντήσεις: λ, σκορ: λ.every(x => typeof x === "number") ? λ.reduce((s, x) => s + x, 0) : null } : null;
    if (!("μετρήσεις" in ειδικά)) ειδικά.μετρήσεις = null;
  }
  const εγγ = {
    σχήμα: ΣΧΗΜΑ, είδος: Ροή.είδος, αναγνωριστικό: Ροή.αναγνωριστικό, έκδοση: 1, εφαρμογή: ΕΚΔΟΣΗ_ΕΦΑΡΜΟΓΗΣ, συσκευή: συσκευή(),
    έναρξη: Ροή.έναρξη, ολοκλήρωση: τώρα_iso(), ημ_εξέτασης: σήμερα_iso(),
    συμπλήρωση: { από: Ροή.συμπλήρωση },
    εξεταζόμενος: { ημ_γέννησης: Ροή.εξεταζόμενος.ημ_γέννησης, φύλο: Ροή.εξεταζόμενος.φύλο },
    ...κοινά,
  };
  εγγ[Ροή.είδος] = ειδικά;
  return εγγ;
}

async function ολοκλήρωση() {
  const δεδομένα = συναρμολόγηση();
  const εγγ = { αναγνωριστικό: δεδομένα.αναγνωριστικό, είδος: δεδομένα.είδος, κατάσταση: "εκκρεμές", ολοκλήρωση: δεδομένα.ολοκλήρωση, εξαγωγή: null, παρτίδα: null, δεδομένα };
  await Αποθήκη.βάλε(εγγ);
  await Αποθήκη.πρόχειρο_σβήσε();
  Ροή = null;
  τέλος(εγγ);
}

// ------------------------------------------------------------------ οθόνη τέλους
let χρονόμετρο_επιστροφής = null;
function τέλος(εγγ) {
  καθάρισε(); κεφαλίδα("", 1, null, ΚΟΙΝΕΣ.τέλος.εκφώνηση);
  const ο = $("οθόνη");
  ο.append(el("div", { class: "τέλος" }, el("div", { class: "εικονίδιο" }, "✓"), el("h1", {}, ΚΟΙΝΕΣ.τέλος.τίτλος), el("p", {}, ΚΟΙΝΕΣ.τέλος.κείμενο)));
  $("υποσέλιδο").append(
    el("button", { class: "κουμπί δευτερεύον", type: "button", onclick: () => { clearTimeout(χρονόμετρο_επιστροφής); οθόνη_προσωπικού(εγγ.αναγνωριστικό); } }, ΚΟΙΝΕΣ.τέλος.κουμπί_προσωπικού),
    el("button", { class: "κουμπί", type: "button", onclick: () => { clearTimeout(χρονόμετρο_επιστροφής); αρχική(); } }, "Αρχική"));
  clearTimeout(χρονόμετρο_επιστροφής);
  χρονόμετρο_επιστροφής = setTimeout(αρχική, (ΚΟΙΝΕΣ.τέλος.επιστροφή_δευτερόλεπτα || 20) * 1000);
}

// ------------------------------------------------------------------ οθόνες προσωπικού
async function οθόνη_προσωπικού(id) {
  const εγγ = await Αποθήκη.πάρε(id);
  if (!εγγ) return αρχική();
  if (εγγ.είδος === "οστική") σύνοψη_χειριστή(εγγ); else μετρήσεις_προσωπικού(εγγ);
}

function σύνοψη_χειριστή(εγγ) {
  καθάρισε(); κεφαλίδα_προσωπικού(ΕΡΩΤΗΣΕΙΣ.οστική.σύνοψη_χειριστή.τίτλος);
  const δ = εγγ.δεδομένα, ο = $("οθόνη"), fx = δ.οστική.FRAX_είσοδος, ι = δ.οστική.ιστορικό || {};
  ο.append(el("p", { class: "μικρό" }, `Ημ. γέννησης ${ελλ_ημερομηνία(δ.εξεταζόμενος.ημ_γέννησης)} · ${δ.εξεταζόμενος.φύλο === "Γ" ? "Γυναίκα" : "Άνδρας"} · ${ηλικία_από(δ.εξεταζόμενος.ημ_γέννησης)} ετών · ολοκλήρωση ${ώρα_κείμενο(δ.ολοκλήρωση)}`));
  const πίν = el("table", { class: "πίνακας" }, el("tr", {}, el("th", {}, "Πεδίο Hologic"), el("th", {}, "Τιμή"), el("th", {}, "Σημείωση")));
  const σημ = { glucocorticoids: ι.Ι05 ? [ι.Ι05α, ι.Ι05β, ι.Ι05γ && `δόση ${ι.Ι05γ}`].filter(Boolean).join(", ") : "", previous_fracture: ι.Ι02 ? [ι.Ι02α && `${ι.Ι02α}${ι.Ι02α === 3 ? "+" : ""} κατάγματα`, ι.Ι02β === true && "πρόσφατο < 2 έτη"].filter(Boolean).join(", ") : "",
    secondary_osteoporosis: fx.secondary_osteoporosis ? "από νοσήματα / ΣΔ1 / εμμηνόπαυση < 45" : "" };
  for (const π of ΕΡΩΤΗΣΕΙΣ.οστική.σύνοψη_χειριστή.πεδία) {
    const v = fx[π.κλειδί];
    const κείμ = v === true ? "ΝΑΙ" : v === false ? "ΟΧΙ" : v === null || v === undefined ? "—" : String(v);
    πίν.append(el("tr", {}, el("td", {}, π.κείμενο), el("td", { class: v === true ? "ναι" : "όχι" }, κείμ), el("td", { class: "μικρό" }, σημ[π.κλειδί] || "")));
  }
  const fes = δ.οστική["FES-I"];
  πίν.append(el("tr", {}, el("td", {}, "FES-I"), el("td", {}, fes && fes.σκορ !== null ? String(fes.σκορ) : "—"), el("td", { class: "μικρό" }, "16–19 μικρού · 20–27 μετρίου · 28–64 σημαντικού βαθμού")));
  πίν.append(el("tr", {}, el("td", {}, "Πτώσεις 12μ"), el("td", {}, δ.οστική.πτώσεις_12μ === null ? "—" : String(δ.οστική.πτώσεις_12μ) + (δ.οστική.πτώσεις_12μ === 3 ? "+" : "")), el("td", {})));
  if (ι.Δ1 && typeof ι.Δ1 === "object") πίν.append(el("tr", {}, el("td", {}, "Σακχαρώδης διαβήτης"), el("td", {}, `τύπου ${ι.Δ1.τύπος ?? "?"}`), el("td", { class: "μικρό" }, ι.Δ1.έτη !== null && ι.Δ1.έτη !== undefined ? `${ι.Δ1.έτη} έτη` : "")));
  const εμφ = (δ.πριν_την_εξέταση || {}).εμφυτεύματα || [];
  πίν.append(el("tr", {}, el("td", {}, "Εμφυτεύματα"), el("td", {}, εμφ.length ? εμφ.join(", ") : "κανένα"), el("td", { class: "μικρό" }, (δ.πριν_την_εξέταση || {}).σκιαγραφικό_14ημ === true ? "⚠ σκιαγραφικό 14 ημ." : "")));
  ο.append(πίν);
  $("υποσέλιδο").append(el("button", { class: "κουμπί", type: "button", onclick: αρχική }, "Ολοκλήρωση"));
}

function κεφαλίδα_προσωπικού(τίτλος) { κεφαλίδα(τίτλος, null, αρχική, null); $("πίσω").textContent = "‹ Αρχική"; }

function μετρήσεις_προσωπικού(εγγ) {
  καθάρισε(); κεφαλίδα_προσωπικού(ΕΡΩΤΗΣΕΙΣ.λιπομέτρηση.μετρήσεις_προσωπικού.τίτλος);
  const Μ = ΕΡΩΤΗΣΕΙΣ.λιπομέτρηση.μετρήσεις_προσωπικού, ο = $("οθόνη"), δ = εγγ.δεδομένα;
  const τρέχ = (δ.λιπομέτρηση && δ.λιπομέτρηση.μετρήσεις) || {};
  ο.append(el("p", { class: "μικρό" }, `Ημ. γέννησης ${ελλ_ημερομηνία(δ.εξεταζόμενος.ημ_γέννησης)} · ${δ.εξεταζόμενος.φύλο === "Γ" ? "Γυναίκα" : "Άνδρας"} · ${ηλικία_από(δ.εξεταζόμενος.ημ_γέννησης)} ετών. ${Μ.οδηγία}`));
  const αρ = (v, min, max, ph) => el("input", { type: "number", inputmode: "decimal", step: "0.1", min, max, value: v ?? "", placeholder: ph || "" });
  // μέση
  ο.append(el("h2", { class: "υποτίτλος" }, Μ.μέση.τίτλος), el("p", { class: "μικρό" }, Μ.μέση.βοήθεια));
  const μ = [0, 1, 2].map(i => αρ((τρέχ.μέση_cm || {}).μετρήσεις?.[i], Μ.μέση.ελάχιστο, Μ.μέση.μέγιστο, i === 2 ? "αν > 1 cm" : ""));
  const μ_απ = el("div", { class: "αποτέλεσμα" });
  ο.append(el("div", { class: "πλέγμα" }, ...μ.map((x, i) => el("div", { class: "πεδίο" }, el("label", {}, `${i + 1}η μέτρηση`), x))), μ_απ);
  // χειρολαβή
  ο.append(el("h2", { class: "υποτίτλος" }, Μ.χειρολαβή.τίτλος), el("p", { class: "μικρό" }, Μ.χειρολαβή.βοήθεια));
  const χ = τρέχ.χειρολαβή || {};
  const επικ = el("select", {}, el("option", { value: "" }, "—"), ...Μ.χειρολαβή.επικρατούν.επιλογές.map(e => el("option", { value: e.τιμή, selected: χ.επικρατούν === e.τιμή }, e.κείμενο)));
  const θέση = el("select", {}, el("option", { value: "" }, "—"), ...Μ.χειρολαβή.θέση_λαβής.επιλογές.map(e => el("option", { value: e, selected: χ.θέση_λαβής === e }, e)));
  let όργανο_προεπ = ""; try { όργανο_προεπ = localStorage.getItem("όργανο_χειρολαβής") || ""; } catch {}
  const όργανο = el("input", { type: "text", value: χ.όργανο || όργανο_προεπ });
  ο.append(el("div", { class: "πλέγμα" }, el("div", { class: "πεδίο" }, el("label", {}, Μ.χειρολαβή.επικρατούν.κείμενο), επικ), el("div", { class: "πεδίο" }, el("label", {}, Μ.χειρολαβή.θέση_λαβής.κείμενο), θέση), el("div", { class: "πεδίο" }, el("label", {}, Μ.χειρολαβή.όργανο.κείμενο), όργανο)));
  const ΔΕ = [0, 1, 2].map(i => αρ(χ.ΔΕ?.[i], Μ.χειρολαβή.ελάχιστο, Μ.χειρολαβή.μέγιστο)), ΑΡ = [0, 1, 2].map(i => αρ(χ.ΑΡ?.[i], Μ.χειρολαβή.ελάχιστο, Μ.χειρολαβή.μέγιστο));
  const χ_απ = el("div", { class: "αποτέλεσμα" });
  ο.append(el("div", { class: "πλέγμα" }, ...ΔΕ.map((x, i) => el("div", { class: "πεδίο" }, el("label", {}, `Δεξί ${i + 1}η`), x))),
    el("div", { class: "πλέγμα", style: "margin-top:12px" }, ...ΑΡ.map((x, i) => el("div", { class: "πεδίο" }, el("label", {}, `Αριστερό ${i + 1}η`), x))), χ_απ);
  const δεν = el("input", { type: "text", value: χ.δεν_μετρήθηκε || "" });
  ο.append(el("div", { class: "πεδίο", style: "margin-top:12px" }, el("label", {}, Μ.χειρολαβή.δεν_μετρήθηκε.κείμενο), δεν));
  // ΑΠ
  ο.append(el("h2", { class: "υποτίτλος" }, Μ.ΑΠ.τίτλος), el("p", { class: "μικρό" }, Μ.ΑΠ.βοήθεια));
  const απ = τρέχ.ΑΠ || {};
  const Σ = [0, 1, 2].map(i => αρ(απ.μετρήσεις?.[i]?.[0], Μ.ΑΠ.ελάχιστο_Σ, Μ.ΑΠ.μέγιστο_Σ, "συστ.")), Δ = [0, 1, 2].map(i => αρ(απ.μετρήσεις?.[i]?.[1], Μ.ΑΠ.ελάχιστο_Δ, Μ.ΑΠ.μέγιστο_Δ, "διαστ."));
  const απ_απ = el("div", { class: "αποτέλεσμα" });
  ο.append(el("div", { class: "πλέγμα" }, ...[0, 1, 2].map(i => el("div", { class: "πεδίο" }, el("label", {}, `${i + 1}η μέτρηση`), el("div", { style: "display:flex;gap:8px" }, Σ[i], Δ[i])))), απ_απ);

  const ν = (inp) => inp.value === "" ? null : Number(inp.value);
  const υπολόγισε = () => {
    const μv = μ.map(ν).filter(x => x !== null);
    let μέσος = null; if (μv.length >= 2) { const s = [...μv].sort((a, b) => a - b); let ζ = [s[0], s[1]]; for (let i = 0; i + 1 < s.length; i++) if (s[i + 1] - s[i] < ζ[1] - ζ[0]) ζ = [s[i], s[i + 1]]; μέσος = Math.round((ζ[0] + ζ[1]) / 2 * 10) / 10; } else if (μv.length === 1) μέσος = μv[0];
    μ_απ.textContent = μέσος !== null ? `Μέσος όρος: ${μέσος} cm` : "";
    const όλα = [...ΔΕ, ...ΑΡ].map(ν).filter(x => x !== null); const μέγ = όλα.length ? Math.max(...όλα) : null;
    χ_απ.textContent = μέγ !== null ? `Μέγιστη: ${μέγ} kg` : "";
    const ζεύγη = [0, 1, 2].map(i => [ν(Σ[i]), ν(Δ[i])]).filter(z => z[0] !== null && z[1] !== null);
    const μέσοςΑΠ = ζεύγη.length ? [Math.round(ζεύγη.reduce((s, z) => s + z[0], 0) / ζεύγη.length), Math.round(ζεύγη.reduce((s, z) => s + z[1], 0) / ζεύγη.length)] : null;
    απ_απ.textContent = μέσοςΑΠ ? `Μέσος όρος: ${μέσοςΑΠ[0]}/${μέσοςΑΠ[1]} mmHg` : "";
    return { μέσος, μv, μέγ, ζεύγη, μέσοςΑΠ };
  };
  [...μ, ...ΔΕ, ...ΑΡ, ...Σ, ...Δ].forEach(i => i.oninput = υπολόγισε);
  υπολόγισε();
  const αποθήκευση = async () => {
    const r = υπολόγισε();
    const χειρ = (r.μέγ !== null || δεν.value) ? { επικρατούν: επικ.value || null, θέση_λαβής: θέση.value ? Number(θέση.value) : null, όργανο: όργανο.value || null, ΔΕ: ΔΕ.map(ν), ΑΡ: ΑΡ.map(ν), μέγιστη: r.μέγ, δεν_μετρήθηκε: δεν.value || null } : null;
    const μετρήσεις = (r.μέσος !== null || χειρ || r.μέσοςΑΠ) ? { από: "γραμματεία", ώρα: τώρα_iso(), μέση_cm: r.μέσος !== null ? { μετρήσεις: r.μv, μέσος: r.μέσος } : null, χειρολαβή: χειρ, ΑΠ: r.μέσοςΑΠ ? { μετρήσεις: r.ζεύγη, μέσος: r.μέσοςΑΠ } : null } : null;
    try { if (όργανο.value) localStorage.setItem("όργανο_χειρολαβής", όργανο.value); } catch {}
    εγγ.δεδομένα.λιπομέτρηση.μετρήσεις = μετρήσεις;
    if (εγγ.κατάσταση === "εξήχθη") { εγγ.δεδομένα.έκδοση = (εγγ.δεδομένα.έκδοση || 1) + 1; εγγ.κατάσταση = "εκκρεμές"; εγγ.εξαγωγή = null; εγγ.παρτίδα = null; }
    await Αποθήκη.βάλε(εγγ);
    αρχική();
  };
  $("υποσέλιδο").append(el("button", { class: "κουμπί δευτερεύον", type: "button", onclick: αρχική }, "Παράλειψη"), el("button", { class: "κουμπί", type: "button", onclick: αποθήκευση }, "Αποθήκευση"));
}

// ------------------------------------------------------------------ Αποστολές
async function αποστολές() {
  καθάρισε(); κεφαλίδα_προσωπικού(ΚΟΙΝΕΣ.αποστολές.τίτλος);
  const Α = ΚΟΙΝΕΣ.αποστολές, ο = $("οθόνη");
  const όλα = (await Αποθήκη.όλα()).sort((a, b) => (b.ολοκλήρωση || "").localeCompare(a.ολοκλήρωση || ""));
  const εκκρεμή = όλα.filter(x => x.κατάσταση === "εκκρεμές"), εξαχθ = όλα.filter(x => x.κατάσταση === "εξήχθη");
  const γραμμή = (x) => {
    const δ = x.δεδομένα;
    const g = el("div", { class: "γραμμή" + (x.κατάσταση === "εξήχθη" ? " εξήχθη" : "") },
      el("span", { class: "είδος" }, x.είδος === "οστική" ? "Οστική πυκνότητα" : "Λιπομέτρηση"),
      el("span", { class: "στοιχεία" }, `γεν. ${ελλ_ημερομηνία(δ.εξεταζόμενος.ημ_γέννησης)} · ${δ.εξεταζόμενος.φύλο} · ${δ.ημ_εξέτασης} ${ώρα_κείμενο(δ.ολοκλήρωση)}` + (δ.έκδοση > 1 ? ` · έκδ. ${δ.έκδοση}` : "") + (x.κατάσταση === "εξήχθη" ? ` · εξήχθη ${x.εξαγωγή ? x.εξαγωγή.slice(0, 16).replace("T", " ") : ""}` : "")
        + (x.είδος === "λιπομέτρηση" ? (δ.λιπομέτρηση.μετρήσεις ? " · μετρήσεις ✓" : " · χωρίς μετρήσεις") : "")));
    g.append(el("button", { class: "μικρό-κουμπί", type: "button", onclick: () => οθόνη_προσωπικού(x.αναγνωριστικό) }, x.είδος === "οστική" ? "FRAX" : "Μετρήσεις"));
    if (x.κατάσταση === "εξήχθη") g.append(el("button", { class: "μικρό-κουμπί", type: "button", onclick: async () => { x.κατάσταση = "εκκρεμές"; x.εξαγωγή = null; await Αποθήκη.βάλε(x); αποστολές(); } }, "Ξανά"));
    return g;
  };
  ο.append(el("h2", { class: "υποτίτλος" }, `${Α.εκκρεμή} (${εκκρεμή.length})`));
  ο.append(εκκρεμή.length ? el("div", { class: "λίστα" }, ...εκκρεμή.map(γραμμή)) : el("p", { class: "κενό" }, Α.κενό));
  if (εκκρεμή.length) {
    ο.append(el("p", { class: "μικρό" }, Α.οδηγία));
    const κ = el("button", { class: "κουμπί πλήρες", type: "button" }, Α.κουμπί_εξαγωγή + (navigator.canShare ? "" : " (λήψη)"));
    κ.onclick = () => εξαγωγή(εκκρεμή, κ);
    ο.append(κ);
  }
  ο.append(el("h2", { class: "υποτίτλος" }, `${Α.εξαχθέντα} (${εξαχθ.length})`));
  ο.append(εξαχθ.length ? el("div", { class: "λίστα" }, ...εξαχθ.map(γραμμή)) : el("p", { class: "κενό" }, "—"));
  const σ = el("input", { type: "text", value: συσκευή(), style: "max-width:320px" });
  σ.onchange = () => { try { localStorage.setItem("συσκευή", σ.value || "iPad υποδοχής"); } catch {} };
  ο.append(el("div", { class: "πεδίο", style: "margin-top:26px" }, el("label", {}, `Όνομα συσκευής · εφαρμογή ${ΕΚΔΟΣΗ_ΕΦΑΡΜΟΓΗΣ}`), σ));
}

async function εξαγωγή(εκκρεμή, κουμπί) {
  const d = new Date();
  const παρτίδα = `${σήμερα_iso()}_${String(d.getHours()).padStart(2, "0")}${String(d.getMinutes()).padStart(2, "0")}`;
  const όνομα = `ερωτηματολόγια_${παρτίδα}.json`;
  const περιεχόμενο = JSON.stringify({ σχήμα: ΣΧΗΜΑ, παρτίδα, συσκευή: συσκευή(), εφαρμογή: ΕΚΔΟΣΗ_ΕΦΑΡΜΟΓΗΣ, εξαγωγή: τώρα_iso(), ερωτηματολόγια: εκκρεμή.map(x => x.δεδομένα) }, null, 1);
  const αρχείο = new File([περιεχόμενο], όνομα, { type: "application/json" });
  κουμπί.disabled = true;
  let επιτυχία = false;
  try {
    if (navigator.canShare && navigator.canShare({ files: [αρχείο] })) {
      await navigator.share({ files: [αρχείο], title: όνομα });
      επιτυχία = true;
    } else {
      const a = el("a", { href: URL.createObjectURL(new Blob([περιεχόμενο], { type: "application/json" })), download: όνομα }); document.body.append(a); a.click(); a.remove();
      επιτυχία = confirm("Αποθηκεύτηκε το αρχείο; Πατήστε OK για να σημανθούν ως εξαχθέντα.");
    }
  } catch (e) { επιτυχία = false; /* ακύρωση από τον χρήστη ή σφάλμα: τίποτε δεν αλλάζει */ }
  if (επιτυχία) { const ώρα = τώρα_iso(); for (const x of εκκρεμή) { x.κατάσταση = "εξήχθη"; x.εξαγωγή = ώρα; x.παρτίδα = παρτίδα; await Αποθήκη.βάλε(x); } }
  αποστολές();
}

async function εκκαθάριση() {
  const όρι = Date.now() - ΗΜΕΡΕΣ_ΔΙΑΤΗΡΗΣΗΣ * 86400000;
  for (const x of await Αποθήκη.όλα()) if (x.κατάσταση === "εξήχθη" && x.εξαγωγή && new Date(x.εξαγωγή).getTime() < όρι) await Αποθήκη.σβήσε(x.αναγνωριστικό);
}

// ------------------------------------------------------------------ αρχική
async function αρχική() {
  Ροή = null; clearTimeout(χρονόμετρο_επιστροφής);
  καθάρισε(); κεφαλίδα("", null, null, null); $("πίσω").textContent = "‹ Πίσω";
  const Ε = ΚΟΙΝΕΣ.εφαρμογή, ο = $("οθόνη");
  const α = el("div", { class: "αρχική" }, el("h1", {}, Ε.τίτλος), el("p", { class: "υπό" }, Ε.υπότιτλος));
  const πρόχ = await Αποθήκη.πρόχειρο_πάρε().catch(() => null);
  if (πρόχ && πρόχ.είδος) α.append(el("div", { class: "ειδοποίηση" }, el("span", { style: "flex:1" }, `Υπάρχει ημιτελές ερωτηματολόγιο (${πρόχ.είδος === "οστική" ? "οστική πυκνότητα" : "λιπομέτρηση"}).`),
    el("button", { class: "κουμπί", type: "button", onclick: () => συνέχισε_πρόχειρο(πρόχ) }, "Συνέχεια"),
    el("button", { class: "κουμπί προσοχή", type: "button", onclick: async () => { await Αποθήκη.πρόχειρο_σβήσε(); αρχική(); } }, "Διαγραφή")));
  for (const κ of Ε.κουμπιά) α.append(el("button", { class: "κάρτα-κουμπί", type: "button", onclick: () => ξεκίνα(κ.είδος) }, el("span", { class: "τίτλος" }, κ.κείμενο), el("span", { class: "περιγραφή" }, κ.περιγραφή)));
  const εκκρεμή = (await Αποθήκη.όλα().catch(() => [])).filter(x => x.κατάσταση === "εκκρεμές").length;
  α.append(el("div", { class: "αρχική-υποσέλιδο" },
    el("span", { class: "μικρό" }, navigator.onLine ? "" : "Χωρίς σύνδεση — η εφαρμογή λειτουργεί κανονικά."),
    el("button", { class: "σύνδεσμος", type: "button", onclick: αποστολές }, ΚΟΙΝΕΣ.αποστολές.τίτλος, εκκρεμή ? el("span", { class: "σήμα" }, εκκρεμή) : null)));
  ο.append(α);
}

// ------------------------------------------------------------------ εκκίνηση
(async () => {
  try { await φόρτωσε_ερωτήσεις(); }
  catch (e) { $("οθόνη").append(el("p", { class: "σφάλμα" }, "Δεν φορτώθηκαν οι ερωτήσεις. Ελέγξτε τη σύνδεση και ανοίξτε ξανά την εφαρμογή.")); return; }
  await εκκαθάριση().catch(() => {});
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
  αρχική();
})();
