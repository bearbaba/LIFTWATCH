/**
 * Compact, hash-addressable workspace.
 * Data/state fields remain mounted while only the selected view is visible.
 * Without JavaScript, all sections stay visible (progressive enhancement).
 */
export function resolveScreen(hash, screens) {
  if (!Array.isArray(screens) || screens.length === 0) return 'overview';
  const name = String(hash || '').replace(/^#/, '').trim().toLowerCase();
  return screens.includes(name) ? name : screens[0];
}
export function initializeWorkspace(doc = document, win = window) {
  const screens = String(doc.body?.dataset?.workspaceScreens || '')
    .split(',').map(x => x.trim()).filter(Boolean);
  if (!screens.length) return null;
  const sections = Array.from(doc.querySelectorAll('[data-workspace-screen]'));
  const links = Array.from(doc.querySelectorAll('.nav[href^="#"], .nav-link[href^="#"], .workspace-tab[href^="#"]'));
  if (!sections.length) return null;
  let previous = null;
  const apply = () => {
    const selected = resolveScreen(win.location?.hash, screens);
    for (const section of sections) {
      const active = section.dataset.workspaceScreen === selected;
      section.classList.toggle('workspace-active', active);
      section.hidden = !active;
      section.inert = !active;
      section.setAttribute('aria-hidden', String(!active));
    }
    for (const link of links) {
      const target = String(link.getAttribute('href') || '').replace(/^#/, '');
      const active = target === selected;
      link.classList.toggle('active', active);
      link.classList.toggle('is-active', active);
      if (active) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    }
    doc.body.classList.add('workspace-ready');
    if (previous !== null && previous !== selected) {
      try { win.scrollTo({top: 0, behavior: 'instant'}); }
      catch { win.scrollTo(0, 0); }
    }
    previous = selected;
    return selected;
  };
  win.addEventListener('hashchange', apply);
  apply();
  return {apply, get active() {return previous}};
}
if (typeof document !== 'undefined' && typeof window !== 'undefined') {
  initializeWorkspace(document, window);
}
