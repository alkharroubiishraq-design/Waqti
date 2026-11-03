import { state, onChange } from './store.js';
import { setLang, t, guessLang } from './i18n.js';
import { setRenderer, route, clearTimers, rerender } from './router.js';
import { startReminders } from './notify.js';
import { $, esc } from './ui.js';
import * as today from './views/today.js';
import * as tasks from './views/tasks.js';
import * as worship from './views/worship.js';
import * as study from './views/study.js';
import * as health from './views/health.js';
import * as habits from './views/habits.js';
import * as family from './views/family.js';
import * as stats from './views/stats.js';
import * as settings from './views/settings.js';
import * as cats from './views/cats.js';
import * as more from './views/more.js';
import * as onboarding from './views/onboarding.js';

const VIEWS = { today, tasks, worship, study, health, habits, family, stats, settings, cats, more };

function navItems() {
  const r = state.settings.religion;
  return [
    ['today', '🗓️', 'nav_today'],
    ['tasks', '✅', 'nav_tasks'],
    r !== 'none' ? ['worship', r === 'christian' ? '⛪' : '🕌', 'nav_worship'] : ['habits', '🔁', 'nav_habits'],
    ['stats', '📊', 'nav_stats'],
    ['more', '☰', 'nav_more'],
  ];
}

function applyTheme() {
  const th = state.settings.theme;
  if (th === 'auto') document.documentElement.removeAttribute('data-theme');
  else document.documentElement.dataset.theme = th;
}

function render() {
  clearTimers();
  applyTheme();
  const view = $('#view'), nav = $('#nav');
  document.title = t('app_name');
  $('#brand-name').textContent = t('app_name');
  if (!state.settings.onboarded) {
    nav.hidden = true; document.body.classList.add('onboarding');
    onboarding.render(view);
    return;
  }
  document.body.classList.remove('onboarding');
  nav.hidden = false;
  let { name, q } = route();
  if (!VIEWS[name] || (name === 'worship' && state.settings.religion === 'none')) name = 'today';
  const items = navItems();
  const activeTab = items.some((i) => i[0] === name) ? name : 'more';
  nav.innerHTML = items.map(([id, ic, key]) => `<a href="#/${id}" class="${id === activeTab ? 'active' : ''}" ${id === activeTab ? 'aria-current="page"' : ''}><span class="ni" aria-hidden="true">${ic}</span><span>${esc(t(key))}</span></a>`).join('');
  view.innerHTML = '';
  view.className = `view view-${name}`;
  VIEWS[name].render(view, q);
}

let lastLang = null;
async function boot() {
  const s = state.settings;
  await setLang(s.lang || guessLang());
  lastLang = s.lang;
  setRenderer(render);
  window.addEventListener('hashchange', () => { render(); window.scrollTo(0, 0); });
  onChange(async () => {
    if (state.settings.lang && state.settings.lang !== lastLang) { lastLang = state.settings.lang; await setLang(lastLang); rerender(); }
  });
  render();
  startReminders();
  if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('sw.js').catch(() => {});
}
boot();
