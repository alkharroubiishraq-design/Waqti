import { state, save, catById } from '../store.js';
import { t, fmtTime, fmtDate, fmtDur, fmtNum, hijri } from '../i18n.js';
import { esc, toast, $, $$ } from '../ui.js';
import { dayBlocks, itemsOn, isDone, setDone, autoPlan, suggestSlots, conflictsAt, fixedBlocks } from '../schedule.js';
import { nextPrayer, feastsOn, isRamadan, prayerTimes } from '../worship.js';
import { todayStr, parseYmd, ymd, addDays, min2hm, nowMin, hm2min, dateMin } from '../time.js';
import { go, rerender, every } from '../router.js';
import { openItemForm } from '../itemform.js';

const PX = 1.1; // بكسل لكل دقيقة
let fullDay = false;
let scrolledFor = null;

function layout(blocks) {
  // توزيع الأعمدة للعناصر المتداخلة
  const cols = []; let cluster = []; let clusterEnd = -1;
  const flush = () => { const n = Math.max(1, ...cluster.map((b) => b.col + 1)); cluster.forEach((b) => (b.ncol = n)); cluster = []; cols.length = 0; };
  for (const b of blocks) {
    if (b.start >= clusterEnd && cluster.length) flush();
    let c = cols.findIndex((end) => end <= b.start);
    if (c < 0) { c = cols.length; cols.push(0); }
    cols[c] = b.start + b.dur; b.col = c; cluster.push(b);
    clusterEnd = Math.max(clusterEnd, b.start + b.dur);
  }
  if (cluster.length) flush();
  return blocks;
}

function countdown(ms) {
  const m = Math.max(0, Math.round(ms / 60000));
  return fmtDur(m);
}

