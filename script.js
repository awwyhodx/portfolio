// ------------------------------------------------------------------
// Intro: name / PROJECTS / CV start as a group in the centre,
// spread out to their places, then the page fades in.
// ------------------------------------------------------------------
async function playIntro() {
  const root = document.documentElement;
  if (!root.classList.contains('intro')) return;

  // Measure with the real font, but don't wait forever for it
  await Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 1500))]);

  const mobile = window.matchMedia('(max-width: 767px)').matches;
  const selector = mobile ? '#top[data-intro], [data-intro-mobile]' : '[data-intro]';
  const targets = [...document.querySelectorAll(selector)]
    .filter((el) => el.getBoundingClientRect().width > 0);

  // Copies of the labels, placed exactly where the real ones are
  const clones = targets.map((el) => {
    const r = el.getBoundingClientRect();
    const c = el.cloneNode(true);
    c.removeAttribute('id');
    c.removeAttribute('data-intro');
    c.removeAttribute('data-intro-mobile');
    c.classList.add('intro-clone');
    c.setAttribute('aria-hidden', 'true');
    Object.assign(c.style, { left: `${r.left}px`, top: `${r.top}px` });
    document.body.appendChild(c);
    return { c, r };
  });

  // Starting point: one centred row
  const gap = parseFloat(getComputedStyle(document.body).fontSize) * 1.5;
  const total = clones.reduce((sum, { r }) => sum + r.width, 0) + gap * (clones.length - 1);
  let x = (window.innerWidth - total) / 2;
  const centreY = window.innerHeight / 2;

  const ease = 'cubic-bezier(0.7, 0, 0.2, 1)';
  const animations = clones.map(({ c, r }) => {
    const dx = x - r.left;
    const dy = centreY - (r.top + r.height / 2);
    x += r.width + gap;
    const at = (tx, ty) => `translate(${tx}px, ${ty}px)`;

    // Desktop: spread sideways first, then rise (like the reference).
    // Mobile: labels stack in one column, so they go straight to place.
    const frames = mobile
      ? [
          { transform: at(dx, dy), opacity: 0 },
          { transform: at(dx, dy), opacity: 1, offset: 0.2 },
          { transform: at(dx, dy), offset: 0.4, easing: ease },
          { transform: at(0, 0) },
        ]
      : [
          { transform: at(dx, dy), opacity: 0 },
          { transform: at(dx, dy), opacity: 1, offset: 0.15 },
          { transform: at(dx, dy), offset: 0.3, easing: ease },
          { transform: at(0, dy), offset: 0.62, easing: ease },
          { transform: at(0, 0) },
        ];
    return c.animate(frames, { duration: mobile ? 1800 : 2400, fill: 'forwards' }).finished;
  });

  await Promise.all(animations);

  // Reveal the page: hairlines draw in, content fades in
  root.classList.add('revealing');
  root.classList.remove('intro');
  await new Promise((r) => setTimeout(r, 1000));

  clones.forEach(({ c }) => c.remove());
  root.classList.remove('intro-heads', 'revealing');
}

playIntro().catch(() => {
  document.documentElement.classList.remove('intro', 'intro-heads', 'revealing');
  document.querySelectorAll('.intro-clone').forEach((c) => c.remove());
});

// ------------------------------------------------------------------
// Live clock, bottom left (HH:MM:SS, visitor's local time)
// ------------------------------------------------------------------
const clock = document.querySelector('.clock');

function tick() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  clock.textContent = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
  clock.setAttribute('datetime', now.toISOString());
}

if (clock) {
  tick();
  setInterval(tick, 1000);
}

// ------------------------------------------------------------------
// Project pages: "#/<slug>" opens a project in place of the list,
// "(Close)" (href="#") brings the list back where it was.
// ------------------------------------------------------------------
const mid = document.querySelector('.col--mid');
const list = document.querySelector('.project-list');
const pages = [...document.querySelectorAll('.project-page')];
const isMobile = () => window.matchMedia('(max-width: 767px)').matches;
const baseTitle = document.title;
let listScroll = 0;
let lastSlug = null;

// Transition between the list and a project:
// the current view lifts away, then the project builds up row by row
// (rules draw in, text and frames rise), like the intro.
const motionOK = () => !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const EASE_OUT = 'cubic-bezier(0.2, 0.7, 0.2, 1)';
let routeToken = 0;
let firstRoute = true;

