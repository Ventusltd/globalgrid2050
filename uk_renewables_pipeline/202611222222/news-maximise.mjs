// V9.58: independent news reader expand/restore; never moves or rewrites headlines.
(() => {
  'use strict';
  const root = document.querySelector('.main > section.newspaper');
  const list = document.getElementById('liveNews');
  if (!root || !list || document.getElementById('pnNewsMaximise')) return;

  const toggle = document.createElement('button');
  toggle.id = 'pnNewsMaximise';
  toggle.type = 'button';
  toggle.setAttribute('aria-controls', 'liveNews');
  toggle.setAttribute('aria-pressed', 'false');
  const icon = document.createElement('span');
  icon.className = 'pn-news-icon';
  icon.setAttribute('aria-hidden', 'true');
  toggle.append(icon);
  root.append(toggle);

  const otherSections = [...root.parentElement.children].filter(el => el !== root);
  let opened = false;
  let saved = null;

  function label() {
    const text = opened ? 'Restore news window' : 'Maximise news window';
    icon.textContent = opened ? '⤡' : '⤢';
    toggle.setAttribute('aria-label', text);
    toggle.setAttribute('title', text);
    toggle.setAttribute('aria-pressed', String(opened));
  }

  function setOpen(next, restoreFocus = true) {
    if (next === opened) return;
    if (next) {
      const body = document.body, html = document.documentElement;
      saved = {
        scrollY: window.scrollY,
        newsScrollTop: list.scrollTop,
        body: {position:body.style.position, top:body.style.top, left:body.style.left,
          right:body.style.right, width:body.style.width, overflow:body.style.overflow},
        htmlOverflow: html.style.overflow,
        role: root.getAttribute('role'), ariaModal: root.getAttribute('aria-modal'),
        inert: otherSections.map(el => [el, el.inert])
      };
      opened = true;
      root.classList.add('pn-news-maximised');
      root.setAttribute('role', 'dialog');
      root.setAttribute('aria-modal', 'true');
      for (const [el] of saved.inert) el.inert = true;
      html.classList.add('pn-news-max-open');
      html.style.overflow = 'hidden';
      // The full-screen fixed overlay and overflow lock are enough here.
      // Avoid changing body.position on iPhone Safari: it can zero window.scrollY.
      body.style.overflow = 'hidden';
      label();
      toggle.focus({preventScroll:true});
      return;
    }
    opened = false;
    root.classList.remove('pn-news-maximised');
    if (saved.role === null) root.removeAttribute('role');
    else root.setAttribute('role', saved.role);
    if (saved.ariaModal === null) root.removeAttribute('aria-modal');
    else root.setAttribute('aria-modal', saved.ariaModal);
    for (const [el, inert] of saved.inert) el.inert = inert;
    const body = document.body, html = document.documentElement;
    html.classList.remove('pn-news-max-open');
    html.style.overflow = saved.htmlOverflow;
    for (const [key, value] of Object.entries(saved.body)) body.style[key] = value;
    const y = saved.scrollY;
    const newsScrollTop = saved.newsScrollTop;
    saved = null;
    label();
    if (restoreFocus) toggle.focus({preventScroll:true});
    // Enlarging may make all rows fit and clamp scrollTop to zero.
    // After returning to the original short reader, restore its prior position.
    // Restore after the original reader height is back; no DOM nodes are moved.
    requestAnimationFrame(() => {
      list.scrollTop = newsScrollTop;
      window.scrollTo(0, y);
      requestAnimationFrame(() => {
        list.scrollTop = newsScrollTop;
        if (Math.abs(window.scrollY - y) > 1) window.scrollTo(0, y);
      });
    });
  }

  toggle.addEventListener('click', () => setOpen(!opened));
  document.addEventListener('keydown', event => {
    if (opened && event.key === 'Escape') {
      event.preventDefault();
      setOpen(false);
    }
  });
  window.addEventListener('pagehide', () => { if (opened) setOpen(false, false); });
  label();
})();
