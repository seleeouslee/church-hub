// Church Hub — GitHub Pages + Firebase Firestore (free Spark plan)
// Firebase project: church-hub (church-hub-5fdf1)
// NOTE: this apiKey is a public client key by design — it identifies the
// project in the browser and does NOT grant access to the Google account.

const firebaseConfig = {
  apiKey: "AIzaSyCgs2ZmCrxK0VFl8UGc7YSioMi3v6mqRGM",
  authDomain: "church-hub-5fdf1.firebaseapp.com",
  projectId: "church-hub-5fdf1",
  storageBucket: "church-hub-5fdf1.firebasestorage.app",
  messagingSenderId: "480573094478",
  appId: "1:480573094478:web:6faa550d74e01449f2211f"
};

const COLLECTIONS = ["people", "teams", "events", "worshipPlans", "smallGroups", "volunteerNeeds", "volunteerSignups"];
const data = { people: [], teams: [], events: [], worshipPlans: [], smallGroups: [], volunteerNeeds: [], volunteerSignups: [] };
let db = null;
let auth = null;
let currentUser = null;
let isEditor = false;
let editors = [];
let adminsUnsub = null;
let editing = null; // { coll: "people"|"teams", id } while an inline edit form is open

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const todayISO = () => new Date().toISOString().slice(0, 10);
const fmtDate = (d) => {
  if (!d) return "";
  const dt = new Date(d + "T12:00:00");
  return isNaN(dt) ? d : dt.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", year: "numeric" });
};

function setStatus(state, text) {
  $("status-dot").className = "dot " + state;
  $("status-text").textContent = text;
}
function showError(msg) {
  const b = $("error-banner");
  b.textContent = msg;
  b.classList.remove("hidden");
}

// ---- Sign-in (Google) + editor check ----
// Editors are the docs in the "admins" collection (doc id = editor's email).
// Everyone can view; only editors can add/change/remove items.
// Volunteering signup stays open to everyone, signed in or not.
function updateAuthUI() {
  if (currentUser) {
    $("auth-text").textContent = "Signed in as " + currentUser.email + (isEditor ? " (editor)" : " — not an editor");
    $("btn-signin").classList.add("hidden");
    $("btn-signout").classList.remove("hidden");
  } else {
    $("auth-text").textContent = "Not signed in — anyone can view, and anyone can sign up to volunteer.";
    $("btn-signin").classList.remove("hidden");
    $("btn-signout").classList.add("hidden");
  }
}
function setEditor(v) {
  isEditor = v;
  document.body.classList.toggle("is-editor", v);
  updateAuthUI();
}
function renderEditors() {
  $("list-editors").innerHTML = editors.map((email) => `
    <li>
      <button class="remove" data-delete="admins" data-id="${esc(email)}">Remove</button>
      <div class="title">${esc(email)}</div>
    </li>`).join("") || '<li class="muted">No editors yet.</li>';
}

// ---- Tabs ----
document.querySelectorAll("#tabs button").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll("#tabs button").forEach((b) => b.classList.remove("active"));
    document.querySelectorAll(".tab").forEach((t) => t.classList.remove("active"));
    btn.classList.add("active");
    $("tab-" + btn.dataset.tab).classList.add("active");
  });
});

// ---- Firebase init ----
try {
  if (typeof firebase === "undefined") throw new Error("Firebase SDK failed to load. Check your connection and reload.");
  firebase.initializeApp(firebaseConfig);
  db = firebase.firestore();
  setStatus("on", "Connected — shared live");

  auth = firebase.auth();
  $("btn-signin").addEventListener("click", () => {
    auth.signInWithPopup(new firebase.auth.GoogleAuthProvider())
      .catch((err) => showError("Sign-in failed: " + err.message));
  });
  $("btn-signout").addEventListener("click", () => auth.signOut());
  auth.onAuthStateChanged((user) => {
    currentUser = user;
    updateAuthUI();
    if (adminsUnsub) { adminsUnsub(); adminsUnsub = null; }
    if (user) {
      db.collection("admins").doc(user.email).get()
        .then((snap) => {
          setEditor(snap.exists);
          if (snap.exists) {
            adminsUnsub = db.collection("admins").onSnapshot((s) => {
              editors = s.docs.map((d) => d.id);
              renderEditors();
            }, () => {});
          }
        })
        .catch(() => setEditor(false));
    } else {
      setEditor(false);
    }
  });
} catch (e) {
  setStatus("err", "Not connected");
  showError("Could not connect to the shared database: " + e.message);
}

