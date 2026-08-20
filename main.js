/* ==========================================================================
   Cognein — motion & interaction
   No dependencies. Everything here is an enhancement: with JS off the page
   stays fully readable, and with prefers-reduced-motion nothing moves.
   ========================================================================== */
(function () {
  "use strict";

  var motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  var reduced = motionQuery.matches;
  var raf = window.requestAnimationFrame.bind(window);

  function $(sel, root) {
    return (root || document).querySelector(sel);
  }

  function $$(sel, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(sel));
  }

  /* ======================================================================
     1. Neural field — the hero's living background
     ====================================================================== */
  function neuralField(canvas) {
    var ctx = canvas.getContext("2d", { alpha: true });
    var nodes = [];
    var w = 0;
    var h = 0;
    var dpr = 1;
    var pointer = { x: -9999, y: -9999, active: false };
    var running = false;
    var frame = 0;

    var LINK_DIST = 132;
    var POINTER_DIST = 190;

    function size() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      var rect = canvas.getBoundingClientRect();
      w = rect.width;
      h = rect.height;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      seed();
    }

    function seed() {
      // Density scales with area, but stays bounded on very large screens.
      var target = Math.round(Math.min(Math.max((w * h) / 15000, 34), 104));
      nodes = [];
      for (var i = 0; i < target; i++) {
        nodes.push({
          x: Math.random() * w,
          y: Math.random() * h,
          vx: (Math.random() - 0.5) * 0.22,
          vy: (Math.random() - 0.5) * 0.22,
          r: Math.random() * 1.5 + 0.7,
          // A few nodes glow violet so the field never reads as one flat hue.
          violet: Math.random() < 0.18
        });
      }
    }

    function step() {
      if (!running) return;
      frame++;
      ctx.clearRect(0, 0, w, h);

      var i;
      var j;
      var a;
      var b;

      for (i = 0; i < nodes.length; i++) {
        a = nodes[i];
        a.x += a.vx;
        a.y += a.vy;

        // Wrap rather than bounce — no visible walls.
        if (a.x < -20) a.x = w + 20;
        if (a.x > w + 20) a.x = -20;
        if (a.y < -20) a.y = h + 20;
        if (a.y > h + 20) a.y = -20;
      }

      // Links
      for (i = 0; i < nodes.length; i++) {
        a = nodes[i];
        for (j = i + 1; j < nodes.length; j++) {
          b = nodes[j];
          var dx = a.x - b.x;
          var dy = a.y - b.y;
          var d2 = dx * dx + dy * dy;
          if (d2 > LINK_DIST * LINK_DIST) continue;
          var d = Math.sqrt(d2);
          var alpha = (1 - d / LINK_DIST) * 0.42;
          ctx.strokeStyle = "rgba(0,179,255," + alpha.toFixed(3) + ")";
          ctx.lineWidth = 0.7;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        }
      }

      // Pointer draws its own threads — the field notices you
      if (pointer.active) {
        for (i = 0; i < nodes.length; i++) {
          a = nodes[i];
          var pdx = a.x - pointer.x;
          var pdy = a.y - pointer.y;
          var pd = Math.sqrt(pdx * pdx + pdy * pdy);
          if (pd > POINTER_DIST) continue;
          var pa = (1 - pd / POINTER_DIST) * 0.5;
          ctx.strokeStyle = "rgba(127,219,255," + pa.toFixed(3) + ")";
          ctx.lineWidth = 0.8;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(pointer.x, pointer.y);
          ctx.stroke();

          // Gentle drift toward the cursor
          a.x -= pdx * 0.0016;
          a.y -= pdy * 0.0016;
        }
      }

      // Nodes, with a slow individual pulse
      for (i = 0; i < nodes.length; i++) {
        a = nodes[i];
        var pulse = 0.55 + Math.sin(frame * 0.014 + i) * 0.28;
        ctx.fillStyle = a.violet
          ? "rgba(155,133,255," + pulse.toFixed(3) + ")"
          : "rgba(51,196,255," + pulse.toFixed(3) + ")";
        ctx.beginPath();
        ctx.arc(a.x, a.y, a.r, 0, Math.PI * 2);
        ctx.fill();
      }

      raf(step);
    }

    function start() {
      if (running) return;
      running = true;
      raf(step);
    }

    function stop() {
      running = false;
    }

    size();
    canvas.classList.add("is-live");
    start();

    var resizeTimer;
    window.addEventListener("resize", function () {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(size, 180);
    });

    window.addEventListener(
      "pointermove",
      function (e) {
        var rect = canvas.getBoundingClientRect();
        var inside =
          e.clientX >= rect.left &&
          e.clientX <= rect.right &&
          e.clientY >= rect.top &&
          e.clientY <= rect.bottom;
        pointer.active = inside && e.pointerType === "mouse";
        pointer.x = e.clientX - rect.left;
        pointer.y = e.clientY - rect.top;
      },
      { passive: true }
    );

    window.addEventListener("blur", stop);
    window.addEventListener("focus", start);
    document.addEventListener("visibilitychange", function () {
      document.hidden ? stop() : start();
    });

    // Don't burn frames once the hero is scrolled past.
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(
        function (entries) {
          entries[0].isIntersecting ? start() : stop();
        },
        { threshold: 0 }
      ).observe(canvas);
    }
  }

  /* ======================================================================
     2. Split headlines into masked words
     ====================================================================== */
  function splitWords(el) {
    var lines = el.innerHTML.split(/<br\s*\/?>/i);
    var index = 0;
    el.innerHTML = lines
      .map(function (line) {
        var words = line
          .trim()
          .split(/\s+/)
          .filter(Boolean)
          .map(function (word) {
            var delay = index * 55;
            index++;
            return (
              '<span class="word"><span style="--d:' + delay + 'ms">' + word + "</span></span>"
            );
          })
          .join(" ");
        return '<span class="line">' + words + "</span>";
      })
      .join("");
  }

  /* ======================================================================
     3. Reveal on scroll
     ====================================================================== */
  function initReveals() {
    var splits = $$("[data-split]");
    splits.forEach(splitWords);

    var targets = $$("[data-reveal], [data-split], .rule");

    if (reduced || !("IntersectionObserver" in window)) {
      targets.forEach(function (el) {
        el.classList.add("is-visible");
      });
      return;
    }

    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("is-visible");
          io.unobserve(entry.target);
        });
      },
      { rootMargin: "0px 0px -10% 0px", threshold: 0.12 }
    );

    targets.forEach(function (el) {
      // Stagger siblings so grids cascade instead of popping in together.
      if (el.hasAttribute("data-stagger")) {
        var sibs = Array.prototype.slice.call(el.parentElement.children);
        var i = sibs.indexOf(el);
        if (i > 0) el.style.setProperty("--d", Math.min(i, 6) * 90 + "ms");
      }
      io.observe(el);
    });
  }

  /* ======================================================================
     4. Header: condense on scroll, hide on the way down
     ====================================================================== */
  function initHeader() {
    var header = $("[data-header]");
    if (!header) return;
    var last = window.scrollY;
    var ticking = false;

    function update() {
      var y = window.scrollY;
      header.classList.toggle("is-scrolled", y > 12);

      var menuOpen =
        document.querySelector("[data-nav-toggle]") &&
        document.querySelector("[data-nav-toggle]").getAttribute("aria-expanded") === "true";

      if (!menuOpen) {
        header.classList.toggle("is-hidden", y > 420 && y > last + 4);
      }

      last = y;
      ticking = false;
    }

    window.addEventListener(
      "scroll",
      function () {
        if (ticking) return;
        ticking = true;
        raf(update);
      },
      { passive: true }
    );

    update();
  }

  /* ======================================================================
     5. Scroll progress rail
     ====================================================================== */
  function initProgress() {
    var bar = $("[data-progress]");
    if (!bar) return;
    var ticking = false;

    function update() {
      var max = document.documentElement.scrollHeight - window.innerHeight;
      var p = max > 0 ? Math.min(window.scrollY / max, 1) : 0;
      bar.style.scale = p + " 1";
      ticking = false;
    }

    window.addEventListener(
      "scroll",
      function () {
        if (ticking) return;
        ticking = true;
        raf(update);
      },
      { passive: true }
    );

    update();
  }

  /* ======================================================================
     6. Mobile menu
     ====================================================================== */
  function initMenu() {
    var toggle = $("[data-nav-toggle]");
    var nav = $("[data-mobile-nav]");
    if (!toggle || !nav) return;

    function close() {
      toggle.setAttribute("aria-expanded", "false");
      nav.classList.remove("is-open");
      document.body.style.removeProperty("overflow");
    }

    toggle.addEventListener("click", function () {
      var open = toggle.getAttribute("aria-expanded") === "true";
      toggle.setAttribute("aria-expanded", String(!open));
      nav.classList.toggle("is-open", !open);
      document.body.style.overflow = open ? "" : "hidden";
    });

    nav.addEventListener("click", function (e) {
      if (e.target.closest("a")) close();
    });

    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && toggle.getAttribute("aria-expanded") === "true") {
        close();
        toggle.focus();
      }
    });

    window.addEventListener("resize", function () {
      if (window.innerWidth > 780) close();
    });
  }

  /* ======================================================================
     7. The math — 365 dots filling as you scroll, hours counting up
     ====================================================================== */
  function initMath() {
    var grid = $("[data-dots]");
    var readout = $("[data-hours]");
    if (!grid) return;

    var TOTAL = 365;
    var HOURS = 30; // 5 min x 365 days = 1,825 min ≈ 30 hours
    var dots = [];
    var lit = 0;
    var i;

    var frag = document.createDocumentFragment();
    for (i = 0; i < TOTAL; i++) {
      var d = document.createElement("span");
      d.className = "math__dot";
      frag.appendChild(d);
      dots.push(d);
    }
    grid.appendChild(frag);

    if (reduced) {
      dots.forEach(function (d) {
        d.classList.add("is-lit");
      });
      if (readout) readout.textContent = String(HOURS);
      return;
    }

    // The markup ships the final figure so it still reads correctly without
    // JS; only once we can animate do we wind it back to zero.
    if (readout) readout.textContent = "0";

    // Geometry is cached so the scroll handler never forces a layout read —
    // measuring inside the loop was the other half of the stutter.
    var docTop = 0;
    var vh = window.innerHeight;
    var ticking = false;

    function measure() {
      docTop = grid.getBoundingClientRect().top + window.scrollY;
      vh = window.innerHeight;
    }

    function update() {
      ticking = false;
      var top = docTop - window.scrollY;
      // Starts as the grid clears the fold and finishes within half a screen,
      // so the fill keeps up with an ordinary scroll instead of trailing it.
      var p = (vh * 0.95 - top) / (vh * 0.4);
      p = p < 0 ? 0 : p > 1 ? 1 : p;

      var want = (p * TOTAL) | 0;
      if (want === lit) return;

      if (want > lit) {
        for (i = lit; i < want; i++) dots[i].classList.add("is-lit");
      } else {
        for (i = want; i < lit; i++) dots[i].classList.remove("is-lit");
      }
      lit = want;
      if (readout) readout.textContent = String(Math.round(p * HOURS));
    }

    function remeasure() {
      measure();
      update();
    }

    window.addEventListener(
      "scroll",
      function () {
        if (ticking) return;
        ticking = true;
        raf(update);
      },
      { passive: true }
    );

    window.addEventListener("resize", remeasure);
    // Late webfonts reflow everything above the grid, so re-measure once
    // they land rather than trusting the first-paint position.
    window.addEventListener("load", remeasure);
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(remeasure);
    }

    remeasure();
  }

  /* ======================================================================
     8. Steps unlock in sequence, mirroring the app's lesson list
     ====================================================================== */
  function initSteps() {
    var steps = $$("[data-step]");
    if (!steps.length) return;

    if (reduced || !("IntersectionObserver" in window)) {
      steps.forEach(function (s) {
        s.classList.add("is-open");
      });
      return;
    }

    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          var el = entry.target;
          var order = steps.indexOf(el);
          setTimeout(function () {
            el.classList.add("is-open");
          }, order * 260);
          io.unobserve(el);
        });
      },
      { threshold: 0.45 }
    );

    steps.forEach(function (s) {
      io.observe(s);
    });
  }

  /* ======================================================================
     9. Cursor spotlight on cards
     ====================================================================== */
  function initSpotlight() {
    if (reduced) return;
    if (!window.matchMedia("(hover: hover)").matches) return;

    $$("[data-spotlight]").forEach(function (card) {
      card.addEventListener(
        "pointermove",
        function (e) {
          var r = card.getBoundingClientRect();
          card.style.setProperty("--mx", (e.clientX - r.left) + "px");
          card.style.setProperty("--my", (e.clientY - r.top) + "px");
        },
        { passive: true }
      );
    });
  }

  /* ======================================================================
     10. The mirror — pick a field, the answer decodes itself
     ====================================================================== */
  var SCRAMBLE_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ#%&*/<>{}[]";

  function scrambleTo(el, text) {
    if (reduced) {
      el.textContent = text;
      return;
    }

    var from = el.textContent;
    var length = Math.max(from.length, text.length);
    var queue = [];
    var i;

    for (i = 0; i < length; i++) {
      queue.push({
        from: from[i] || "",
        to: text[i] || "",
        start: Math.floor(Math.random() * 22),
        end: Math.floor(Math.random() * 22) + 22
      });
    }

    if (el._scrambleRaf) cancelAnimationFrame(el._scrambleRaf);

    var frame = 0;

    function tick() {
      var out = "";
      var done = 0;

      for (var j = 0; j < queue.length; j++) {
        var q = queue[j];
        if (frame >= q.end) {
          done++;
          out += q.to;
        } else if (frame >= q.start) {
          // Keep spaces as spaces so the shape of the sentence stays readable.
          if (q.to === " ") {
            out += " ";
          } else {
            if (!q.char || Math.random() < 0.3) {
              q.char = SCRAMBLE_CHARS[Math.floor(Math.random() * SCRAMBLE_CHARS.length)];
            }
            out += q.char;
          }
        } else {
          out += q.from;
        }
      }

      el.textContent = out;

      if (done === queue.length) return;
      frame++;
      el._scrambleRaf = raf(tick);
    }

    tick();
  }

  function initMirror() {
    var chips = $$("[data-field]");
    var answer = $("[data-answer]");
    if (!chips.length || !answer) return;

    function choose(chip) {
      chips.forEach(function (c) {
        c.setAttribute("aria-pressed", String(c === chip));
      });
      scrambleTo(answer, chip.getAttribute("data-field"));
    }

    chips.forEach(function (chip) {
      chip.addEventListener("click", function () {
        choose(chip);
      });
    });
  }

  /* ======================================================================
     11. Scrollspy
     ====================================================================== */
  function initSpy() {
    var links = $$("[data-nav] a[href^='#']");
    if (!links.length || !("IntersectionObserver" in window)) return;

    var sections = links
      .map(function (l) {
        return document.querySelector(l.getAttribute("href"));
      })
      .filter(Boolean);

    var spy = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          links.forEach(function (l) {
            l.classList.toggle("is-active", l.getAttribute("href") === "#" + entry.target.id);
          });
        });
      },
      { rootMargin: "-45% 0px -50% 0px" }
    );

    sections.forEach(function (s) {
      spy.observe(s);
    });
  }

  /* ======================================================================
     Boot
     ====================================================================== */
  function boot() {
    initReveals();
    initHeader();
    initProgress();
    initMenu();
    initMath();
    initSteps();
    initSpotlight();
    initMirror();
    initSpy();

    var canvas = $("[data-neural]");
    if (canvas && !reduced) neuralField(canvas);

    $$("[data-year]").forEach(function (el) {
      el.textContent = String(new Date().getFullYear());
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
