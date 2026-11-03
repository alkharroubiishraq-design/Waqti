import { state, save, uid, allCats } from './store.js';
import { t, fmtTime, fmtDur } from './i18n.js';
import { modal, closeModal, esc, toast, confirmBox, $ } from './ui.js';
import { suggestSlots, conflictsAt } from './schedule.js';
import { min2hm, hm2min, todayStr } from './time.js';
import { rerender } from './router.js';

export const catName = (c) => (c.builtin ? t(`cat_${c.id}`) : c.name);
const DURS = [10, 15, 20, 30, 45, 60, 90, 120, 180, 240];
const RECS = ['none', 'daily', 'weekdays', 'weekly', 'monthly', 'yearly'];
const REMINDS = ['', 0, 5, 10, 15, 30, 60, 1440];
const remindLabel = (r) => (r === '' ? t('remind_none') : r === 0 ? t('remind_at') : r === 1440 ? t('remind_day') : t('remind_before', { m: r }));

export function openItemForm({ item, preset = {}, title } = {}) {
  const isNew = !item;
  const it = item ? { ...item } : { id: uid(), title: '', cat: 'personal', date: todayStr(), start: '', dur: 30, prio: 2, rec: 'none', remind: String(state.settings.remindMin), notes: '', kind: 'task', ...preset };
  const opt = (v, cur, label) => `<option value="${esc(v)}" ${String(v) === String(cur) ? 'selected' : ''}>${esc(label)}</option>`;
  const durs = DURS.includes(Number(it.dur)) ? DURS : [...DURS, Number(it.dur)].sort((a, b) => a - b);
  const m = modal(`
    <h2>${esc(title || (isNew ? t('new_item') : t('edit_item')))}</h2>
    <form class="form" id="item-form" autocomplete="off">
      <label>${esc(t('f_title'))}<input name="title" required maxlength="120" value="${esc(it.title)}" placeholder="${esc(t('f_title_ph'))}"></label>
      <div class="grid2">
        <label>${esc(t('f_category'))}<select name="cat">${allCats().map((c) => opt(c.id, it.cat, `${c.icon} ${catName(c)}`)).join('')}</select></label>
        <label>${esc(t('f_priority'))}<select name="prio">${[3, 2, 1].map((p) => opt(p, it.prio, t(`prio_${p}`))).join('')}</select></label>
      </div>
      <div class="grid2">
        <label>${esc(t('f_date'))}<input type="date" name="date" value="${esc(it.date || '')}"></label>
        <label>${esc(t('f_duration'))}<select name="dur">${durs.map((d) => opt(d, it.dur, fmtDur(d))).join('')}</select></label>
      </div>
      <label>${esc(t('f_time'))}
        <div class="row"><input type="time" name="start" value="${esc(it.start || '')}" class="grow"><button type="button" class="btn soft" data-suggest>✨ ${esc(t('suggest_time'))}</button></div>
      </label>
      <div class="suggestions" id="sugg" aria-live="polite"></div>
      <div class="grid2">
        <label>${esc(t('f_repeat'))}<select name="rec">${RECS.map((r) => opt(r, it.rec, t(`rec_${r}`))).join('')}</select></label>
        <label>${esc(t('f_remind'))}<select name="remind">${REMINDS.map((r) => opt(r, it.remind ?? '', remindLabel(r))).join('')}</select></label>
      </div>
      <label>${esc(t('f_notes'))}<textarea name="notes" rows="2" maxlength="1000">${esc(it.notes || '')}</textarea></label>
      <div class="row between">
        ${isNew ? '<span></span>' : `<button type="button" class="btn danger ghost" data-del>🗑 ${esc(t('delete'))}</button>`}
        <button class="btn primary">${esc(t('save'))}</button>
      </div>
    </form>`);
  const form = $('#item-form', m);
  const sugg = $('#sugg', m);
  m.querySelector('[data-suggest]').onclick = () => {
    const date = form.date.value || todayStr();
    if (!form.date.value) form.date.value = date;
    const slots = suggestSlots(date, form.dur.value, { ignoreId: it.id, cat: form.cat.value });
    sugg.innerHTML = slots.length
      ? `<span class="muted">${esc(t('best_times'))}</span> ` + slots.map((s) => `<button type="button" class="chip" data-slot="${min2hm(s)}">${esc(fmtTime(s))}</button>`).join('')
      : `<span class="muted">${esc(t('no_free_slot'))}</span>`;
  };
  sugg.onclick = (e) => { const b = e.target.closest('[data-slot]'); if (b) { form.start.value = b.dataset.slot; sugg.innerHTML = ''; } };
  const del = m.querySelector('[data-del]');
  if (del) del.onclick = async () => {
    if (!(await confirmBox(t('confirm_delete')))) return;
    state.items = state.items.filter((x) => x.id !== it.id); save(); closeModal(); rerender();
  };
  form.onsubmit = (e) => {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(form).entries());
    Object.assign(it, { title: f.title.trim(), cat: f.cat, prio: Number(f.prio), date: f.date || null, start: f.start || null, dur: Number(f.dur), rec: f.date ? f.rec : 'none', remind: f.remind, notes: f.notes });
    if (!it.title) return;
    if (it.start && it.date) {
      const hard = conflictsAt(it.date, hm2min(it.start), it.dur, it.id).filter((b) => b.fixed && !b.soft);
      if (hard.length) toast(t('conflict_warn', { x: hard.map((b) => b.title).join('، ') }), 4500);
    }
    const i = state.items.findIndex((x) => x.id === it.id);
    if (i >= 0) state.items[i] = it; else state.items.push(it);
    save(); closeModal(); rerender();
    toast(isNew ? t('saved_new') : t('saved'));
  };
}
