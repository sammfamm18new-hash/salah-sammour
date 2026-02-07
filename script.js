/* =========================
   Salah Tracker - script.js
   Features:
   - Liquid UI logic
   - PWA install prompt
   - Theme toggle (pref + manual)
   - In-page notifications (limited while app is open)
   - Daily reset & streaks
   - Missed-prayer stats
   - Export/Import JSON
   - Optional Firebase cloud sync hooks (replace config and uncomment tags in HTML)
   ========================= */

const PRAYERS = ["Fajr", "Dhuhr", "Asr", "Maghrib", "Isha"];
const prayersDiv = document.getElementById("prayers");
const progressBar = document.getElementById("progress-bar");
const progressText = document.getElementById("progress-text");
const dateEl = document.getElementById("date");
const streakEl = document.getElementById("streak");
const missedCountEl = document.getElementById("missed-count");
const statsList = document.getElementById("stats-list");
const installBtn = document.getElementById("install-btn");
const notifyBtn = document.getElementById("notify-btn");
const exportBtn = document.getElementById("export-btn");
const importBtn = document.getElementById("import-btn");
const signInBtn = document.getElementById("sign-in-btn");
const syncNowBtn = document.getElementById("sync-now-btn");
const themeToggle = document.getElementById("theme-toggle");

const todayStr = (new Date()).toDateString();
dateEl.textContent = todayStr;

let deferredPrompt = null;
let data = loadData();

// PWA install prompt handling
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  installBtn.style.display = 'inline-block';
});
installBtn.addEventListener('click', async () => {
  installBtn.disabled = true;
  if (deferredPrompt) {
    deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    deferredPrompt = null;
    installBtn.style.display = 'none';
  }
  installBtn.disabled = false;
});

// Theme toggle + prefers
const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
let theme = localStorage.getItem('theme') || (prefersDark ? 'dark' : 'auto');
applyTheme(theme);
themeToggle.addEventListener('click', () => {
  if (theme === 'auto') theme = 'dark';
  else if (theme === 'dark') theme = 'light';
  else theme = 'auto';
  localStorage.setItem('theme', theme);
  applyTheme(theme);
});
function applyTheme(t){
  if (t === 'auto') {
    document.documentElement.style.removeProperty('color-scheme');
    themeToggle.textContent = '🌓';
  } else {
    document.documentElement.style.colorScheme = t;
    themeToggle.textContent = t === 'dark' ? '🌙' : '🌞';
  }
}

/* ---------- Data model ----------
data = {
  date: "Mon Feb 01 2026",
  completed: ["Fajr"],
  missedCounts: {Fajr:2, Dhuhr:0, ...},
  streak: 0,
  history: [{date: "...", completed: [...]}, ...],
  queue: [] // for offline cloud sync
}
---------------------------------*/

function defaultData(){
  const missed = {};
  PRAYERS.forEach(p => missed[p]=0);
  return {
    date: todayStr,
    completed: [],
    missedCounts: missed,
    streak: 0,
    history: [],
    queue: []
  };
}

function loadData(){
  try {
    const raw = localStorage.getItem('salahData');
    if (!raw) return defaultData();
    const obj = JSON.parse(raw);
    // daily reset if needed
    if (obj.date !== todayStr) {
      // if some prayers remained uncompleted yesterday, increment missed
      const missedList = PRAYERS.filter(p => !obj.completed.includes(p));
      missedList.forEach(p => {
        obj.missedCounts = obj.missedCounts || {};
        obj.missedCounts[p] = (obj.missedCounts[p]||0) + 1;
      });
      obj.history = obj.history || [];
      obj.history.unshift({date: obj.date, completed: obj.completed});
      obj.completed = [];
      obj.date = todayStr;
      // streak increments if yesterday all were completed
      const yesterdayAll = obj.history.length && (obj.history[0].completed.length === PRAYERS.length);
      if (yesterdayAll) obj.streak = (obj.streak || 0) + 1;
      saveData(obj);
    }
    return obj;
  } catch(e){ console.warn('load fail',e); return defaultData(); }
}

function saveData(obj){
  localStorage.setItem('salahData', JSON.stringify(obj));
  // queue for cloud sync if connected (cloudSync() will check queue)
  try { data = obj; } catch(e){}
}

