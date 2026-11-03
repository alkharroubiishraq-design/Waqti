// حقول مشتركة بين الإعداد الأول والإعدادات
import { state, save } from '../store.js';
import { t, weekdayName } from '../i18n.js';
import { esc, toast, $ } from '../ui.js';
import { searchCities, cityObj, nearestCity } from '../cities.js';
import { CALC_METHODS, methodForCountry } from '../worship.js';

const opt = (v, cur, label) => `<option value="${esc(v)}" ${String(v) === String(cur) ? 'selected' : ''}>${esc(label)}</option>`;

export function religionFields(s) {
  return `
    <fieldset class="choices" id="rel">
      ${[['islam', '☪️', 'rel_islam'], ['christian', '✝️', 'rel_christian'], ['none', '○', 'rel_none']].map(([v, ic, k]) => `<label class="choice"><input type="radio" name="religion" value="${v}" ${s.religion === v ? 'checked' : ''}><span>${ic} ${esc(t(k))}</span></label>`).join('')}
    </fieldset>
    <p class="muted small">${esc(t('rel_private'))}</p>
    <div class="rel-extra" data-for="islam" ${s.religion === 'islam' ? '' : 'hidden'}>
      <label>${esc(t('calc_method'))}<select name="calc">${CALC_METHODS.map((m) => opt(m, s.calc, t(`m_${m}`))).join('')}</select></label>
      <label>${esc(t('asr_method'))}<select name="madhab">${opt('shafi', s.madhab, t('madhab_shafi'))}${opt('hanafi', s.madhab, t('madhab_hanafi'))}</select></label>
      <label class="switch"><input type="checkbox" name="jumuah" ${s.jumuah ? 'checked' : ''}> ${esc(t('jumuah_block'))}</label>
    </div>
    <div class="rel-extra" data-for="christian" ${s.religion === 'christian' ? '' : 'hidden'}>
      <label>${esc(t('church_calendar'))}<select name="church">${opt('western', s.church, t('church_western'))}${opt('eastern', s.church, t('church_eastern'))}</select></label>
      <label data-fixed ${s.church === 'eastern' ? '' : 'hidden'}>${esc(t('fixed_feasts'))}<select name="fixedFeasts">${opt('gregorian', s.fixedFeasts, t('fixed_gregorian'))}${opt('julian', s.fixedFeasts, t('fixed_julian'))}</select></label>
      <div class="grid3">
        <label>${esc(t('mass_day'))}<select name="massDay">${[0, 1, 2, 3, 4, 5, 6].map((w) => opt(w, s.massDay, weekdayName(w))).join('')}</select></label>
        <label>${esc(t('mass_time'))}<input type="time" name="massTime" value="${esc(s.massTime)}"></label>
        <label>${esc(t('f_duration'))}<select name="massDur">${[45, 60, 90, 120, 150].map((d) => opt(d, s.massDur, `${d} ${t('min_short')}`)).join('')}</select></label>
      </div>
    </div>`;
}

export function bindReligion(root, s, onChange = () => {}) {
  root.addEventListener('change', (e) => {
    const n = e.target.name;
    if (n === 'religion') { s.religion = e.target.value; root.querySelectorAll('.rel-extra').forEach((x) => (x.hidden = x.dataset.for !== s.religion)); }
    else if (['calc', 'madhab', 'church', 'fixedFeasts', 'massTime'].includes(n)) s[n] = e.target.value;
    else if (n === 'massDay' || n === 'massDur') s[n] = Number(e.target.value);
    else if (n === 'jumuah') s.jumuah = e.target.checked;
    else return;
    if (n === 'church') { const f = root.querySelector('[data-fixed]'); if (f) f.hidden = s.church !== 'eastern'; }
    save(); onChange(n);
  });
}

