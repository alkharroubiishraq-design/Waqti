import { state, save, uid } from '../store.js';
import { t, fmtNum, fmtDate } from '../i18n.js';
import { esc, modal, closeModal, confirmBox, $ } from '../ui.js';
import { todayStr, addDays, ymd, parseYmd } from '../time.js';
import { rerender } from '../router.js';

const COLORS = ['#10b981', '#3b82f6', '#8b5cf6', '#f97316', '#ec4899', '#eab308', '#0ea5e9', '#64748b'];
const ICONS = ['📖', '🧘', '🏃', '💧', '🥗', '🚭', '✍️', '🎸', '🌱', '🙏', '💤', '📵', '🧹', '💰', '🗣️', '❤️'];

export function streak(h) {
  let n = 0, d = new Date();
  if (!h.log[ymd(d)]) d = addDays(d, -1);
  while (h.log[ymd(d)]) { n++; d = addDays(d, -1); }
  return n;
}

export function render(el) {
  const days = Array.from({ length: 7 }, (_, i) => ymd(addDays(new Date(), i - 6)));
  el.innerHTML = `
    <div class="page-head"><h1>${esc(t('nav_habits'))}</h1><button class="btn primary" data-add>＋ ${esc(t('add_habit'))}</button></div>
    ${state.habits.length ? `<section class="card habits">
      <div class="h-row head"><span></span>${days.map((d) => `<span class="small muted">${esc(fmtDate(parseYmd(d), { weekday: 'narrow' }))}</span>`).join('')}<span class="small muted">🔥</span></div>
      ${state.habits.map((h) => `<div class="h-row" style="--c:${h.color}">
        <button class="h-name" data-edit="${h.id}">${h.icon} ${esc(h.name)}</button>
        ${days.map((d) => `<button class="h-cell ${h.log[d] ? 'on' : ''}" data-h="${h.id}" data-d="${d}" aria-pressed="${!!h.log[d]}" aria-label="${esc(h.name)} ${esc(d)}"></button>`).join('')}
        <b class="small">${esc(fmtNum(streak(h)))}</b>
      </div>`).join('')}
    </section>` : `<div class="empty card">🌱 ${esc(t('empty_habits'))}</div>`}`;
  el.onclick = (e) => {
    const c = e.target.closest('[data-h]');
    if (c) { const h = state.habits.find((x) => x.id === c.dataset.h); if (h.log[c.dataset.d]) delete h.log[c.dataset.d]; else h.log[c.dataset.d] = 1; save(); return rerender(); }
    if (e.target.closest('[data-add]')) return habitForm();
    const ed = e.target.closest('[data-edit]');
    if (ed) habitForm(state.habits.find((x) => x.id === ed.dataset.edit));
  };
}

function habitForm(h) {
  const m = modal(`<h2>${esc(h ? t('edit') : t('add_habit'))}</h2><form class="form" id="hf">
    <label>${esc(t('f_title'))}<input name="name" required maxlength="60" value="${esc(h?.name || '')}" placeholder="${esc(t('habit_ph'))}"></label>
    <div class="icons">${ICONS.map((i) => `<label><input type="radio" name="icon" value="${i}" ${(h?.icon || ICONS[0]) === i ? 'checked' : ''}><span>${i}</span></label>`).join('')}</div>
    <div class="swatches">${COLORS.map((c) => `<label><input type="radio" name="color" value="${c}" ${(h?.color || COLORS[0]) === c ? 'checked' : ''}><span style="background:${c}"></span></label>`).join('')}</div>
    <div class="row between">${h ? `<button type="button" class="btn danger ghost" data-del>🗑 ${esc(t('delete'))}</button>` : '<span></span>'}<button class="btn primary">${esc(t('save'))}</button></div></form>`);
  $('#hf', m).onsubmit = (e) => {
    e.preventDefault(); const f = Object.fromEntries(new FormData(e.target).entries());
    if (h) Object.assign(h, f); else state.habits.push({ id: uid(), log: {}, ...f });
    save(); closeModal(); rerender();
  };
  const d = m.querySelector('[data-del]');
  if (d) d.onclick = async () => { if (await confirmBox(t('confirm_delete'))) { state.habits = state.habits.filter((x) => x !== h); save(); rerender(); } };
}
