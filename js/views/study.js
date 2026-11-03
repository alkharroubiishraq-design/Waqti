import { state, save, uid } from '../store.js';
import { t, fmtTime, fmtDate, fmtDur, fmtNum, weekdayName } from '../i18n.js';
import { esc, modal, closeModal, toast, confirmBox, $ } from '../ui.js';
import { todayStr, parseYmd, daysBetween, hm2min, weekStartOf, addDays, ymd } from '../time.js';
import { rerender, every } from '../router.js';
import { openItemForm } from '../itemform.js';
import { playSound } from '../notify.js';
import { isDone } from '../schedule.js';

// حالة المؤقّت تبقى حتى لو تنقّلت بين الشاشات
const pomo = { mode: 'work', running: false, endsAt: 0, left: null, subject: '' };
const COLORS = ['#8b5cf6', '#3b82f6', '#10b981', '#f97316', '#ec4899', '#eab308', '#0ea5e9', '#ef4444'];

function logPomo(min) {
  const d = todayStr(), L = (state.logs.pomo[d] = state.logs.pomo[d] || { m: 0, s: {} });
  L.m += min; if (pomo.subject) L.s[pomo.subject] = (L.s[pomo.subject] || 0) + min;
  save();
}
function lenOf(mode) { return (mode === 'work' ? state.settings.pomo.work : state.settings.pomo.brk) * 60000; }
function leftMs() { return pomo.running ? pomo.endsAt - Date.now() : pomo.left ?? lenOf(pomo.mode); }
function fmtClock(ms) { const s = Math.max(0, Math.round(ms / 1000)); return `${fmtNum(Math.floor(s / 60), { minimumIntegerDigits: 2 })}:${fmtNum(s % 60, { minimumIntegerDigits: 2 })}`; }

// فحص انتهاء المؤقت (يعمل في الخلفية طالما التطبيق مفتوح)
setInterval(() => {
  if (pomo.running && Date.now() >= pomo.endsAt) {
    if (pomo.mode === 'work') logPomo(state.settings.pomo.work);
    pomo.mode = pomo.mode === 'work' ? 'break' : 'work';
    pomo.running = false; pomo.left = null;
    playSound(state.settings.sound === 'none' ? 'none' : 'calm');
    toast(pomo.mode === 'break' ? t('pomo_break_time') : t('pomo_work_time'), 5000);
    if (location.hash.startsWith('#/study')) rerender();
  }
  const el = document.getElementById('pomo-clock');
  if (el) el.textContent = fmtClock(leftMs());
}, 1000);