// ---- Live listeners ----
if (db) {
  COLLECTIONS.forEach((coll) => {
    db.collection(coll).onSnapshot((snap) => {
      data[coll] = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      renderAll();
    }, (err) => {
      setStatus("err", "Connection error");
      showError("Database error (" + coll + "): " + err.message);
    });
  });
}

// ---- Delete (event delegation) — editors only ----
document.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-delete]");
  if (!btn || !db) return;
  if (!isEditor) { showError("Only signed-in editors can remove items."); return; }
  if (!confirm("Delete this?")) return;
  db.collection(btn.dataset.delete).doc(btn.dataset.id).delete()
    .catch((err) => showError("Could not delete: " + err.message));
});

// ---- Form helper ----
function handleForm(formId, coll, fields) {
  const form = $(formId);
  if (!form) return;
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    if (!db) { showError("Not connected to the database yet."); return; }
    if (!isEditor) { showError("Only signed-in editors can add items."); return; }
    const doc = { createdAt: firebase.firestore.FieldValue.serverTimestamp() };
    fields.forEach((f) => {
      const el = form.elements[f];
      if (el) doc[f] = f === "spots" ? parseInt(el.value, 10) || 0 : el.value.trim();
    });
    db.collection(coll).add(doc)
      .then(() => form.reset())
      .catch((err) => showError("Could not save: " + err.message));
  });
}

handleForm("form-person", "people", ["name", "phone", "email", "team", "role"]);
handleForm("form-team", "teams", ["name", "leader", "area", "members"]);
handleForm("form-event", "events", ["title", "date", "time", "location", "team"]);
handleForm("form-worship", "worshipPlans", ["date", "service", "leader", "team", "songs"]);
handleForm("form-group", "smallGroups", ["name", "leader", "meeting", "location", "members"]);
handleForm("form-need", "volunteerNeeds", ["title", "event", "spots", "contact"]);

// Add an editor (editors only; doc id is the editor's Google email)
$("form-editor").addEventListener("submit", (e) => {
  e.preventDefault();
  if (!db) { showError("Not connected to the database yet."); return; }
  if (!isEditor) { showError("Only signed-in editors can add editors."); return; }
  const email = e.target.elements["email"].value.trim().toLowerCase();
  if (!email) return;
  db.collection("admins").doc(email).set({ email })
    .then(() => e.target.reset())
    .catch((err) => showError("Could not add editor: " + err.message));
});

// Volunteer signup: records which need it is for, and adds the volunteer
// to People (once — skipped if the name or email is already listed).
$("form-signup").addEventListener("submit", (e) => {
  e.preventDefault();
  if (!db) { showError("Not connected to the database yet."); return; }
  const form = e.target;
  const needId = form.elements["needId"].value;
  const need = data.volunteerNeeds.find((n) => n.id === needId);
  const name = form.elements["name"].value.trim();
  const email = form.elements["email"].value.trim();
  const phone = form.elements["phone"].value.trim();
  db.collection("volunteerSignups").add({
    name,
    email,
    phone,
    needId,
    needTitle: need ? need.title : "",
    availability: form.elements["availability"].value.trim(),
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  }).then(() => {
    form.reset();
    const alreadyListed = data.people.some((p) => {
      if (email && p.email && p.email.trim().toLowerCase() === email.toLowerCase()) return true;
      return p.name && p.name.trim().toLowerCase() === name.toLowerCase();
    });
    if (!alreadyListed && name) {
      db.collection("people").add({
        name,
        email,
        phone,
        team: "",
        role: "Volunteer",
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      }).catch((err) => showError("Signed up, but could not add to People: " + err.message));
    }
  }).catch((err) => showError("Could not sign up: " + err.message));
});

