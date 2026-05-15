/* ─────────────────────────────────────────────────────────────
   Motion · Scroll orchestration
   - Reveal on intersect
   - Sticky nav state
   - Hero headline word-split
   - Pinned 5축 active-axis tracking
   - Soft parallax for hero X glyph
   ───────────────────────────────────────────────────────────── */

(() => {
  const $  = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const prefersReduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ── 1. Reveal observer ───────────────────────────── */
  const revealIO = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (e.isIntersecting) {
        e.target.classList.add('in');
        revealIO.unobserve(e.target);
      }
    }
  }, { rootMargin: '0px 0px -10% 0px', threshold: 0.08 });

  $$('[data-reveal], [data-stagger], .split-words').forEach(el => revealIO.observe(el));

  /* ── 2. Hero headline word-split (preserves inline HTML) ─ */
  const wrapWord = (txt) => {
    const w = document.createElement('span');
    w.className = 'w';
    const inner = document.createElement('span');
    inner.textContent = txt;
    w.appendChild(inner);
    return w;
  };
  const splitTextNode = (node) => {
    const parent = node.parentNode;
    const parts = node.textContent.split(/(\s+)/);
    const frag = document.createDocumentFragment();
    parts.forEach(p => {
      if (!p) return;
      if (/^\s+$/.test(p)) frag.appendChild(document.createTextNode(p));
      else frag.appendChild(wrapWord(p));
    });
    parent.replaceChild(frag, node);
  };
  const walkAndSplit = (root) => {
    const nodes = [];
    const walk = (n) => {
      n.childNodes.forEach(c => {
        if (c.nodeType === 3) nodes.push(c);
        else if (c.nodeType === 1 && c.tagName !== 'BR') walk(c);
      });
    };
    walk(root);
    nodes.forEach(splitTextNode);
  };
  $$('.split-words').forEach((el) => {
    if (el.dataset.split === 'done') return;
    walkAndSplit(el);
    el.dataset.split = 'done';
  });

  /* ── 3. Scroll-driven orchestration ───────────────── */
  const nav = $('.nav');
  const heroX = $('.hero-x');
  const axes = $('#framework');
  const orb = $('.axes-orb');
  const mockFrame = $('.mock-frame');
  const teacherMock = $('.teacher-mock');

  const lerp = (a, b, t) => a + (b - a) * t;
  const clamp01 = v => Math.max(0, Math.min(1, v));

  const onScroll = () => {
    const y = window.scrollY;
    const vh = window.innerHeight;
    if (nav) nav.classList.toggle('is-stuck', y > 24);

    if (prefersReduced) return;

    // Hero X — drift + slight rotation
    if (heroX) {
      const r = heroX.getBoundingClientRect();
      if (r.bottom > 0 && r.top < vh) {
        const p = (r.top - vh) * 0.05;
        const rot = (r.top / vh) * -8;
        heroX.style.transform = `translate3d(0, ${p}px, 0) rotate(${rot}deg)`;
      }
    }

    // Orb scroll progress (axes section)
    if (axes && orb) {
      const r = axes.getBoundingClientRect();
      const total = r.height - vh;
      const passed = -r.top;
      const p = clamp01(passed / total);
      // Orb travels horizontally from right to left across viewport,
      // morphs scale, rotates chromatic ring
      const tx = lerp(0, -38, p);          // 0vw → -38vw
      const ty = lerp(-50, -50, p);         // stays centered vertically
      const scale = lerp(1.0, 1.18, Math.sin(p * Math.PI));  // bulges at midpoint
      orb.style.transform = `translate(${tx}vw, ${ty}%) scale(${scale})`;
      orb.style.setProperty('--p', p.toFixed(3));
    }

    // Teacher mock — tilt unwinds as it crosses viewport center
    if (mockFrame && teacherMock) {
      const r = teacherMock.getBoundingClientRect();
      if (r.bottom > 0 && r.top < vh) {
        const center = (r.top + r.height / 2);
        const offset = (center - vh / 2) / vh;       // -0.5 .. 0.5 roughly
        const tilt = lerp(-6, 4, clamp01(0.5 - offset));
        const tiltX = lerp(2, -1, clamp01(0.5 - offset));
        mockFrame.style.transform = `rotateY(${tilt}deg) rotateX(${tiltX}deg)`;
      }
    }
  };
  document.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* ── 3b. Mouse parallax — hero X + SSEL letters ───── */
  const sselLetters = $$('.ssel-letter');
  if (!prefersReduced) {
    document.addEventListener('mousemove', (e) => {
      const cx = (e.clientX / window.innerWidth - 0.5) * 2;   // -1..1
      const cy = (e.clientY / window.innerHeight - 0.5) * 2;
      sselLetters.forEach((el, i) => {
        const intensity = 4 + i * 1.2;
        el.style.transform = `translate(${cx * intensity}px, ${cy * intensity}px)`;
      });
    }, { passive: true });
  }

  /* ── 4. Pinned 5축 active tracking ────────────────── */
  const cards = $$('.axis-card');
  const pins  = $$('.axes-pin-list li');
  if (cards.length && pins.length) {
    const setActive = (idx) => {
      pins.forEach((li, i) => li.classList.toggle('is-active', i === idx));
    };
    const axisIO = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          const idx = cards.indexOf(e.target);
          if (idx >= 0) setActive(idx);
        }
      });
    }, { rootMargin: '-45% 0px -45% 0px', threshold: 0 });
    cards.forEach(c => axisIO.observe(c));
    setActive(0);
  }

  /* ── 5. Hero stats count-up ───────────────────────── */
  const statIO = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (!e.isIntersecting) return;
      statIO.unobserve(e.target);
      const el = e.target;
      const target = parseFloat(el.dataset.count || '0');
      const decimals = (el.dataset.count || '').split('.')[1]?.length || 0;
      const dur = 1400;
      const t0 = performance.now();
      const tick = (t) => {
        const p = Math.min(1, (t - t0) / dur);
        const e = 1 - Math.pow(1 - p, 3);
        const v = (target * e).toFixed(decimals);
        el.textContent = v;
        if (p < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
  }, { threshold: 0.4 });
  $$('[data-count]').forEach(el => {
    if (prefersReduced) { el.textContent = el.dataset.count; return; }
    el.textContent = '0';
    statIO.observe(el);
  });

})();
