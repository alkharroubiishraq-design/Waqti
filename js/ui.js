import { t } from './i18n.js';

export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function toast(msg, ms = 2600) {
  const el = document.createElement('div');
  el.className = 'toast'; el.setAttribute('role', 'status'); el.textContent = msg;
  $('#toasts').appendChild(el);
  setTimeout(() => el.classList.add('out'), ms);
  setTimeout(() => el.remove(), ms + 400);
}

// نافذة منبثقة بسيطة، ترجع عنصر المحتوى
export function modal(html, { onClose } = {}) {
  closeModal();
  const wrap = document.createElement('div');
  wrap.className = 'modal-wrap'; wrap.id = 'modal';
  wrap.innerHTML = `<div class="modal" role="dialog" aria-modal="true"><button class="icon-btn modal-x" data-close aria-label="${esc(t('close'))}">✕</button>${html}</div>`;
  wrap.addEventListener('click', (e) => { if (e.target === wrap || e.target.closest('[data-close]')) closeModal(); });
  wrap._onClose = onClose;
  document.body.appendChild(wrap);
  requestAnimationFrame(() => wrap.classList.add('in'));
  const first = wrap.querySelector('input:not([type=hidden]),select,textarea');
  if (first && !matchMedia('(pointer:coarse)').matches) first.focus();
  return wrap.querySelector('.modal');
}
export function closeModal() {
  const m = $('#modal');
  if (m) { m._onClose && m._onClose(); m.remove(); }
}
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });

export function confirmBox(msg) {
  return new Promise((res) => {
    const m = modal(`<p class="confirm-msg">${esc(msg)}</p><div class="row end"><button class="btn ghost" data-no>${esc(t('cancel'))}</button><button class="btn danger" data-yes>${esc(t('confirm'))}</button></div>`, { onClose: () => res(false) });
    m.querySelector('[data-yes]').onclick = () => { $('#modal')._onClose = null; closeModal(); res(true); };
    m.querySelector('[data-no]').onclick = () => closeModal();
  });
}

export const formData = (form) => Object.fromEntries(new FormData(form).entries());

export function download(name, text, type = 'text/plain') {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
