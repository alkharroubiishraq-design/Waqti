let renderer = null;
export const setRenderer = (fn) => { renderer = fn; };
export const rerender = () => renderer && renderer();
export const go = (path) => { if (location.hash === '#/' + path) rerender(); else location.hash = '#/' + path; };
export function route() {
  const [name, qs] = location.hash.replace(/^#\/?/, '').split('?');
  return { name: name || 'today', q: new URLSearchParams(qs || '') };
}
// مؤقتات خاصة بكل شاشة تُلغى عند التنقل
const timers = new Set();
export const every = (fn, ms) => { const id = setInterval(fn, ms); timers.add(id); return id; };
export const clearTimers = () => { timers.forEach(clearInterval); timers.clear(); };