function leave(el) {
  if (!motionOK() || !el) return Promise.resolve();
  return el.animate(
    [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateY(-14px)' }],
    { duration: 280, easing: 'cubic-bezier(0.4, 0, 0.2, 1)', fill: 'forwards' },
  ).finished.catch(() => {});
}

function enterPage(el) {
  if (!motionOK()) return;
  [...el.children].slice(0, 14).forEach((child, i) => {
    const isRule = child.tagName === 'HR';
    child.animate(
      isRule
        ? [{ transform: 'scaleX(0)', transformOrigin: 'left center' }, { transform: 'scaleX(1)', transformOrigin: 'left center' }]
        : [{ opacity: 0, transform: 'translateY(22px)' }, { opacity: 1, transform: 'none' }],
      { duration: isRule ? 800 : 700, delay: 60 + i * 70, easing: EASE_OUT, fill: 'backwards' },
    );
  });
}

function enterList(el) {
  if (!motionOK()) return;
  el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 450, easing: 'ease-out' });
}

async function route() {
  const token = ++routeToken;
  const slug = location.hash.startsWith('#/') ? decodeURIComponent(location.hash.slice(2)) : null;
  const page = slug && pages.find((p) => p.dataset.slug === slug);
  const from = list.hidden ? pages.find((p) => !p.hidden) : list;
  const to = page || list;
  const animate = !firstRoute && from && from !== to;
  firstRoute = false;

  if (!list.hidden) listScroll = mid.scrollTop;
  if (animate) {
    await leave(from);
    if (token !== routeToken) return;          // another click happened meanwhile
  }
  from?.getAnimations().forEach((a) => a.cancel());

  if (page) {
    list.hidden = true;
    pages.forEach((p) => { p.hidden = p !== page; });
    mid.scrollTop = 0;
    if (isMobile()) mid.scrollIntoView();
    document.title = `${page.dataset.title} — ${baseTitle}`;
    lastSlug = slug;
    if (animate) enterPage(page);
    return;
  }

  const wasOpen = list.hidden;
  pages.forEach((p) => { p.hidden = true; });
  list.hidden = false;
  document.title = baseTitle;

  // Coming back via (Close): return to the project we left
  if (wasOpen && !location.hash.slice(1)) {
    if (isMobile()) {
      document.getElementById(lastSlug)?.scrollIntoView();
    } else {
      mid.scrollTop = listScroll;
    }
  }
  if (animate) enterList(list);
}

window.addEventListener('hashchange', route);
route();

// ------------------------------------------------------------------
// Case-study frames: reveal colours / type / images as they scroll
// into view; count the outcome numbers up.
// ------------------------------------------------------------------
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function countUp(container) {
  container.querySelectorAll('.outcome-num[data-count]').forEach((el) => {
    const target = Number(el.dataset.count);
    const suffix = el.dataset.suffix || '';
    const start = performance.now();
    const duration = 1200;
    const step = (now) => {
      const t = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      el.textContent = Math.round(target * eased).toLocaleString('en-GB') + (t === 1 ? suffix : '');
      if (t < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  });
}

if (!reduceMotion && 'IntersectionObserver' in window) {
  document.documentElement.classList.add('js-reveal');
  const io = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('is-in');
      if (entry.target.classList.contains('outcome-rows')) countUp(entry.target);
      io.unobserve(entry.target);
    });
  }, { threshold: 0.25 });
  document.querySelectorAll('[data-reveal]').forEach((el) => io.observe(el));

  // Tiles float up one after another (those entering together are staggered)
  const tileIO = new IntersectionObserver((entries) => {
    entries
      .filter((e) => e.isIntersecting)
      .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top || a.boundingClientRect.left - b.boundingClientRect.left)
      .forEach((entry, i) => {
        entry.target.style.setProperty('--d', `${i * 120}ms`);
        entry.target.classList.add('is-in');
        tileIO.unobserve(entry.target);
      });
  }, { threshold: 0.12 });
  document.querySelectorAll('.project-page .tile').forEach((el) => tileIO.observe(el));

  // Rules draw in
  const ruleIO = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('is-in');
      ruleIO.unobserve(entry.target);
    });
  });
  document.querySelectorAll('.project-page > hr').forEach((el) => ruleIO.observe(el));

  // Text rows: paragraphs rise line by line
  const rowIO = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      rowIO.unobserve(entry.target);
      revealLines(entry.target);
    });
  }, { threshold: 0.2 });
  document.querySelectorAll('.project-page .pp-info').forEach((el) => rowIO.observe(el));
}