export function render(el) {
  const td = todayStr();
  const subs = state.subjects;
  const subName = (id) => subs.find((s) => s.id === id)?.name || '';
  const studyItems = state.items.filter((it) => it.cat === 'study');
  const exams = studyItems.filter((it) => (it.kind === 'exam' || it.kind === 'homework') && it.date && it.date >= td && !isDone(it, it.date)).sort((a, b) => a.date.localeCompare(b.date));
  const classes = studyItems.filter((it) => it.kind === 'class');
  const ws = weekStartOf(new Date(), state.settings.weekStart);
  let weekMin = 0; for (let i = 0; i < 7; i++) weekMin += state.logs.pomo[ymd(addDays(ws, i))]?.m || 0;
  const todayMin = state.logs.pomo[td]?.m || 0;
  const left = leftMs(), total = lenOf(pomo.mode), pct = 1 - left / total;

  el.innerHTML = `
    <div class="page-head"><h1>${esc(t('nav_study'))}</h1></div>
    <section class="card pomo ${pomo.mode}">
      <div class="row between"><h2>🍅 ${esc(t('pomodoro'))}</h2><span class="pill">${esc(pomo.mode === 'work' ? t('pomo_focus') : t('pomo_break'))}</span></div>
      <div class="ring" style="--p:${Math.max(0, Math.min(1, pct))}"><div id="pomo-clock" class="clock">${esc(fmtClock(left))}</div></div>
      <label class="center-block">${esc(t('subject'))}
        <select id="pomo-sub"><option value="">—</option>${subs.map((s) => `<option value="${s.id}" ${pomo.subject === s.id ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}</select>
      </label>
      <div class="row center gap">
        <button class="btn primary" data-pomo="toggle">${esc(pomo.running ? t('pause') : t('start'))}</button>
        <button class="btn ghost" data-pomo="reset">${esc(t('reset'))}</button>
        <button class="btn ghost" data-pomo="skip">${esc(t('skip'))}</button>
      </div>
      <div class="row center gap small muted">
        <label class="inline">${esc(t('pomo_work_len'))} <input type="number" min="5" max="90" id="pw" value="${state.settings.pomo.work}"></label>
        <label class="inline">${esc(t('pomo_break_len'))} <input type="number" min="1" max="30" id="pb" value="${state.settings.pomo.brk}"></label>
      </div>
      <p class="center muted small">${esc(t('focus_today', { a: fmtDur(todayMin) }))} · ${esc(t('focus_week', { a: fmtDur(weekMin) }))}</p>
    </section>

    <section class="card">
      <div class="row between"><h2>📝 ${esc(t('exams_homework'))}</h2>
        <div class="row gap"><button class="btn soft small" data-add="exam">＋ ${esc(t('exam'))}</button><button class="btn soft small" data-add="homework">＋ ${esc(t('homework'))}</button></div></div>
      ${exams.length ? `<ul class="list">${exams.map((it) => { const n = daysBetween(td, it.date); return `<li class="row-item" style="--c:#8b5cf6"><span class="pill ${n <= 2 ? 'warn' : ''}">${esc(n === 0 ? t('today') : t('in_days', { n: fmtNum(n) }))}</span><div class="grow" data-open="${it.id}"><div class="ri-title">${it.kind === 'exam' ? '🎓' : '📄'} ${esc(it.title)}</div><div class="muted small">${esc(fmtDate(parseYmd(it.date), { weekday: 'short', day: 'numeric', month: 'short' }))}${it.start ? ' · ' + esc(fmtTime(hm2min(it.start))) : ''}</div></div></li>`; }).join('')}</ul>` : `<p class="muted">${esc(t('no_exams'))}</p>`}
    </section>

    <section class="card">
      <div class="row between"><h2>🗓️ ${esc(t('class_schedule'))}</h2><button class="btn soft small" data-add="class">＋ ${esc(t('add_class'))}</button></div>
      ${classes.length ? [0, 1, 2, 3, 4, 5, 6].map((w) => { const cs = classes.filter((c) => parseYmd(c.date).getDay() === w).sort((a, b) => (a.start || '').localeCompare(b.start || '')); return cs.length ? `<div class="wk"><b>${esc(weekdayName(w))}</b> ${cs.map((c) => `<button class="chip" data-open="${c.id}">${esc(c.title)} · ${esc(fmtTime(hm2min(c.start)))}</button>`).join('')}</div>` : ''; }).join('') : `<p class="muted">${esc(t('no_classes'))}</p>`}
    </section>

    <section class="card">
      <div class="row between"><h2>📚 ${esc(t('subjects'))}</h2><button class="btn soft small" data-sub-add>＋ ${esc(t('add'))}</button></div>
      <div class="chips">${subs.map((s) => `<button class="chip" style="--c:${s.color}" data-sub="${s.id}"><span class="dot"></span>${esc(s.name)} ${state.logs.pomo ? '' : ''}</button>`).join('') || `<p class="muted">${esc(t('no_subjects'))}</p>`}</div>
    </section>
  `;

  $('#pomo-sub', el).onchange = (e) => { pomo.subject = e.target.value; };
  $('#pw', el).onchange = (e) => { state.settings.pomo.work = Math.max(5, Math.min(90, Number(e.target.value) || 25)); save(); if (!pomo.running) { pomo.left = null; rerender(); } };
  $('#pb', el).onchange = (e) => { state.settings.pomo.brk = Math.max(1, Math.min(30, Number(e.target.value) || 5)); save(); if (!pomo.running) { pomo.left = null; rerender(); } };
  every(() => { const r = el.querySelector('.ring'); if (r) r.style.setProperty('--p', Math.max(0, Math.min(1, 1 - leftMs() / lenOf(pomo.mode)))); }, 1000);

  el.onclick = async (e) => {
    const p = e.target.closest('[data-pomo]');
    if (p) {
      const a = p.dataset.pomo;
      if (a === 'toggle') {
        if (pomo.running) { pomo.left = pomo.endsAt - Date.now(); pomo.running = false; }
        else { pomo.endsAt = Date.now() + (pomo.left ?? lenOf(pomo.mode)); pomo.running = true; pomo.left = null; }
      } else if (a === 'reset') { pomo.running = false; pomo.left = null; }
      else if (a === 'skip') { pomo.mode = pomo.mode === 'work' ? 'break' : 'work'; pomo.running = false; pomo.left = null; }
      return rerender();
    }
    const add = e.target.closest('[data-add]');
    if (add) {
      const k = add.dataset.add;
      if (k === 'class') return classForm();
      return openItemForm({ preset: { cat: 'study', kind: k, remind: '1440', dur: k === 'exam' ? 120 : 60 }, title: t(k === 'exam' ? 'add_exam' : 'add_homework') });
    }
    const op = e.target.closest('[data-open]');
    if (op) { const it = state.items.find((x) => x.id === op.dataset.open); if (it) openItemForm({ item: it }); return; }
    if (e.target.closest('[data-sub-add]')) return subjectForm();
    const sb = e.target.closest('[data-sub]');
    if (sb) subjectForm(state.subjects.find((s) => s.id === sb.dataset.sub));
  };
}

function subjectForm(sub) {
  const m = modal(`<h2>${esc(sub ? t('edit') : t('add_subject'))}</h2><form class="form" id="sf">
    <label>${esc(t('f_title'))}<input name="name" required maxlength="60" value="${esc(sub?.name || '')}"></label>
    <div class="swatches">${COLORS.map((c, i) => `<label><input type="radio" name="color" value="${c}" ${(sub?.color || COLORS[0]) === c ? 'checked' : ''}><span style="background:${c}"></span></label>`).join('')}</div>
    <div class="row between">${sub ? `<button type="button" class="btn danger ghost" data-del>🗑 ${esc(t('delete'))}</button>` : '<span></span>'}<button class="btn primary">${esc(t('save'))}</button></div></form>`);
  $('#sf', m).onsubmit = (e) => {
    e.preventDefault(); const f = Object.fromEntries(new FormData(e.target).entries());
    if (sub) Object.assign(sub, f); else state.subjects.push({ id: uid(), ...f });
    save(); closeModal(); rerender();
  };
  const d = m.querySelector('[data-del]');
  if (d) d.onclick = async () => { if (await confirmBox(t('confirm_delete'))) { state.subjects = state.subjects.filter((s) => s !== sub); save(); rerender(); } };
}

function classForm() {
  const subs = state.subjects;
  const m = modal(`<h2>${esc(t('add_class'))}</h2><form class="form" id="cf">
    <label>${esc(t('subject'))}${subs.length ? `<select name="sub">${subs.map((s) => `<option value="${s.id}">${esc(s.name)}</option>`).join('')}</select>` : `<input name="name" required maxlength="60">`}</label>
    <div class="grid2"><label>${esc(t('weekday'))}<select name="wd">${[0, 1, 2, 3, 4, 5, 6].map((w) => `<option value="${w}" ${w === new Date().getDay() ? 'selected' : ''}>${esc(weekdayName(w))}</option>`).join('')}</select></label>
    <label>${esc(t('f_time'))}<input type="time" name="start" value="08:00" required></label></div>
    <label>${esc(t('f_duration'))}<select name="dur">${[45, 50, 60, 90, 120].map((d) => `<option value="${d}" ${d === 60 ? 'selected' : ''}>${esc(fmtDur(d))}</option>`).join('')}</select></label>
    <div class="row end"><button class="btn primary">${esc(t('save'))}</button></div></form>`);
  $('#cf', m).onsubmit = (e) => {
    e.preventDefault(); const f = Object.fromEntries(new FormData(e.target).entries());
    const title = f.sub ? subs.find((s) => s.id === f.sub).name : f.name.trim();
    // أول تاريخ قادم بنفس اليوم
    const base = new Date(); const diff = (Number(f.wd) - base.getDay() + 7) % 7;
    state.items.push({ id: uid(), title, cat: 'study', kind: 'class', subject: f.sub || '', date: ymd(addDays(base, diff)), start: f.start, dur: Number(f.dur), prio: 2, rec: 'weekly', remind: '10', notes: '' });
    save(); closeModal(); rerender(); toast(t('saved_new'));
  };
}
