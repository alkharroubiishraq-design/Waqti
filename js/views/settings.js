import { state, save, putFile, getFile, replaceState, resetAll } from '../store.js';
import { t, LANGS, lang } from '../i18n.js';
import { esc, toast, confirmBox, download, $ } from '../ui.js';
import { rerender } from '../router.js';
import { religionFields, bindReligion, cityField, bindCity, workSleepFields, bindWorkSleep } from './fields.js';
import { askPermission, permission, playSound, stopSound } from '../notify.js';
import { buildIcs } from '../ics.js';
import { todayStr } from '../time.js';

const opt = (v, cur, label) => `<option value="${esc(v)}" ${String(v) === String(cur) ? 'selected' : ''}>${esc(label)}</option>`;

export async function render(el) {
  const s = state.settings;
  const hasCustom = !!(await getFile('sound'));
  const perm = permission();
  el.innerHTML = `
    <div class="page-head"><h1>${esc(t('nav_settings'))}</h1></div>
    <section class="card form" id="s-general">
      <h2>🌐 ${esc(t('general'))}</h2>
      <label>${esc(t('language'))}<select name="lang">${LANGS.map(([c, n]) => opt(c, lang, n)).join('')}</select></label>
      <label>${esc(t('theme'))}<select name="theme">${opt('auto', s.theme, t('theme_auto'))}${opt('light', s.theme, t('theme_light'))}${opt('dark', s.theme, t('theme_dark'))}</select></label>
      <label>${esc(t('week_start'))}<select name="weekStart">${[6, 0, 1].map((w) => opt(w, s.weekStart, new Intl.DateTimeFormat(lang, { weekday: 'long' }).format(new Date(2024, 0, 7 + w)))).join('')}</select></label>
    </section>
    <section class="card form" id="s-rel"><h2>🕊️ ${esc(t('religion'))}</h2>${religionFields(s)}</section>
    <section class="card form" id="s-city"><h2>📍 ${esc(t('city'))}</h2>${cityField(s)}</section>
    <section class="card form" id="s-work"><h2>💼 ${esc(t('work_sleep'))}</h2>${workSleepFields(s)}</section>
    <section class="card form" id="s-rem">
      <h2>🔔 ${esc(t('reminders'))}</h2>
      <p class="small">${esc(t('notif_status'))}: <b>${esc(t(`perm_${perm}`))}</b> ${perm !== 'granted' && perm !== 'unsupported' ? `<button class="btn soft small" data-perm>${esc(t('enable_notif'))}</button>` : ''}</p>
      <label>${esc(t('default_remind'))}<select name="remindMin">${[0, 5, 10, 15, 30, 60].map((m) => opt(m, s.remindMin, m ? t('remind_before', { m }) : t('remind_at'))).join('')}</select></label>
      ${s.religion === 'islam' ? `<label class="switch"><input type="checkbox" name="prayerRemind" ${s.prayerRemind ? 'checked' : ''}> ${esc(t('prayer_remind'))}</label>` : ''}
      <label>${esc(t('sound'))}<select name="sound">${opt('calm', s.sound, t('sound_calm'))}${opt('custom', s.sound, t('sound_custom'))}${opt('none', s.sound, t('sound_none'))}</select></label>
      <div class="row gap wrap">
        <label class="btn soft small file-btn">📁 ${esc(hasCustom ? t('replace_audio') : t('upload_audio'))}<input type="file" accept="audio/*" id="audio" hidden></label>
        <button class="btn ghost small" data-test>▶ ${esc(t('test_sound'))}</button>
        <button class="btn ghost small" data-stop>■</button>
      </div>
      <p class="muted small">${esc(t('audio_hint'))}</p>
      <p class="muted small">ℹ️ ${esc(t('background_note'))}</p>
      <button class="btn soft" data-ics>📅 ${esc(t('export_ics'))}</button>
    </section>
    <section class="card form" id="s-health">
      <h2>💧 ${esc(t('nav_health'))}</h2>
      <label>${esc(t('water_goal'))}<input type="number" name="waterGoal" min="1" max="20" value="${esc(s.waterGoal)}"></label>
    </section>
    <section class="card form">
      <h2>🔒 ${esc(t('privacy'))}</h2>
      <p class="muted small">${esc(t('privacy_note'))}</p>
      <div class="row gap wrap">
        <button class="btn soft" data-export>⬇️ ${esc(t('backup_export'))}</button>
        <label class="btn soft file-btn">⬆️ ${esc(t('backup_import'))}<input type="file" accept="application/json,.json" id="import" hidden></label>
        <button class="btn danger ghost" data-reset>🗑 ${esc(t('reset_all'))}</button>
      </div>
    </section>
    <p class="muted small center">${esc(t('app_name'))} · v1.0 · ${esc(t('credits'))}</p>`;

  const gen = $('#s-general', el);
  gen.addEventListener('change', (e) => {
    const n = e.target.name;
    if (n === 'lang') { s.lang = e.target.value; save(); return; }
    if (n === 'theme') s.theme = e.target.value;
    if (n === 'weekStart') s.weekStart = Number(e.target.value);
    save(); rerender();
  });
  bindReligion($('#s-rel', el), s, (n) => { if (n === 'religion') rerender(); });
  bindCity($('#s-city', el), s, () => toast(t('saved')));
  bindWorkSleep($('#s-work', el), s);
  $('#s-rem', el).addEventListener('change', (e) => {
    const n = e.target.name;
    if (n === 'remindMin') s.remindMin = Number(e.target.value);
    else if (n === 'prayerRemind') s.prayerRemind = e.target.checked;
    else if (n === 'sound') s.sound = e.target.value;
    else return;
    save();
  });
  $('#s-health', el).addEventListener('change', (e) => { if (e.target.name === 'waterGoal') { s.waterGoal = Math.max(1, Math.min(20, Number(e.target.value) || 8)); save(); } });

  $('#audio', el).onchange = async (e) => {
    const f = e.target.files[0]; if (!f) return;
    if (f.size > 15 * 1024 * 1024) return toast(t('audio_too_big'));
    await putFile('sound', f); s.sound = 'custom'; save(); toast(t('saved')); rerender();
  };
  $('#import', el).onchange = async (e) => {
    const f = e.target.files[0]; if (!f) return;
    try {
      const data = JSON.parse(await f.text());
      if (!data || typeof data !== 'object' || !data.settings) throw new Error('bad');
      if (!(await confirmBox(t('import_confirm')))) return;
      replaceState(data); toast(t('imported')); rerender();
    } catch (err) { toast(t('import_fail')); }
  };
  el.onclick = async (e) => {
    if (e.target.closest('[data-perm]')) { await askPermission(); rerender(); }
    if (e.target.closest('[data-test]')) playSound(s.sound, true);
    if (e.target.closest('[data-stop]')) stopSound();
    if (e.target.closest('[data-ics]')) { download(`waqti-${todayStr()}.ics`, buildIcs(30), 'text/calendar'); toast(t('ics_done'), 5000); }
    if (e.target.closest('[data-export]')) download(`waqti-backup-${todayStr()}.json`, JSON.stringify(state, null, 1), 'application/json');
    if (e.target.closest('[data-reset]')) { if (await confirmBox(t('reset_confirm'))) { resetAll(); location.hash = '#/today'; location.reload(); } }
  };
}