// ---- Inline editing for people + teams (editors only) ----
const EDIT_FIELDS = {
  people: [
    { name: "name", type: "text", placeholder: "Full name", required: true },
    { name: "phone", type: "tel", placeholder: "Phone" },
    { name: "email", type: "email", placeholder: "Email" },
    { name: "team", type: "text", placeholder: "Team" },
    { name: "role", type: "text", placeholder: "Role" }
  ],
  teams: [
    { name: "name", type: "text", placeholder: "Team name", required: true },
    { name: "leader", type: "text", placeholder: "Leader" },
    { name: "area", type: "text", placeholder: "Area" },
    { name: "members", type: "text", placeholder: "Members (comma-separated)" }
  ]
};
function editFormHTML(coll, item) {
  const inputs = EDIT_FIELDS[coll].map((f) => {
    if (f.name === "team") {
      // Team picker: existing teams, plus the person's current team if it is gone
      const current = item.team || "";
      const options = ['<option value="">No team</option>']
        .concat(data.teams.map((t) => `<option value="${esc(t.name)}"${t.name === current ? " selected" : ""}>${esc(t.name)}</option>`));
      if (current && !data.teams.some((t) => t.name === current)) {
        options.push(`<option value="${esc(current)}" selected>${esc(current)}</option>`);
      }
      return `<select name="team">${options.join("")}</select>`;
    }
    return `
    <input name="${f.name}" type="${f.type}" placeholder="${f.placeholder}" value="${esc(item[f.name] || "")}"${f.required ? " required" : ""}>`;
  }).join("");
  return `<li><form data-edit-form="${coll}" data-id="${item.id}" class="edit-form">${inputs}<button type="submit">Save</button><button type="button" data-cancel-edit>Cancel</button></form></li>`;
}

// Start / cancel an inline edit
document.addEventListener("click", (e) => {
  const cancel = e.target.closest("[data-cancel-edit]");
  if (cancel) { editing = null; renderAll(); return; }
  const btn = e.target.closest("[data-edit]");
  if (!btn) return;
  if (!isEditor) { showError("Only signed-in editors can edit items."); return; }
  editing = { coll: btn.dataset.edit, id: btn.dataset.id };
  renderAll();
});

// Save an inline edit
document.addEventListener("submit", (e) => {
  const form = e.target.closest("[data-edit-form]");
  if (!form) return;
  e.preventDefault();
  if (!db) { showError("Not connected to the database yet."); return; }
  if (!isEditor) { showError("Only signed-in editors can edit items."); return; }
  const coll = form.dataset.editForm;
  const id = form.dataset.id;
  const doc = {};
  EDIT_FIELDS[coll].forEach((f) => {
    const el = form.elements[f.name];
    if (el) doc[f.name] = el.value.trim();
  });
  db.collection(coll).doc(id).update(doc)
    .then(() => { editing = null; renderAll(); })
    .catch((err) => showError("Could not save: " + err.message));
});

// ---- Rendering ----
function filledCount(needId) {
  return data.volunteerSignups.filter((s) => s.needId === needId).length;
}

