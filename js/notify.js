import { state, getFile } from './store.js';
import { t, fmtTime, fmtNum } from './i18n.js';
import { dayBlocks } from './schedule.js';
import { todayStr, nowMin } from './time.js';
import { toast } from './ui.js';

const fired = new Set(JSON.parse(sessionStorage.getItem('waqti:fired') || '[]'));
const mark = (k) => { fired.add(k); try { sessionStorage.setItem('waqti:fired', JSON.stringify([...fired].slice(-300))); } catch (e) {} };

export const canNotify = () => 'Notification' in window;
export const permission = () => (canNotify() ? Notification.permission : 'unsupported');
export async function askPermission() {
  if (!canNotify()) return 'unsupported';
  return Notification.requestPermission();
}

let ctx;
function chime() {
  try {
    ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
    const notes = [659.25, 783.99, 1046.5];
    notes.forEach((f, i) => {
      const o = ctx.createOscillator(), g = ctx.createGain(), t0 = ctx.currentTime + i * 0.28;
      o.type = 'sine'; o.frequency.value = f;
      g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(0.18, t0 + 0.04); g.gain.exponentialRampToValueAtTime(0.001, t0 + 1.4);
      o.connect(g).connect(ctx.destination); o.start(t0); o.stop(t0 + 1.5);
    });
  } catch (e) {}
}
let customAudio;
export async function playSound(kind = state.settings.sound, isPrayer = false) {
  if (kind === 'none') return;
  if (kind === 'custom' && isPrayer) {
    const blob = await getFile('sound');
    if (blob) {
      customAudio && customAudio.pause();
      customAudio = new Audio(URL.createObjectURL(blob));
      try { await customAudio.play(); return; } catch (e) {}
    }
  }
  chime();
}
export const stopSound = () => customAudio && customAudio.pause();

async function show(title, body, tag) {
  toast(`🔔 ${title} — ${body}`, 6000);
  if (permission() !== 'granted') return;
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    const opts = { body, tag, icon: 'icons/icon-192.png', badge: 'icons/icon-192.png', lang: document.documentElement.lang, dir: document.documentElement.dir };
    if (reg) await reg.showNotification(title, opts); else new Notification(title, opts);
  } catch (e) {}
}

// يفحص كل نصف دقيقة إذا في تذكير مستحق (يعمل والتطبيق مفتوح)
function tick() {
  const s = state.settings;
  if (!s.onboarded) return;
  const d = todayStr(), now = nowMin();
  for (const b of dayBlocks(d)) {
    if (b.type === 'sleep' || b.type === 'work' || b.done) continue;
    const isPrayer = b.type === 'prayer';
    if (isPrayer && !s.prayerRemind) continue;
    const before = b.item ? (b.item.remind === '' || b.item.remind == null ? null : Number(b.item.remind)) : Number(s.remindMin);
    // تذكير مسبق
    if (before != null && before > 0) {
      const at = b.start - before, k = `${d}|${b.id}|pre`;
      if (now >= at && now < b.start && !fired.has(k)) {
        mark(k); show(b.title, t('starts_in', { m: fmtNum(Math.max(1, Math.round(b.start - now))), time: fmtTime(b.start) }), k); playSound(s.sound, false);
      }
    }
    // عند الموعد بالضبط
    const k2 = `${d}|${b.id}|now`;
    if ((before != null || isPrayer) && now >= b.start && now < b.start + 2 && !fired.has(k2)) {
      mark(k2); show(b.title, isPrayer ? t('prayer_now', { p: b.title }) : t('starts_now'), k2); playSound(s.sound, isPrayer);
    }
  }
}
export function startReminders() {
  tick();
  setInterval(tick, 20000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) tick(); });
}