/* ---------- Render ---------- */
function render(){
  prayersDiv.innerHTML = '';
  PRAYERS.forEach(prayer => {
    const card = document.createElement('button');
    card.className = 'prayer';
    if (data.completed.includes(prayer)) card.classList.add('completed');
    card.innerHTML = `<span>${prayer}</span><span class="check">${data.completed.includes(prayer) ? '✔️' : '○'}</span>`;
    card.onclick = () => togglePrayer(prayer);
    prayersDiv.appendChild(card);
  });

  updateProgress();
  renderStats();
}

function updateProgress(){
  const percent = Math.round((data.completed.length / PRAYERS.length) * 100);
  progressBar.style.width = percent + '%';
  progressText.textContent = `${data.completed.length}/${PRAYERS.length} completed • Streak: ${data.streak} 🔥`;
  streakEl.textContent = `Streak: ${data.streak}`;
  const missedCount = Object.values(data.missedCounts || {}).reduce((a,b)=>a+b,0);
  missedCountEl.textContent = `Missed: ${missedCount}`;
}

function renderStats(){
  statsList.innerHTML = '';
  PRAYERS.forEach(p=>{
    const row = document.createElement('div');
    row.textContent = `${p}: missed ${data.missedCounts[p] || 0} • marked ${data.history.filter(h=>h.completed.includes(p)).length} times`;
    statsList.appendChild(row);
  });
}

/* ---------- Prayer toggle ---------- */
function togglePrayer(prayer){
  vibrate();
  if (data.completed.includes(prayer)){
    data.completed = data.completed.filter(p=>p!==prayer);
    // don't mark missed here
  } else {
    data.completed.push(prayer);
  }
  saveData(data);
  render();
}

/* ---------- Vibrate ---------- */
function vibrate(){
  if (navigator.vibrate) navigator.vibrate(35);
}