// Wrap each visual line of a paragraph in its own mask, animate, then
// put the original text back so it re-flows normally on resize.
function revealLines(row) {
  row.classList.add('is-in');
  const paras = [...row.querySelectorAll('.pp-text p')];
  const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  let total = 0;
  paras.forEach((p) => {
    const original = p.innerHTML;
    const words = p.textContent.trim().split(/\s+/);
    p.innerHTML = words.map((w) => `<span class="w">${esc(w)}</span>`).join(' ');
    const lines = [];
    let top = null;
    p.querySelectorAll('.w').forEach((w) => {
      if (w.offsetTop !== top) { lines.push([]); top = w.offsetTop; }
      lines[lines.length - 1].push(w.textContent);
    });
    p.innerHTML = lines
      .map((l, i) => `<span class="line"><span style="--l:${total + i}">${l.map(esc).join(' ')}</span></span>`)
      .join('');
    p.dataset.split = '1';
    total += lines.length;
    p._original = original;
  });
  requestAnimationFrame(() => requestAnimationFrame(() => row.classList.add('lines-in')));
  setTimeout(() => {
    paras.forEach((p) => { p.innerHTML = p._original; });
    row.classList.remove('lines-in');
  }, total * 90 + 1100);
}

// ------------------------------------------------------------------
// Slideshows: switch images by themselves; the active dot fills up
// while a slide is shown. They only run while they're on screen.
// ------------------------------------------------------------------
const SLIDE_TIME = 4000;

document.querySelectorAll('[data-slideshow]').forEach((show) => {
  const slides = [...show.querySelectorAll('.slide')];
  if (slides.length < 2) { slides[0]?.classList.add('is-active'); return; }

  const dotsBox = document.createElement('div');
  dotsBox.className = 'dots';
  // Long documents get a "3 / 20" counter instead of a row of dots
  const counter = slides.length > 8 ? document.createElement('span') : null;
  if (counter) { dotsBox.classList.add('dots--count'); dotsBox.appendChild(counter); }
  const dots = counter ? [] : slides.map((_, i) => {
    const b = document.createElement('button');
    b.className = 'dot';
    b.type = 'button';
    b.setAttribute('aria-label', `Show image ${i + 1}`);
    b.addEventListener('click', (e) => { e.stopPropagation(); go(i); restart(); });
    dotsBox.appendChild(b);
    return b;
  });
  show.appendChild(dotsBox);
  show.style.setProperty('--slide-time', `${SLIDE_TIME}ms`);

  let current = 0;
  let timer = null;

  // Slides after the first have data-src: load them only when needed
  const load = (n) => {
    const s = slides[(n + slides.length) % slides.length];
    if (s.dataset.src && !s.getAttribute('src')) s.src = s.dataset.src;
  };

  function go(i) {
    slides[current].classList.remove('is-active');
    dots[current]?.classList.remove('is-active');
    current = (i + slides.length) % slides.length;
    load(current);
    if (timer) load(current + 1);             // get the next one ready while this one shows
    slides[current].classList.add('is-active');
    if (counter) { counter.textContent = `${current + 1} / ${slides.length}`; return; }
    // re-trigger the dot's fill animation
    const d = dots[current];
    d.classList.remove('is-active'); void d.offsetWidth; d.classList.add('is-active');
  }
  function start() { if (!timer && !reduceMotion) { load(current + 1); timer = setInterval(() => go(current + 1), SLIDE_TIME); } show.classList.remove('is-paused'); }
  function stop() { clearInterval(timer); timer = null; show.classList.add('is-paused'); }
  function restart() { stop(); start(); }

  show.slideIndex = () => current;          // used by the document viewer
  go(0);
  stop();
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(([entry]) => (entry.isIntersecting ? start() : stop()), { threshold: 0.4 }).observe(show);
  } else {
    start();
  }
});

