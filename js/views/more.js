import { state } from '../store.js';
import { t } from '../i18n.js';
import { esc } from '../ui.js';

export function render(el) {
  const r = state.settings.religion;
  const links = [
    r !== 'none' ? ['worship', r === 'christian' ? '⛪' : '🕌', 'nav_worship'] : null,
    ['study', '📚', 'nav_study'], ['health', '💪', 'nav_health'], ['habits', '🔁', 'nav_habits'],
    ['family', '👨‍👩‍👧', 'nav_family'], ['cats', '🎨', 'nav_cats'], ['stats', '📊', 'nav_stats'], ['settings', '⚙️', 'nav_settings'],
  ].filter(Boolean);
  el.innerHTML = `<div class="page-head"><h1>${esc(t('nav_more'))}</h1></div>
    <div class="more-grid">${links.map(([id, ic, k]) => `<a class="card tile" href="#/${id}"><span class="tile-ic">${ic}</span><span>${esc(t(k))}</span></a>`).join('')}</div>
    <p class="muted small center">🔒 ${esc(t('privacy_note'))}</p>`;
}
