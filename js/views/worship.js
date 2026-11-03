import { state, save } from '../store.js';
import { t, fmtTime, fmtDate, fmtDur, fmtNum, hijri, weekdayName } from '../i18n.js';
import { esc, toast } from '../ui.js';
import { prayerTimes, PRAYERS, nextPrayer, qibla, upcomingFeasts, isRamadan, hijriParts } from '../worship.js';
import { todayStr, parseYmd, dateMin, daysBetween, hm2min } from '../time.js';
import { go, rerender, every } from '../router.js';
import { openItemForm } from '../itemform.js';
import { itemRow, bindRows } from './tasks.js';

let compassOn = false;
let orientHandler = null;

function feastList(s) {
  const td = todayStr();
  const list = upcomingFeasts(s).slice(0, 12);
  if (!list.length) return '';
  return `<section class="card"><h2>${esc(t(s.religion === 'christian' ? 'feasts' : 'occasions'))}</h2><ul class="list plain">${list.map((f) => {
    const n = daysBetween(td, f.date);
    return `<li class="row between"><span>🎉 ${esc(t(f.key))}</span><span class="muted small">${esc(fmtDate(parseYmd(f.date), { day: 'numeric', month: 'short', year: 'numeric' }))} · ${esc(n === 0 ? t('today') : t('in_days', { n: fmtNum(n) }))}</span></li>`;
  }).join('')}</ul>${s.religion === 'islam' ? `<p class="muted small">${esc(t('hijri_note'))}</p>` : ''}</section>`;
}

function islam(el, s) {
  if (!s.city) { el.innerHTML = `<div class="empty card">📍 ${esc(t('need_city'))}<br><a class="btn primary" href="#/settings">${esc(t('nav_settings'))}</a></div>`; return; }
  const now = new Date(), td = todayStr(), pt = prayerTimes(now, s), np = nextPrayer(s), prayed = state.logs.prayed[td] || {};
  const q = qibla(s);
  const ram = isRamadan(now);
  const h = hijriParts(now);
  el.innerHTML = `
    <div class="page-head"><h1>${esc(t('nav_worship'))}</h1><span class="muted">${esc(hijri(now))}</span></div>
    ${np ? `<section class="hero"><div><div class="muted small">${esc(t('next_prayer'))}</div><div class="hero-title">${esc(t(`pr_${np.key}`))} · ${esc(fmtClock(np.time))}</div></div><div class="hero-count" id="np-count" data-at="${np.time.getTime()}">${esc(fmtDur((np.time - now) / 60000))}</div></section>` : ''}
    ${ram ? `<section class="card ramadan-card"><h2>🌙 ${esc(t('ramadan_kareem'))}</h2><div class="grid2"><div><div class="muted small">${esc(t('suhoor_until'))}</div><div class="big">${esc(fmtClock(pt.fajr))}</div></div><div><div class="muted small">${esc(t('iftar'))}</div><div class="big">${esc(fmtClock(pt.maghrib))}</div></div></div></section>` : ''}
    <section class="card">
      <div class="row between"><h2>${esc(t('prayer_times'))}</h2><span class="muted small">📍 ${esc(cityName(s.city))}</span></div>
      <ul class="prayers">
        ${['fajr', 'sunrise', 'dhuhr', 'asr', 'maghrib', 'isha'].map((k) => {
          const isP = PRAYERS.includes(k), label = k === 'dhuhr' && now.getDay() === 5 && s.jumuah ? t('jumuah') : t(`pr_${k}`);
          return `<li class="${np && np.key === k ? 'next' : ''} ${pt[k] < now ? 'past' : ''}">
            <span>${esc(label)}</span><span class="grow"></span><b>${esc(fmtClock(pt[k]))}</b>
            ${isP ? `<button class="check" data-pray="${k}" aria-pressed="${!!prayed[k]}" aria-label="${esc(t('prayed'))}">${prayed[k] ? '✓' : ''}</button>` : '<span class="check-sp"></span>'}
          </li>`;
        }).join('')}
      </ul>
      <p class="muted small">${esc(t('calc_method'))}: ${esc(t(`m_${s.calc}`))} · ${esc(t(s.madhab === 'hanafi' ? 'madhab_hanafi' : 'madhab_shafi'))} — <a href="#/settings">${esc(t('change'))}</a></p>
    </section>
    <section class="card qibla-card">
      <h2>🧭 ${esc(t('qibla'))}</h2>
      <div class="compass" id="compass"><div class="dial" id="dial"><span class="n">N</span><div class="needle" style="transform:rotate(${q}deg)"><span>🕋</span></div></div></div>
      <p class="center">${esc(t('qibla_deg', { d: fmtNum(Math.round(q)) }))}</p>
      <div class="center"><button class="btn soft" data-compass>${esc(compassOn ? t('compass_on') : t('compass_start'))}</button></div>
      <p class="muted small center">${esc(t('qibla_hint'))}</p>
    </section>
    ${now.getDay() === 4 || now.getDay() === 5 ? `<section class="card">🕌 ${esc(t('jumuah_reminder'))}</section>` : ''}
    ${feastList(s)}
  `;
  el.onclick = (e) => {
    const p = e.target.closest('[data-pray]');
    if (p) { const log = (state.logs.prayed[td] = state.logs.prayed[td] || {}); log[p.dataset.pray] = !log[p.dataset.pray]; if (!log[p.dataset.pray]) delete log[p.dataset.pray]; save(); rerender(); }
    if (e.target.closest('[data-compass]')) startCompass(q);
  };
  every(() => { const c = document.getElementById('np-count'); if (c) { const ms = c.dataset.at - Date.now(); if (ms <= 0) rerender(); else c.textContent = fmtDur(ms / 60000); } }, 30000);
  if (compassOn) startCompass(q, true);
}