export function render(el, q) {
  const d = q.get('d') || todayStr();
  const s = state.settings;
  const isToday = d === todayStr();
  const date = parseYmd(d);
  const blocks = dayBlocks(d);
  const bands = blocks.filter((b) => b.type === 'sleep' || b.type === 'work');
  const cards = layout(blocks.filter((b) => !(b.type === 'sleep' || b.type === 'work')));
  const dayItems = itemsOn(d);
  const tray = [...dayItems.filter((it) => !it.start && !isDone(it, d)), ...state.items.filter((it) => !it.date && !isDone(it, d))];
  const doneCount = dayItems.filter((it) => isDone(it, d)).length;
  const prayed = state.logs.prayed[d] || {};

  // نطاق العرض
  const wake = hm2min(s.sleep.wake), bed = hm2min(s.sleep.bed);
  let r0 = 0, r1 = 1440;
  if (!fullDay) {
    const starts = cards.map((b) => b.start), ends = cards.map((b) => b.start + b.dur);
    r0 = Math.max(0, Math.floor((Math.min(wake, ...starts) - 30) / 60) * 60);
    r1 = bed > wake ? Math.min(1440, Math.ceil((Math.max(bed, ...ends) + 30) / 60) * 60) : 1440;
  }
  const H = (r1 - r0) * PX;
  const y = (m) => (m - r0) * PX;

  const feasts = feastsOn(d, s);
  let hero = '';
  if (isToday && s.religion === 'islam' && s.city) {
    const np = nextPrayer(s);
    if (np) hero = `<div class="hero"><div><div class="muted small">${esc(t('next_prayer'))}</div><div class="hero-title">${esc(t(`pr_${np.key}`))} · ${esc(fmtTime(dateMin(np.time)))}</div></div><div class="hero-count" id="np-count" data-at="${np.time.getTime()}">${esc(countdown(np.time - new Date()))}</div></div>`;
    if (isRamadan(date)) {
      const pt = prayerTimes(date, s);
      hero += `<div class="ramadan">🌙 ${esc(t('ramadan_kareem'))} · ${esc(t('suhoor_until'))} ${esc(fmtTime(dateMin(pt.fajr)))} · ${esc(t('iftar'))} ${esc(fmtTime(dateMin(pt.maghrib)))}</div>`;
    }
  } else if (s.religion === 'christian' && date.getDay() === Number(s.massDay)) {
    hero = `<div class="hero"><div><div class="muted small">${esc(t('weekly_mass'))}</div><div class="hero-title">⛪ ${esc(t('mass'))} · ${esc(fmtTime(hm2min(s.massTime)))}</div></div></div>`;
  }

  el.innerHTML = `
    <section class="day-head">
      <button class="icon-btn" data-nav="-1" aria-label="${esc(t('prev_day'))}">‹</button>
      <div class="day-title">
        <h1>${esc(isToday ? t('today') : fmtDate(date, { weekday: 'long' }))}</h1>
        <div class="muted">${esc(fmtDate(date, { day: 'numeric', month: 'long', year: 'numeric' }))}${s.religion === 'islam' ? ` · ${esc(hijri(date))}` : ''}</div>
      </div>
      <button class="icon-btn" data-nav="1" aria-label="${esc(t('next_day'))}">›</button>
    </section>
    ${isToday ? '' : `<div class="center"><button class="btn ghost small" data-today>${esc(t('back_today'))}</button></div>`}
    ${feasts.map((f) => `<div class="feast">🎉 ${esc(t(f.key))}</div>`).join('')}
    ${hero}
    <section class="day-actions">
      <button class="btn primary" data-add>＋ ${esc(t('add'))}</button>
      <button class="btn soft" data-auto>✨ ${esc(t('auto_plan'))}</button>
      <span class="muted small grow end-text">${esc(t('done_of', { a: fmtNum(doneCount), b: fmtNum(dayItems.length) }))}</span>
    </section>
    ${tray.length ? `<section class="tray card"><div class="muted small">${esc(t('unscheduled_hint'))}</div><div class="chips">${tray.map((it) => `<button class="chip drag-chip" data-chip="${it.id}" style="--c:${catById(it.cat).color}">${catById(it.cat).icon} ${esc(it.title)} <span class="muted">${esc(fmtDur(it.dur || 30))}</span></button>`).join('')}</div></section>` : ''}
    <section class="timeline card" id="timeline" style="height:${H}px" data-r0="${r0}">
      ${Array.from({ length: (r1 - r0) / 60 + 1 }, (_, i) => r0 + i * 60).map((m) => `<div class="hour" style="top:${y(m)}px"><span>${m < 1440 ? esc(fmtTime(m)) : ''}</span></div>`).join('')}
      ${bands.map((b) => { const a = Math.max(b.start, r0), z = Math.min(b.start + b.dur, r1); return z > a ? `<div class="band band-${b.type}" style="top:${y(a)}px;height:${(z - a) * PX}px"><span>${b.icon} ${esc(b.title)}</span></div>` : ''; }).join('')}
      ${cards.map((b) => {
        const top = y(Math.max(b.start, r0)), h = Math.max(22, b.dur * PX - 2);
        const w = 100 / b.ncol;
        const isP = b.type === 'prayer', checked = isP ? prayed[b.prayer] : b.done;
        const canCheck = isP || !b.fixed;
        return `<div class="block ${b.fixed ? 'fixed' : 'movable'} ${checked ? 'done' : ''} ${h < 40 ? 'tiny' : ''}" data-id="${esc(b.id)}" style="top:${top}px;height:${h}px;--c:${b.color};inset-inline-start:calc(${b.col * w}% + 2px);width:calc(${w}% - 4px)">
          ${canCheck ? `<button class="check" data-check="${esc(b.id)}" aria-label="${esc(t('mark_done'))}" aria-pressed="${!!checked}">${checked ? '✓' : ''}</button>` : ''}
          <div class="b-body" ${b.fixed ? '' : `data-edit="${esc(b.id)}"`}><div class="b-title">${b.icon} ${esc(b.title)}</div><div class="b-time">${esc(fmtTime(b.start))} – ${esc(fmtTime(b.start + b.dur))}</div></div>
          ${b.fixed ? '<span class="lock" aria-hidden="true">🔒</span>' : `<span class="grip" data-grip="${esc(b.id)}" aria-label="${esc(t('drag'))}">⠿</span>`}
        </div>`;
      }).join('')}
      ${isToday ? `<div class="now-line" id="now-line" style="top:${y(nowMin())}px"></div>` : ''}
    </section>
    <div class="center"><button class="btn ghost small" data-full>${esc(fullDay ? t('show_active') : t('show_full_day'))}</button></div>
  `;

  // الأحداث
  el.onclick = (e) => {
    const nav = e.target.closest('[data-nav]');
    if (nav) return go(`today?d=${ymd(addDays(date, Number(nav.dataset.nav)))}`);
    if (e.target.closest('[data-today]')) return go('today');
    if (e.target.closest('[data-full]')) { fullDay = !fullDay; return rerender(); }
    if (e.target.closest('[data-add]')) return openItemForm({ preset: { date: d } });
    if (e.target.closest('[data-auto]')) {
      const n = autoPlan(d); save(); rerender();
      return toast(n ? t('auto_planned', { n: fmtNum(n) }) : t('nothing_to_plan'));
    }
    const chk = e.target.closest('[data-check]');
    if (chk) {
      const id = chk.dataset.check;
      if (id.startsWith('p-')) {
        const k = id.slice(2); const log = (state.logs.prayed[d] = state.logs.prayed[d] || {});
        log[k] = !log[k]; if (!log[k]) delete log[k];
      } else { const it = state.items.find((x) => x.id === id); if (it) setDone(it, d, !isDone(it, d)); }
      save(); return rerender();
    }
    const ed = e.target.closest('[data-edit]');
    if (ed) { const it = state.items.find((x) => x.id === ed.dataset.edit); if (it) openItemForm({ item: it }); return; }
    // نقرة على مكان فاضي من الخط الزمني = إضافة بهالوقت
    const tl = e.target.closest('#timeline');
    if (tl && !e.target.closest('.block')) {
      const m = Math.round((r0 + (e.clientY - tl.getBoundingClientRect().top) / PX) / 15) * 15;
      openItemForm({ preset: { date: d, start: min2hm(m) } });
    }
  };

  setupDrag(el, d, r0, r1);

  // مؤقتات
  if (isToday) {
    every(() => {
      const nl = $('#now-line'); if (nl) nl.style.top = `${y(nowMin())}px`;
      const c = $('#np-count'); if (c) { const ms = Number(c.dataset.at) - Date.now(); if (ms <= 0) rerender(); else c.textContent = countdown(ms); }
    }, 30000);
  }
  if (scrolledFor !== d) {
    scrolledFor = d;
    const target = isToday ? nowMin() - 90 : wake;
    requestAnimationFrame(() => { const tl = $('#timeline'); if (tl) window.scrollTo({ top: Math.max(0, tl.offsetTop + y(target) - 80) }); });
  }
}

