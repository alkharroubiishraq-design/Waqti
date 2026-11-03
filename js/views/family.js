import { state } from '../store.js';
import { t, fmtDate, fmtNum, fmtTime } from '../i18n.js';
import { esc } from '../ui.js';
import { occursOn } from '../schedule.js';
import { addDays, ymd, parseYmd, hm2min } from '../time.js';
import { openItemForm } from '../itemform.js';

export function nextOccurrence(it, from = new Date(), days = 370) {
  for (let i = 0; i < days; i++) { const d = ymd(addDays(from, i)); if (occursOn(it, d)) return { d, i }; }
  return null;
}

export function render(el) {
  const fam = state.items.filter((it) => it.cat === 'family')
    .map((it) => ({ it, n: nextOccurrence(it) })).filter((x) => x.n).sort((a, b) => a.n.i - b.n.i);
  el.innerHTML = `
    <div class="page-head"><h1>${esc(t('nav_family'))}</h1></div>
    <div class="row gap wrap">
      <button class="btn primary" data-add="birthday">🎂 ${esc(t('add_birthday'))}</button>
      <button class="btn soft" data-add="visit">🏠 ${esc(t('add_visit'))}</button>
      <button class="btn soft" data-add="occasion">🎉 ${esc(t('add_occasion'))}</button>
    </div>
    ${fam.length ? `<ul class="list card">${fam.map(({ it, n }) => `<li class="row-item" style="--c:#ec4899">
      <span class="pill ${n.i <= 3 ? 'warn' : ''}">${esc(n.i === 0 ? t('today') : n.i === 1 ? t('tomorrow') : t('in_days', { n: fmtNum(n.i) }))}</span>
      <div class="grow" data-open="${it.id}"><div class="ri-title">${it.kind === 'birthday' ? '🎂' : it.kind === 'visit' ? '🏠' : '🎉'} ${esc(it.title)}</div>
      <div class="muted small">${esc(fmtDate(parseYmd(n.d), { weekday: 'short', day: 'numeric', month: 'long' }))}${it.start ? ' · ' + esc(fmtTime(hm2min(it.start))) : ''}</div></div></li>`).join('')}</ul>`
      : `<div class="empty card">👨‍👩‍👧 ${esc(t('empty_family'))}</div>`}`;
  el.onclick = (e) => {
    const a = e.target.closest('[data-add]');
    if (a) {
      const k = a.dataset.add;
      const preset = { cat: 'family', kind: k, remind: k === 'birthday' ? '1440' : '60', rec: k === 'birthday' ? 'yearly' : 'none', dur: k === 'visit' ? 120 : 60 };
      return openItemForm({ preset, title: t(`add_${k}`) });
    }
    const op = e.target.closest('[data-open]');
    if (op) openItemForm({ item: state.items.find((x) => x.id === op.dataset.open) });
  };
}
