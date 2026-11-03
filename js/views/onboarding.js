import { state, save } from '../store.js';
import { t, LANGS, setLang, lang } from '../i18n.js';
import { esc, $ } from '../ui.js';
import { rerender, go } from '../router.js';
import { religionFields, bindReligion, cityField, bindCity, workSleepFields, bindWorkSleep } from './fields.js';

let step = 0;
const STEPS = ['lang', 'religion', 'city', 'work', 'done'];

export function render(el) {
  const s = state.settings;
  const id = STEPS[step];
  const dots = STEPS.map((_, i) => `<span class="${i <= step ? 'on' : ''}"></span>`).join('');
  let body = '';
  if (id === 'lang') body = `<h1>👋 ${esc(t('welcome'))}</h1><p class="muted">${esc(t('welcome_sub'))}</p>
    <div class="lang-grid">${LANGS.map(([c, n]) => `<button class="lang ${c === lang ? 'on' : ''}" data-lang="${c}" lang="${c}">${esc(n)}</button>`).join('')}</div>`;
  if (id === 'religion') body = `<h1>${esc(t('ob_religion'))}</h1><p class="muted">${esc(t('ob_religion_sub'))}</p><form class="form" onsubmit="return false">${religionFields(s)}</form>`;
  if (id === 'city') body = `<h1>${esc(t('ob_city'))}</h1><p class="muted">${esc(t('ob_city_sub'))}</p>${cityField(s)}`;
  if (id === 'work') body = `<h1>${esc(t('ob_work'))}</h1><p class="muted">${esc(t('ob_work_sub'))}</p><form class="form" onsubmit="return false">${workSleepFields(s)}</form>`;
  if (id === 'done') body = `<div class="center"><div class="big-emoji">🎉</div><h1>${esc(t('ob_done'))}</h1><p class="muted">${esc(t('ob_done_sub'))}</p><p class="muted small">🔒 ${esc(t('privacy_note'))}</p></div>`;

  el.innerHTML = `<div class="onb card">
    <div class="dots">${dots}</div>
    <div class="onb-body">${body}</div>
    <div class="row between onb-nav">
      ${step > 0 ? `<button class="btn ghost" data-back>${esc(t('back'))}</button>` : '<span></span>'}
      <button class="btn primary" data-next>${esc(id === 'done' ? t('start_app') : t('next'))}</button>
    </div></div>`;

  if (id === 'religion') bindReligion(el, s);
  if (id === 'city') bindCity(el, s);
  if (id === 'work') bindWorkSleep(el, s);

  el.onclick = async (e) => {
    const l = e.target.closest('[data-lang]');
    if (l) { s.lang = l.dataset.lang; await setLang(s.lang); save(); return rerender(); }
    if (e.target.closest('[data-back]')) { step = Math.max(0, step - 1); return rerender(); }
    if (e.target.closest('[data-next]')) {
      if (id === 'lang' && !s.lang) { s.lang = lang; save(); }
      if (id === 'done') { s.onboarded = true; save(); step = 0; go('today'); return rerender(); }
      step++;
      rerender();
    }
  };
}
