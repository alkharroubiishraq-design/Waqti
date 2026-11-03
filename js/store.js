// تخزين محلي فقط — لا شيء يغادر جهاز المستخدم
const KEY = 'waqti:v1';

export const BUILTIN_CATS = [
  { id: 'work', color: '#3b82f6', icon: '💼' },
  { id: 'study', color: '#8b5cf6', icon: '📚' },
  { id: 'sport', color: '#f97316', icon: '🏃' },
  { id: 'health', color: '#10b981', icon: '💧' },
  { id: 'family', color: '#ec4899', icon: '👨‍👩‍👧' },
  { id: 'worship', color: '#0d9488', icon: '🕊️' },
  { id: 'personal', color: '#64748b', icon: '⭐' },
];

export function defaults() {
  return {
    v: 1,
    settings: {
      onboarded: false,
      lang: null,
      religion: 'none', // islam | christian | none
      calc: 'MuslimWorldLeague',
      madhab: 'shafi',
      church: 'western', // western | eastern
      fixedFeasts: 'gregorian', // gregorian | julian (للكنائس الشرقية)
      massDay: 0,
      massTime: '10:00',
      massDur: 90,
      jumuah: true,
      city: null, // {name, lat, lng, cc}
      work: { on: true, days: [1, 2, 3, 4, 5], start: '09:00', end: '17:00' },
      sleep: { bed: '23:00', wake: '07:00' },
      remindMin: 10,
      prayerRemind: true,
      sound: 'calm', // calm | custom | none
      waterGoal: 8,
      pomo: { work: 25, brk: 5 },
      theme: 'auto',
      weekStart: 1,
    },
    categories: [], // تصنيفات مخصّصة {id,name,color,icon}
    items: [],
    habits: [],
    subjects: [],
    logs: { water: {}, pomo: {}, prayed: {}, sleep: {} },
  };
}

function merge(base, saved) {
  for (const k of Object.keys(saved || {})) {
    if (base[k] && typeof base[k] === 'object' && !Array.isArray(base[k]) && saved[k] && typeof saved[k] === 'object' && !Array.isArray(saved[k])) {
      merge(base[k], saved[k]);
    } else base[k] = saved[k];
  }
  return base;
}

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return merge(defaults(), JSON.parse(raw));
  } catch (e) { console.warn('load failed', e); }
  return defaults();
}

export const state = load();
const listeners = new Set();
export const onChange = (fn) => listeners.add(fn);

export function save() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); }
  catch (e) { console.warn('save failed', e); }
  listeners.forEach((fn) => fn());
}

export function replaceState(data) {
  const fresh = merge(defaults(), data);
  for (const k of Object.keys(state)) delete state[k];
  Object.assign(state, fresh);
  save();
}

export function resetAll() {
  try { localStorage.removeItem(KEY); } catch (e) {}
  replaceState(defaults());
}

export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

export function allCats() {
  return [...BUILTIN_CATS.map((c) => ({ ...c, builtin: true })), ...state.categories];
}
export const catById = (id) => allCats().find((c) => c.id === id) || BUILTIN_CATS[6];

// ملف صوت الأذان/التنبيه المخصّص يُحفظ في IndexedDB لأنه كبير
const DB = 'waqti-files';
function idb() {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore('files');
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
export async function putFile(key, blob) {
  const db = await idb();
  return new Promise((res, rej) => {
    const tx = db.transaction('files', 'readwrite');
    tx.objectStore('files').put(blob, key);
    tx.oncomplete = res; tx.onerror = () => rej(tx.error);
  });
}
export async function getFile(key) {
  try {
    const db = await idb();
    return await new Promise((res) => {
      const r = db.transaction('files').objectStore('files').get(key);
      r.onsuccess = () => res(r.result || null); r.onerror = () => res(null);
    });
  } catch (e) { return null; }
}