export function cityField(s) {
  return `<div class="city-field">
    <div class="current-city" id="cur-city">${s.city ? `📍 ${esc(cityLabel(s.city))}` : `<span class="muted">${esc(t('no_city'))}</span>`}</div>
    <div class="row gap"><input type="search" id="city-q" class="grow" placeholder="${esc(t('city_search'))}" autocomplete="off"><button type="button" class="btn soft" id="gps">📡 ${esc(t('use_location'))}</button></div>
    <ul class="city-results" id="city-res" role="listbox"></ul>
  </div>`;
}
const cityLabel = (c) => (document.documentElement.lang === 'ar' && c.nameAr ? c.nameAr : c.name) + (c.cc ? ` (${c.cc})` : '');

export function bindCity(root, s, onPick = () => {}) {
  const q = $('#city-q', root), res = $('#city-res', root);
  const list = () => {
    const r = searchCities(q.value);
    res.innerHTML = r.map((c, i) => `<li><button type="button" data-ci="${i}">${esc(document.documentElement.lang === 'ar' ? c[1] : c[0])} <span class="muted small">${esc(c[2])}</span></button></li>`).join('');
    res._r = r;
  };
  q.addEventListener('input', list);
  q.addEventListener('focus', list);
  const pick = (city) => {
    const changedCountry = !s.city || s.city.cc !== city.cc;
    s.city = city;
    if (changedCountry && city.cc) s.calc = methodForCountry(city.cc);
    save(); $('#cur-city', root).innerHTML = `📍 ${esc(cityLabel(city))}`; res.innerHTML = ''; q.value = '';
    const sel = root.querySelector('select[name=calc]'); if (sel) sel.value = s.calc;
    onPick(city);
  };
  res.addEventListener('click', (e) => { const b = e.target.closest('[data-ci]'); if (b) pick(cityObj(res._r[Number(b.dataset.ci)])); });
  $('#gps', root).onclick = () => {
    if (!navigator.geolocation) return toast(t('gps_fail'));
    toast(t('gps_wait'));
    navigator.geolocation.getCurrentPosition((p) => {
      const { latitude: lat, longitude: lng } = p.coords;
      const near = nearestCity(lat, lng);
      pick(near ? { ...cityObj(near), lat, lng } : { name: `${lat.toFixed(3)}, ${lng.toFixed(3)}`, lat, lng, cc: '' });
    }, () => toast(t('gps_fail')), { enableHighAccuracy: false, timeout: 15000, maximumAge: 3600e3 });
  };
}

export function workSleepFields(s) {
  return `
    <label class="switch"><input type="checkbox" name="work_on" ${s.work.on ? 'checked' : ''}> ${esc(t('have_work'))}</label>
    <div data-work ${s.work.on ? '' : 'hidden'}>
      <div class="days">${[1, 2, 3, 4, 5, 6, 0].map((w) => `<label><input type="checkbox" name="wd" value="${w}" ${s.work.days.includes(w) ? 'checked' : ''}><span>${esc(weekdayName(w, 'short'))}</span></label>`).join('')}</div>
      <div class="grid2"><label>${esc(t('work_start'))}<input type="time" name="work_start" value="${esc(s.work.start)}"></label><label>${esc(t('work_end'))}<input type="time" name="work_end" value="${esc(s.work.end)}"></label></div>
    </div>
    <div class="grid2"><label>${esc(t('bed_time'))}<input type="time" name="bed" value="${esc(s.sleep.bed)}"></label><label>${esc(t('wake_time'))}<input type="time" name="wake" value="${esc(s.sleep.wake)}"></label></div>`;
}
export function bindWorkSleep(root, s) {
  root.addEventListener('change', (e) => {
    const n = e.target.name;
    if (n === 'work_on') { s.work.on = e.target.checked; root.querySelector('[data-work]').hidden = !s.work.on; }
    else if (n === 'wd') s.work.days = [...root.querySelectorAll('input[name=wd]:checked')].map((x) => Number(x.value));
    else if (n === 'work_start' && e.target.value) s.work.start = e.target.value;
    else if (n === 'work_end' && e.target.value) s.work.end = e.target.value;
    else if (n === 'bed' && e.target.value) s.sleep.bed = e.target.value;
    else if (n === 'wake' && e.target.value) s.sleep.wake = e.target.value;
    else return;
    save();
  });
}
