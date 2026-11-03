import { state, save, uid, allCats } from '../store.js';
import { t } from '../i18n.js';
import { esc, modal, closeModal, confirmBox, $ } from '../ui.js';
import { rerender } from '../router.js';
import { catName } from '../itemform.js';

const COLORS = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#10b981', '#0ea5e9', '#3b82f6', '#6366f1', '#8b5cf6', '#ec4899', '#64748b', '#a16207'];
const ICONS = ['🎨', '🎮', '🎵', '📷', '🍳', '🛒', '🚗', '✈️', '🧑‍💻', '🧶', '🌿', '🐾', '📞', '🧾', '🏠', '🎯', '📺', '⚽', '🛠️', '💡'];

export function render(el) {
  el.innerHTML = `<div class="page-head"><h1>${esc(t('nav_cats'))}</h1><button class="btn primary" data-add>＋ ${esc(t('add_activity'))}</button></div>
    <p class="muted">${esc(t('cats_hint'))}</p>
    <ul class="list card">${allCats().map((c) => `<li class="row-item" style="--c:${c.color}"><span class="cat-ic">${c.icon}</span><div class="grow">${esc(catName(c))}</div>${c.builtin ? '<span class="muted small">🔒</span>' : `<button class="btn ghost small" data-edit="${c.id}">${esc(t('edit'))}</button>`}</li>`).join('')}</ul>`;
  el.onclick = (e) => {
    if (e.target.closest('[data-add]')) return form();
    const ed = e.target.closest('[data-edit]');
    if (ed) form(state.categories.find((c) => c.id === ed.dataset.edit));
  };
}

function form(c) {
  const m = modal(`<h2>${esc(c ? t('edit') : t('add_activity'))}</h2><form class="form" id="cf">
    <label>${esc(t('f_title'))}<input name="name" required maxlength="40" value="${esc(c?.name || '')}" placeholder="${esc(t('activity_ph'))}"></label>
    <div class="icons">${ICONS.map((i) => `<label><input type="radio" name="icon" value="${i}" ${(c?.icon || ICONS[0]) === i ? 'checked' : ''}><span>${i}</span></label>`).join('')}</div>
    <div class="swatches">${COLORS.map((x) => `<label><input type="radio" name="color" value="${x}" ${(c?.color || COLORS[7]) === x ? 'checked' : ''}><span style="background:${x}"></span></label>`).join('')}</div>
    <div class="row between">${c ? `<button type="button" class="btn danger ghost" data-del>🗑 ${esc(t('delete'))}</button>` : '<span></span>'}<button class="btn primary">${esc(t('save'))}</button></div></form>`);
  $('#cf', m).onsubmit = (e) => {
    e.preventDefault(); const f = Object.fromEntries(new FormData(e.target).entries());
    if (c) Object.assign(c, f); else state.categories.push({ id: 'c_' + uid(), ...f });
    save(); closeModal(); rerender();
  };
  const d = m.querySelector('[data-del]');
  if (d) d.onclick = async () => {
    if (!(await confirmBox(t('confirm_delete_cat')))) return;
    state.items.forEach((it) => { if (it.cat === c.id) it.cat = 'personal'; });
    state.categories = state.categories.filter((x) => x !== c); save(); rerender();
  };
}