// السحب والإفلات (يعمل باللمس والماوس)
function setupDrag(el, d, r0, r1) {
  const tl = $('#timeline', el);
  let drag = null;
  const minAt = (clientY) => {
    const m = r0 + (clientY - tl.getBoundingClientRect().top) / PX;
    return Math.max(r0, Math.min(r1 - 15, Math.round(m / 5) * 5));
  };
  el.addEventListener('pointerdown', (e) => {
    const grip = e.target.closest('[data-grip]'), chip = e.target.closest('[data-chip]');
    if (!grip && !chip) return;
    const id = grip ? grip.dataset.grip : chip.dataset.chip;
    const it = state.items.find((x) => x.id === id); if (!it) return;
    const src = grip ? grip.closest('.block') : chip;
    const rect = src.getBoundingClientRect();
    drag = { it, chip: !!chip, src, x0: e.clientX, y0: e.clientY, off: e.clientY - rect.top, moved: false, pid: e.pointerId };
    src.setPointerCapture(e.pointerId);
    if (grip) e.preventDefault();
  });
  el.addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.pid) return;
    const dist = Math.abs(e.clientY - drag.y0) + Math.abs(e.clientX - drag.x0);
    if (!drag.moved && dist < 6) return;
    if (!drag.moved) {
      drag.moved = true;
      drag.ghost = document.createElement('div');
      drag.ghost.className = 'drag-ghost';
      drag.ghost.textContent = drag.it.title;
      drag.ghost.style.setProperty('--c', catById(drag.it.cat).color);
      drag.ghost.style.height = `${Math.max(26, (drag.it.dur || 30) * PX)}px`;
      document.body.appendChild(drag.ghost);
      drag.src.classList.add('dragging');
    }
    e.preventDefault();
    const top = drag.chip ? e.clientY - 14 : e.clientY - drag.off;
    const m = minAt(top);
    drag.ghost.style.top = `${top}px`;
    drag.ghost.style.left = `${tl.getBoundingClientRect().left + 56}px`;
    drag.ghost.style.width = `${tl.clientWidth - 64}px`;
    drag.ghost.dataset.time = fmtTime(m);
    drag.m = m;
    drag.over = e.clientY > tl.getBoundingClientRect().top && e.clientY < tl.getBoundingClientRect().bottom;
    if (e.clientY < 70) window.scrollBy(0, -12); else if (e.clientY > innerHeight - 90) window.scrollBy(0, 12);
  });
  const end = (e) => {
    if (!drag || e.pointerId !== drag.pid) return;
    const dg = drag; drag = null;
    dg.ghost && dg.ghost.remove();
    dg.src.classList.remove('dragging');
    if (!dg.moved) { if (dg.chip) openItemForm({ item: dg.it }); return; }
    if (!dg.over || dg.m == null) return;
    place(dg.it, d, dg.m);
  };
  el.addEventListener('pointerup', end);
  el.addEventListener('pointercancel', (e) => { if (drag) { drag.ghost && drag.ghost.remove(); drag.src.classList.remove('dragging'); drag = null; } });
}

function place(it, d, m) {
  const dur = Number(it.dur) || 30;
  const hard = conflictsAt(d, m, dur, it.id).filter((b) => b.fixed && !b.soft);
  let at = m;
  if (hard.length) {
    const [alt] = suggestSlots(d, dur, { ignoreId: it.id, from: m, cat: it.cat });
    if (alt != null) { at = alt; toast(t('moved_conflict', { x: hard[0].title, time: fmtTime(alt) }), 4000); }
    else toast(t('conflict_warn', { x: hard[0].title }), 4000);
  }
  it.start = min2hm(at);
  if (!it.date || (it.rec === 'none' || !it.rec)) it.date = d;
  save(); rerender();
}