// ------------------------------------------------------------------
// Click an image in a project gallery to see it full screen
// ------------------------------------------------------------------
const lightbox = document.querySelector('.lightbox');
const lightboxImg = lightbox.querySelector('img');

document.addEventListener('click', (e) => {
  const img = e.target.closest('.gallery img, img.zoomable');
  if (!img) return;
  lightboxImg.src = img.dataset.full || img.currentSrc || img.src;
  lightboxImg.alt = img.alt;
  lightbox.hidden = false;
});

lightbox.addEventListener('click', () => { lightbox.hidden = true; });

// ------------------------------------------------------------------
// Document viewer: click a document cover to flip through its pages
// full screen (arrows, ← → keys, swipe; Esc or (Close) to leave).
// ------------------------------------------------------------------
const viewer = document.createElement('div');
viewer.className = 'viewer';
viewer.hidden = true;
viewer.setAttribute('role', 'dialog');
viewer.setAttribute('aria-modal', 'true');
viewer.innerHTML = `
  <div class="viewer__bar"><span class="viewer__title"></span><span class="viewer__count muted"></span><button class="viewer__close" type="button">(Close)</button></div>
  <button class="viewer__nav viewer__prev" type="button" aria-label="Previous page">←</button>
  <div class="viewer__stage"></div>
  <button class="viewer__nav viewer__next" type="button" aria-label="Next page">→</button>`;
document.body.appendChild(viewer);

const viewerStage = viewer.querySelector('.viewer__stage');
let viewerPages = [];
let viewerAt = 0;

function viewerShow(i) {
  viewerAt = (i + viewerPages.length) % viewerPages.length;
  const page = viewerPages[viewerAt].cloneNode(true);
  page.classList.remove('slide', 'is-active', 'zoomable');
  page.removeAttribute('loading');
  if (page.dataset.full || page.dataset.src) page.src = page.dataset.full || page.dataset.src;   // full-size page in the viewer
  viewerStage.replaceChildren(page);
  viewer.querySelector('.viewer__count').textContent = `${viewerAt + 1} / ${viewerPages.length}`;
}
function viewerOpen(doc) {
  const stage = doc.querySelector('.doc__stage');
  viewerPages = [...stage.querySelectorAll('.slide')];
  viewer.querySelector('.viewer__title').textContent = doc.querySelector('figcaption')?.firstChild?.textContent.trim() || '';
  viewer.hidden = false;
  viewerShow(stage.slideIndex ? stage.slideIndex() : 0);
}
function viewerClose() { viewer.hidden = true; viewerStage.replaceChildren(); }

document.addEventListener('click', (e) => {
  const doc = e.target.closest('.doc');
  if (doc && !e.target.closest('.dot')) viewerOpen(doc);
});
viewer.querySelector('.viewer__prev').addEventListener('click', () => viewerShow(viewerAt - 1));
viewer.querySelector('.viewer__next').addEventListener('click', () => viewerShow(viewerAt + 1));
viewer.querySelector('.viewer__close').addEventListener('click', viewerClose);
document.addEventListener('keydown', (e) => {
  if (viewer.hidden) return;
  if (e.key === 'ArrowLeft') viewerShow(viewerAt - 1);
  else if (e.key === 'ArrowRight') viewerShow(viewerAt + 1);
  else if (e.key === 'Escape') viewerClose();
  else return;
  e.stopImmediatePropagation();
}, true);
let swipeX = null;
viewerStage.addEventListener('pointerdown', (e) => { swipeX = e.clientX; });
viewerStage.addEventListener('pointerup', (e) => {
  if (swipeX === null) return;
  const dx = e.clientX - swipeX;
  swipeX = null;
  if (Math.abs(dx) > 40) viewerShow(viewerAt + (dx < 0 ? 1 : -1));
});