function renderAll() {
  // Team picker when adding a person (teams created on the Teams tab)
  const teamSelect = $("person-team");
  if (teamSelect) {
    const prevTeam = teamSelect.value;
    teamSelect.innerHTML = '<option value="">No team</option>' +
      data.teams.map((t) => `<option value="${esc(t.name)}">${esc(t.name)}</option>`).join("");
    if ([...teamSelect.options].some((o) => o.value === prevTeam)) teamSelect.value = prevTeam;
  }

  // People
  $("count-people").textContent = data.people.length ? "(" + data.people.length + ")" : "";
  $("list-people").innerHTML = data.people.map((p) => {
    if (editing && editing.coll === "people" && editing.id === p.id) return editFormHTML("people", p);
    return `
    <li>
      <button class="remove" data-delete="people" data-id="${p.id}">Remove</button>
      <button class="edit-btn" data-edit="people" data-id="${p.id}">Edit</button>
      <div class="title">${esc(p.name)}</div>
      <div class="detail">${[p.role, p.team].filter(Boolean).map(esc).join(" · ")}</div>
      <div class="detail">${[p.phone, p.email].filter(Boolean).map(esc).join(" · ")}</div>
    </li>`;
  }).join("") || '<li class="muted">No people yet — add the first one above.</li>';

  // Teams
  $("count-teams").textContent = data.teams.length ? "(" + data.teams.length + ")" : "";
  $("list-teams").innerHTML = data.teams.map((t) => {
    if (editing && editing.coll === "teams" && editing.id === t.id) return editFormHTML("teams", t);
    return `
    <li>
      <button class="remove" data-delete="teams" data-id="${t.id}">Remove</button>
      <button class="edit-btn" data-edit="teams" data-id="${t.id}">Edit</button>
      <div class="title">${esc(t.name)}</div>
      <div class="detail">${[t.leader ? "Led by " + t.leader : "", t.area].filter(Boolean).map(esc).join(" · ")}</div>
      ${t.members ? `<div class="detail">Members: ${esc(t.members)}</div>` : ""}
    </li>`;
  }).join("") || '<li class="muted">No teams yet.</li>';

  // Events (soonest first)
  const events = [...data.events].sort((a, b) => (a.date || "").localeCompare(b.date || ""));
  $("count-events").textContent = data.events.length ? "(" + data.events.length + ")" : "";
  $("list-events").innerHTML = events.map((ev) => `
    <li>
      <button class="remove" data-delete="events" data-id="${ev.id}">Remove</button>
      <div class="title">${esc(ev.title)}</div>
      <div class="detail">${esc(fmtDate(ev.date))}${ev.time ? " · " + esc(ev.time) : ""}</div>
      <div class="detail">${[ev.location, ev.team].filter(Boolean).map(esc).join(" · ")}</div>
    </li>`).join("") || '<li class="muted">No events yet.</li>';

  // Worship plans (soonest first)
  const plans = [...data.worshipPlans].sort((a, b) => (a.date || "").localeCompare(b.date || ""));
  $("count-worship").textContent = data.worshipPlans.length ? "(" + data.worshipPlans.length + ")" : "";
  $("list-worship").innerHTML = plans.map((p) => {
    const songs = (p.songs || "").split("\n").map((s) => s.trim()).filter(Boolean);
    return `
    <li>
      <button class="remove" data-delete="worshipPlans" data-id="${p.id}">Remove</button>
      <div class="title">${esc(p.service || "Service")} — ${esc(fmtDate(p.date))}</div>
      <div class="detail">${[p.leader ? "Led by " + p.leader : "", p.team ? "Team: " + p.team : ""].filter(Boolean).map(esc).join(" · ")}</div>
      ${songs.length ? `<ol class="songs">${songs.map((s) => `<li>${esc(s)}</li>`).join("")}</ol>` : ""}
    </li>`;
  }).join("") || '<li class="muted">No service plans yet.</li>';

  // Small groups
  $("count-groups").textContent = data.smallGroups.length ? "(" + data.smallGroups.length + ")" : "";
  $("list-groups").innerHTML = data.smallGroups.map((g) => `
    <li>
      <button class="remove" data-delete="smallGroups" data-id="${g.id}">Remove</button>
      <div class="title">${esc(g.name)}</div>
      <div class="detail">${[g.leader ? "Led by " + g.leader : "", g.meeting, g.location].filter(Boolean).map(esc).join(" · ")}</div>
      ${g.members ? `<div class="detail">Members: ${esc(g.members)}</div>` : ""}
    </li>`).join("") || '<li class="muted">No small groups yet.</li>';

  // Volunteer needs
  $("count-needs").textContent = data.volunteerNeeds.length ? "(" + data.volunteerNeeds.length + ")" : "";
  $("list-needs").innerHTML = data.volunteerNeeds.map((n) => {
    const filled = filledCount(n.id);
    const open = Math.max((n.spots || 0) - filled, 0);
    return `
    <li>
      <button class="remove" data-delete="volunteerNeeds" data-id="${n.id}">Remove</button>
      <div class="title">${esc(n.title)}</div>
      <div class="detail">${esc(n.event || "")}${n.contact ? " · Contact: " + esc(n.contact) : ""}</div>
      <div class="detail">${filled} / ${n.spots || 0} spots filled${open ? " — " + open + " open" : " — full"}</div>
    </li>`;
  }).join("") || '<li class="muted">No needs posted yet.</li>';

  // Signup dropdown (only needs with open spots)
  const openNeeds = data.volunteerNeeds.filter((n) => filledCount(n.id) < (n.spots || 0));
  $("signup-need").innerHTML =
    (openNeeds.length
      ? openNeeds.map((n) => `<option value="${n.id}">${esc(n.title)}${n.event ? " — " + esc(n.event) : ""} (${filledCount(n.id)}/${n.spots || 0})</option>`).join("")
      : '<option value="" disabled>No open needs right now</option>');

  // Signups
  $("list-signups").innerHTML = data.volunteerSignups.map((s) => `
    <li>
      <button class="remove" data-delete="volunteerSignups" data-id="${s.id}">Remove</button>
      <div class="title">${esc(s.name)}</div>
      <div class="detail">Signed up for: ${esc(s.needTitle || "")}</div>
      <div class="detail">${[s.email, s.phone, s.availability].filter(Boolean).map(esc).join(" · ")}</div>
    </li>`).join("") || '<li class="muted">No signups yet.</li>';

  renderWeek(events, plans);
}

