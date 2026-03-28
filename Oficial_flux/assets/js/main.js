/* ============================================================
   Flux Browser — Shared JavaScript
   ============================================================ */

// ── Active nav link on scroll ──────────────────────────────
function initScrollSpy() {
  const sections = document.querySelectorAll('section[id], [data-section]');
  const navLinks = document.querySelectorAll('a[href^="#"]');
  if (!sections.length || !navLinks.length) return;

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const id = entry.target.getAttribute('id') || entry.target.dataset.section;
        navLinks.forEach(link => {
          link.classList.toggle('active', link.getAttribute('href') === `#${id}`);
        });
      }
    });
  }, { rootMargin: '-40% 0px -55% 0px' });

  sections.forEach(s => observer.observe(s));
}

// ── Fade-up on scroll ──────────────────────────────────────
function initFadeUp() {
  const els = document.querySelectorAll('.fade-up');
  if (!els.length) return;

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1 });

  els.forEach(el => observer.observe(el));
}

// ── Docs sidebar active link ───────────────────────────────
function initSidebarSpy() {
  const headings = document.querySelectorAll('h2[id], h3[id]');
  const sideLinks = document.querySelectorAll('.sidebar-link[href^="#"]');
  if (!headings.length || !sideLinks.length) return;

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        sideLinks.forEach(link => {
          link.classList.toggle('active', link.getAttribute('href') === `#${entry.target.id}`);
        });
      }
    });
  }, { rootMargin: '-20% 0px -70% 0px' });

  headings.forEach(h => observer.observe(h));
}

// ── Mobile menu toggle ─────────────────────────────────────
function initMobileMenu() {
  const btn = document.getElementById('mobile-menu-btn');
  const menu = document.getElementById('mobile-menu');
  if (!btn || !menu) return;

  btn.addEventListener('click', () => {
    const open = menu.classList.toggle('hidden') === false;
    btn.setAttribute('aria-expanded', open);
  });

  // Close on link click
  menu.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => menu.classList.add('hidden'));
  });
}

// ── Download button counter ────────────────────────────────
function initDownloadBtn() {
  const btn = document.getElementById('download-btn');
  if (!btn) return;
  btn.addEventListener('click', () => {
    // Track download (local only, no analytics)
    const count = (parseInt(localStorage.getItem('flux_dl_count') || '0')) + 1;
    localStorage.setItem('flux_dl_count', count);
  });
}

// ── Copy code blocks ───────────────────────────────────────
function initCodeCopy() {
  document.querySelectorAll('.code-block').forEach(block => {
    const wrapper = document.createElement('div');
    wrapper.style.cssText = 'position:relative';
    block.parentNode.insertBefore(wrapper, block);
    wrapper.appendChild(block);

    const btn = document.createElement('button');
    btn.textContent = 'Copiar';
    btn.style.cssText = `
      position:absolute; top:10px; right:10px;
      background:rgba(6,182,212,0.15); border:1px solid rgba(6,182,212,0.3);
      color:#06b6d4; font-size:11px; font-weight:600; padding:4px 10px;
      border-radius:6px; cursor:pointer; transition:all 0.2s;
    `;
    btn.addEventListener('click', () => {
      navigator.clipboard.writeText(block.innerText).then(() => {
        btn.textContent = '¡Copiado!';
        btn.style.color = '#2dd4bf';
        setTimeout(() => { btn.textContent = 'Copiar'; btn.style.color = '#06b6d4'; }, 2000);
      });
    });
    wrapper.appendChild(btn);
  });
}

// ── Typewriter effect ──────────────────────────────────────
function initTypewriter(selector, texts, speed = 80, pause = 2500) {
  const el = document.querySelector(selector);
  if (!el) return;
  let ti = 0, ci = 0, deleting = false;

  function tick() {
    const full = texts[ti];
    if (deleting) {
      el.textContent = full.substring(0, ci--);
      if (ci < 0) { deleting = false; ti = (ti + 1) % texts.length; setTimeout(tick, 400); return; }
    } else {
      el.textContent = full.substring(0, ci++);
      if (ci > full.length) { deleting = true; setTimeout(tick, pause); return; }
    }
    setTimeout(tick, deleting ? speed / 2 : speed);
  }
  tick();
}

// ── Init all ──────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  initScrollSpy();
  initFadeUp();
  initSidebarSpy();
  initMobileMenu();
  initDownloadBtn();
  initCodeCopy();
});