// ------------------------------------------------------------------
// Overview mosaic preview: fills the grid with the case's own images
// (remove once the Figma mosaic image is in place).
// ------------------------------------------------------------------
document.querySelectorAll('.mosaic-preview__grid').forEach((grid) => {
  // Curated list in data-srcs (comma-separated); otherwise use the page's own images
  const page = grid.closest('.project-page');
  const srcs = grid.dataset.srcs
    ? grid.dataset.srcs.split(',').map((s) => s.trim()).filter(Boolean)
    : [...new Set([...page.querySelectorAll('.slide[src]')].map((img) => img.getAttribute('src')))];
  if (!srcs.length) return;
  const count = Number(grid.dataset.count) || (grid.dataset.srcs ? srcs.length : 48);   // data-count repeats a short list
  grid.innerHTML = Array.from({ length: count }, (_, i) => `<img src="${srcs[i % srcs.length]}" alt="" loading="lazy">`).join('');
});

// ------------------------------------------------------------------
// Previous / current / next project at the end of every project page
// (order follows the project pages in index.html, wrapping around).
// ------------------------------------------------------------------
pages.forEach((page, i) => {
  const prev = pages[(i - 1 + pages.length) % pages.length];
  const next = pages[(i + 1) % pages.length];
  const nav = document.createElement('nav');
  nav.className = 'pp-nav';
  nav.setAttribute('aria-label', 'More projects');
  nav.innerHTML = `
    <a class="pp-nav__prev" href="#/${prev.dataset.slug}"><span class="muted">← Previous</span><br>${prev.dataset.title}</a>
    <span class="pp-nav__current muted">${page.dataset.title}</span>
    <a class="pp-nav__next" href="#/${next.dataset.slug}"><span class="muted">Next →</span><br>${next.dataset.title}</a>`;
  const lastRule = [...page.children].filter((c) => c.tagName === 'HR').pop();
  page.insertBefore(nav, lastRule);
});

document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  if (!lightbox.hidden) {
    lightbox.hidden = true;
  } else if (location.hash.startsWith('#/')) {
    location.hash = '';
  }
});

// ------------------------------------------------------------------
// Videos in project pages: play while on screen, pause otherwise
// ------------------------------------------------------------------
document.querySelectorAll('.project-page video').forEach((v) => {
  if (reduceMotion || !('IntersectionObserver' in window)) { v.controls = true; return; }
  new IntersectionObserver(([e]) => {
    if (e.isIntersecting) { v.play().catch(() => {}); } else { v.pause(); }
  }, { threshold: 0.3 }).observe(v);
});

// ------------------------------------------------------------------
// Sydoria: footnote words jump to their section; long screenshots
// scroll inside their window while on screen
// ------------------------------------------------------------------
document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-jump]');
  if (!b) return;
  document.getElementById(b.dataset.jump)?.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
});

function sizeScroller(box) {
  const img = box.querySelector('img');
  if (!img.naturalWidth) return;
  const dist = img.getBoundingClientRect().height - box.getBoundingClientRect().height;
  box.style.setProperty('--dist', `${-Math.max(0, dist)}px`);
  box.style.setProperty('--dur', `${Math.max(8, Math.min(30, dist / 60))}s`);
}
document.querySelectorAll('.scroller').forEach((box) => {
  const img = box.querySelector('img');
  img.addEventListener('load', () => sizeScroller(box));
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(([e]) => {
      if (e.isIntersecting) sizeScroller(box);
      box.classList.toggle('is-playing', e.isIntersecting);
    }, { threshold: 0.2 }).observe(box);
  }
});
window.addEventListener('resize', () => document.querySelectorAll('.scroller').forEach(sizeScroller));

// ------------------------------------------------------------------
// Theme: the site is light; it fades to dark once the Sydoria project
// reaches the middle of the screen in the list, and the Sydoria case
// page stays dark. Other case pages are light.
// ------------------------------------------------------------------
(() => {
  const sydItem = document.getElementById('sydoria');
  const root = document.documentElement;
  function updateTheme() {
    const slug = location.hash.startsWith('#/') ? decodeURIComponent(location.hash.slice(2)) : '';
    const dark = slug
      ? slug === 'sydoria'
      : !!sydItem && sydItem.offsetParent !== null && sydItem.getBoundingClientRect().top < innerHeight * 0.6;
    root.classList.toggle('theme-dark', dark);
  }
  window.addEventListener('hashchange', () => { updateTheme(); setTimeout(updateTheme, 900); });  // again once the list is back
  document.addEventListener('scroll', updateTheme, { capture: true, passive: true });  // middle column scrolls on its own
  window.addEventListener('resize', updateTheme);
  updateTheme();
})();