const fmtClock = (d) => fmtTime(dateMin(d));
const cityName = (c) => (document.documentElement.lang === 'ar' && c.nameAr ? c.nameAr : c.name);

async function startCompass(q, silent) {
  const dial = document.getElementById('dial');
  if (!dial) return;
  try {
    if (typeof DeviceOrientationEvent !== 'undefined' && DeviceOrientationEvent.requestPermission && !silent) {
      const r = await DeviceOrientationEvent.requestPermission();
      if (r !== 'granted') return toast(t('compass_denied'));
    }
  } catch (e) {}
  if (orientHandler) { window.removeEventListener('deviceorientationabsolute', orientHandler); window.removeEventListener('deviceorientation', orientHandler); }
  let got = false;
  orientHandler = (e) => {
    let heading = e.webkitCompassHeading;
    if (heading == null && e.alpha != null && (e.absolute || e.type === 'deviceorientationabsolute')) heading = 360 - e.alpha;
    if (heading == null) return;
    got = true;
    const d = document.getElementById('dial');
    if (d) d.style.transform = `rotate(${-heading}deg)`;
  };
  window.addEventListener('deviceorientationabsolute', orientHandler);
  window.addEventListener('deviceorientation', orientHandler);
  compassOn = true;
  if (!silent) setTimeout(() => { if (!got) toast(t('compass_unavailable')); }, 2500);
}

function christian(el, s) {
  const td = todayStr();
  const church = state.items.filter((it) => it.cat === 'worship');
  el.innerHTML = `
    <div class="page-head"><h1>${esc(t('nav_worship'))}</h1><span class="muted">${esc(t(s.church === 'eastern' ? 'church_eastern' : 'church_western'))}</span></div>
    <section class="hero"><div><div class="muted small">${esc(t('weekly_mass'))}</div><div class="hero-title">⛪ ${esc(weekdayName(Number(s.massDay)))} · ${esc(fmtTime(hm2min(s.massTime)))}</div></div><a class="btn ghost small" href="#/settings">${esc(t('change'))}</a></section>
    <section class="card">
      <div class="row between"><h2>${esc(t('church_events'))}</h2><button class="btn soft small" data-add>＋ ${esc(t('add'))}</button></div>
      ${church.length ? `<ul class="list">${church.map((it) => itemRow(it, it.rec && it.rec !== 'none' ? td : null)).join('')}</ul>` : `<p class="muted">${esc(t('church_events_hint'))}</p>`}
    </section>
    ${feastList(s)}
  `;
  el.querySelector('[data-add]').onclick = () => openItemForm({ preset: { cat: 'worship', rec: 'weekly', dur: 60 }, title: t('add_church_event') });
  bindRows(el);
}

export function render(el) {
  const s = state.settings;
  if (s.religion === 'islam') islam(el, s);
  else if (s.religion === 'christian') christian(el, s);
  else go('today');
}