function renderWeek(events, plans) {
  // Next worship service
  const nextPlan = plans.find((p) => (p.date || "") >= todayISO()) || plans[0];
  $("next-service").innerHTML = nextPlan ? `
      <div class="title">${esc(nextPlan.service || "Service")}</div>
      <div class="detail">${esc(fmtDate(nextPlan.date))}${nextPlan.leader ? " · Led by " + esc(nextPlan.leader) : ""}</div>
      ${(nextPlan.songs || "").split("\n").filter((s) => s.trim()).length
        ? `<div class="detail">${(nextPlan.songs || "").split("\n").filter((s) => s.trim()).length} songs planned</div>` : ""}`
    : '<p class="muted">No service planned yet — add one under Worship.</p>';

  // Upcoming events
  const upcoming = events.filter((ev) => (ev.date || "") >= todayISO()).slice(0, 3);
  $("upcoming-events").innerHTML = upcoming.length ? upcoming.map((ev) => `
      <div class="title">${esc(ev.title)}</div>
      <div class="detail">${esc(fmtDate(ev.date))}${ev.time ? " · " + esc(ev.time) : ""}${ev.location ? " · " + esc(ev.location) : ""}</div>`
    ).join("") : '<p class="muted">No upcoming events — add one under Events.</p>';

  // Open volunteer needs
  const open = data.volunteerNeeds
    .map((n) => ({ ...n, open: Math.max((n.spots || 0) - filledCount(n.id), 0) }))
    .filter((n) => n.open > 0);
  $("open-needs").innerHTML = open.length ? open.map((n) => `
      <div class="title">${esc(n.title)}</div>
      <div class="detail">${n.open} spot${n.open === 1 ? "" : "s"} open${n.event ? " · " + esc(n.event) : ""}</div>`
    ).join("") : '<p class="muted">No open needs — post one under Volunteer.</p>';
}

renderAll();