/* ---------- Export / Import ---------- */
exportBtn.addEventListener('click', ()=>{
  const blob = new Blob([JSON.stringify(data, null, 2)], {type:'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `salah-${new Date().toISOString().slice(0,10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
});
importBtn.addEventListener('click', async ()=>{
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'application/json';
  input.onchange = async (e) => {
    const f = e.target.files[0];
    if (!f) return;
    const txt = await f.text();
    try {
      const obj = JSON.parse(txt);
      // minimal validation
      if (!obj.date) obj.date = todayStr;
      localStorage.setItem('salahData', JSON.stringify(Object.assign(defaultData(), obj)));
      data = loadData();
      render();
      alert('Imported!');
    } catch(e){
      alert('Import failed: invalid JSON');
    }
  };
  input.click();
});

/* ---------- Notifications (in-page scheduling only) ----------
   Important: Browsers do not provide reliable native scheduling when app is closed.
   For reliable background notifications use server push (FCM / Web Push).
   Here we:
   - request Notification permission
   - offer to schedule notifications for approximate prayer times
   - schedule timers while tab is open
-------------------------------------------------------------*/

let notifyPermission = Notification && Notification.permission;
notifyBtn.addEventListener('click', async ()=>{
  if (!('Notification' in window)) { alert('Notifications not supported'); return; }
  const perm = await Notification.requestPermission();
  notifyPermission = perm;
  if (perm === 'granted') {
    notifyBtn.textContent = 'Notifications enabled';
    scheduleAllPrayerNotifications();
  } else {
    notifyBtn.textContent = 'Notifications blocked';
  }
});

const scheduledTimers = [];
function clearScheduled(){
  scheduledTimers.forEach(id => clearTimeout(id));
  scheduledTimers.length = 0;
}

function scheduleNotificationAt(title, when){
  const now = Date.now();
  const diff = when - now;
  if (diff <= 0) return;
  const id = setTimeout(()=> {
    new Notification('Salah Reminder', { body: `${title} time — mark it done 💪`, badge: '/icons/icon-192.png' });
    vibrate();
  }, diff);
  scheduledTimers.push(id);
}

/* crude prayer time generator: this is a placeholder.
   For real accurate times use a prayer-times library or API (e.g., adhan-js).
   Here we schedule simple demo times spread across the day for demo / offline purposes.
*/
function getDemoPrayerTimes(){
  const now = new Date();
  const base = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  // demo times: 5:00, 12:30, 16:00, sunset(19:00), 20:30
  return {
    Fajr: new Date(base.getFullYear(), base.getMonth(), base.getDate(), 5, 0).getTime(),
    Dhuhr: new Date(base.getFullYear(), base.getMonth(), base.getDate(), 12, 30).getTime(),
    Asr: new Date(base.getFullYear(), base.getMonth(), base.getDate(), 16, 0).getTime(),
    Maghrib: new Date(base.getFullYear(), base.getMonth(), base.getDate(), 19, 0).getTime(),
    Isha: new Date(base.getFullYear(), base.getMonth(), base.getDate(), 20, 30).getTime()
  };
}

function scheduleAllPrayerNotifications(){
  if (Notification.permission !== 'granted') return;
  clearScheduled();
  const times = getDemoPrayerTimes(); // replace with real times if available
  PRAYERS.forEach(p=>{
    scheduleNotificationAt(p, times[p]);
  });
  alert('Scheduled reminders for today (demo times). For reliable background notifications use server push.');
}

/* ---------- Cloud Sync (optional) ----------
   This section includes lightweight helpers to use Firebase (Auth + Firestore).
   To enable:
   - create a Firebase project
   - enable email/google auth (or anonymous)
   - create a Firestore database
   - include Firebase scripts in index.html (commented lines at top)
   - paste your firebaseConfig into initFirebase(firebaseConfig)
   - uncomment cloudInit() call below
--------------------------------------------------*/

// Minimal wrappers; you must call initFirebase(...) with your config
let firebaseApp = null;
let firestore = null;
let firebaseAuth = null;

function initFirebase(config){
  if (!window.firebase) {
    console.warn('Firebase scripts not loaded. Add them if you want cloud sync.');
    return;
  }
  firebaseApp = firebase.initializeApp(config);
  firebaseAuth = firebase.auth();
  firestore = firebase.firestore();
  // auth state
  firebaseAuth.onAuthStateChanged(user => {
    if (user) {
      signInBtn.textContent = 'Signed in';
      // auto sync
      syncNow();
    } else {
      signInBtn.textContent = 'Sign in';
    }
  });
}

signInBtn.addEventListener('click', async ()=>{
  if (!firebaseAuth) { alert('Firebase not initialized. Add config.'); return; }
  // simple google popup
  const provider = new firebase.auth.GoogleAuthProvider();
  try {
    await firebaseAuth.signInWithPopup(provider);
    alert('Signed in');
  } catch(e) {
    console.warn('signin fail', e);
    alert('Sign-in failed');
  }
});

syncNowBtn.addEventListener('click', ()=> syncNow());

async function syncNow(){
  if (!firestore || !firebaseAuth) { alert('Cloud not configured'); return; }
  const user = firebaseAuth.currentUser;
  if (!user) { alert('Sign in first'); return; }
  // try to pull server copy
  const docRef = firestore.collection('salahUsers').doc(user.uid);
  const doc = await docRef.get();
  if (!doc.exists) {
    // push local
    await docRef.set({data});
    alert('Synced local -> cloud');
  } else {
    // merge: server wins for now — you can change strategy
    const server = doc.data().data || {};
    // simple merge: prefer server history but keep local queue
    const merged = Object.assign({}, defaultData(), data, server);
    data = merged;
    saveData(data);
    await docRef.set({data: merged});
    render();
    alert('Synced with cloud');
  }
}

/* ---------- Offline queue example ----------
   If you want offline edits queued for later push:
   data.queue.push({op:'update', payload: data});
   and cloudSync() will pop and push when online.
-------------------------------------------------*/

/* ---------- Utilities: daily reset ----------
   On each page load we already did daily reset in loadData();
   But ensure midnight reset if app stays open:
*/
scheduleMidnightReset();

function scheduleMidnightReset(){
  const now = new Date();
  const mid = new Date(now.getFullYear(), now.getMonth(), now.getDate()+1, 0, 1).getTime();
  const diff = mid - now.getTime();
  setTimeout(()=>{
    data = loadData(); // this will push yesterday to history and reset
    render();
    scheduleMidnightReset();
  }, diff + 5000);
}

/* ---------- init ---------- */
render();

/* optional: uncomment and set your firebaseConfig
initFirebase({
  apiKey: "...",
  authDomain: "...",
  projectId: "...",
  storageBucket: "...",
  messagingSenderId: "...",
  appId: "..."
});
*/

/* ---------- Cloud sync hint ----------
For reliable push notifications even when app is closed: integrate Firebase Cloud Messaging (FCM) and a server to send scheduled push messages using the Web Push protocol (VAPID) or FCM scheduling. Browser push + service worker needed.
*/
