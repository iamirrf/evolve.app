/* ==========================================================================
   Cognein — interaction
   No dependencies. Everything is an enhancement: with JS off the page stays
   readable and navigable, and with prefers-reduced-motion nothing animates.
   ========================================================================== */
(function () {
  "use strict";

  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var raf = window.requestAnimationFrame.bind(window);

  function $(sel, root) {
    return (root || document).querySelector(sel);
  }

  function $$(sel, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(sel));
  }

  /* Run fn on scroll, at most once per frame. */
  function onScroll(fn) {
    var ticking = false;
    window.addEventListener(
      "scroll",
      function () {
        if (ticking) return;
        ticking = true;
        raf(function () {
          fn();
          ticking = false;
        });
      },
      { passive: true }
    );
    fn();
  }

  /* ======================================================================
     Reveal on scroll
     ====================================================================== */
  function initReveals() {
    var targets = $$("[data-reveal]");
    if (!targets.length) return;

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
      { rootMargin: "0px 0px -8% 0px", threshold: 0.1 }
    );

    targets.forEach(function (el) {
      // Stagger siblings so grids cascade instead of popping in together.
      if (el.hasAttribute("data-stagger")) {
        var sibs = Array.prototype.slice.call(el.parentElement.children);
        var i = sibs.indexOf(el);
        if (i > 0) el.style.setProperty("--d", Math.min(i, 6) * 80 + "ms");
      }
      io.observe(el);
    });
  }

  /* ======================================================================
     Header — transparent over the billboard, solid once you scroll
     ====================================================================== */
  function initHeader() {
    var header = $("[data-header]");
    if (!header) return;
    onScroll(function () {
      header.classList.toggle("is-scrolled", window.scrollY > 20);
    });
  }

  /* ======================================================================
     Mobile menu
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
     Carousel rows — arrows page through, and disable at the ends
     ====================================================================== */
  function initRows() {
    $$("[data-row]").forEach(function (row) {
      var track = $("[data-row-track]", row);
      var prev = $("[data-row-prev]", row);
      var next = $("[data-row-next]", row);
      if (!track) return;

      function page(dir) {
        track.scrollBy({
          left: dir * track.clientWidth * 0.82,
          behavior: reduced ? "auto" : "smooth"
        });
      }

      function sync() {
        var max = track.scrollWidth - track.clientWidth;
        // 2px of slack absorbs sub-pixel rounding at the ends.
        if (prev) prev.disabled = track.scrollLeft <= 2;
        if (next) next.disabled = track.scrollLeft >= max - 2;
      }

      if (prev) {
        prev.addEventListener("click", function () {
          page(-1);
        });
      }
      if (next) {
        next.addEventListener("click", function () {
          page(1);
        });
      }

      var ticking = false;
      track.addEventListener(
        "scroll",
        function () {
          if (ticking) return;
          ticking = true;
          raf(function () {
            sync();
            ticking = false;
          });
        },
        { passive: true }
      );

      window.addEventListener("resize", sync);
      sync();
    });
  }

  /* ======================================================================
     Count-up stats
     ====================================================================== */
  function countUp(el, target) {
    var dur = 1100;
    var start = null;

    function frame(ts) {
      if (start === null) start = ts;
      var p = Math.min((ts - start) / dur, 1);
      // Ease-out cubic, so it decelerates into the final number.
      var eased = 1 - Math.pow(1 - p, 3);
      el.textContent = Math.round(target * eased).toLocaleString("en-US");
      if (p < 1) raf(frame);
    }

    raf(frame);
  }

  function initCounters() {
    var nums = $$("[data-count]");
    if (!nums.length) return;

    if (reduced || !("IntersectionObserver" in window)) {
      nums.forEach(function (el) {
        el.textContent = Number(el.getAttribute("data-count")).toLocaleString("en-US");
      });
      return;
    }

    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          countUp(entry.target, Number(entry.target.getAttribute("data-count")));
          io.unobserve(entry.target);
        });
      },
      { threshold: 0.6 }
    );

    nums.forEach(function (el) {
      el.textContent = "0";
      io.observe(el);
    });
  }

  /* ======================================================================
     Year grid — 365 days lighting up as you scroll
     ====================================================================== */
  function initYear() {
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
      var d = document.createElement("i");
      frag.appendChild(d);
      dots.push(d);
    }
    grid.appendChild(frag);

    if (reduced) {
      dots.forEach(function (d) {
        d.classList.add("is-lit");
      });
      return;
    }

    // The markup ships the final figure so it still reads correctly without
    // JS; only once we can animate do we wind it back to zero.
    if (readout) readout.textContent = "0";

    onScroll(function () {
      var rect = grid.getBoundingClientRect();
      var vh = window.innerHeight;
      // 0 when the grid's top reaches 88% of the viewport, 1 once it clears 38%.
      var p = (vh * 0.88 - rect.top) / (vh * 0.5);
      p = Math.max(0, Math.min(1, p));

      var want = Math.round(p * TOTAL);
      if (want === lit) return;

      if (want > lit) {
        for (i = lit; i < want; i++) dots[i].classList.add("is-lit");
      } else {
        for (i = want; i < lit; i++) dots[i].classList.remove("is-lit");
      }
      lit = want;
      if (readout) readout.textContent = String(Math.round(p * HOURS));
    });
  }

  /* ======================================================================
     Path nodes pop in one after another
     ====================================================================== */
  function initPath() {
    var path = $("[data-path]");
    if (!path || reduced || !("IntersectionObserver" in window)) return;

    var nodes = $$(".path__node", path);
    nodes.forEach(function (n) {
      n.style.opacity = "0";
    });

    var io = new IntersectionObserver(
      function (entries) {
        if (!entries[0].isIntersecting) return;
        nodes.forEach(function (n, i) {
          setTimeout(function () {
            n.style.transition = "opacity .45s var(--ease), scale .5s var(--bounce)";
            n.style.opacity = "1";
          }, i * 110);
        });
        io.disconnect();
      },
      { threshold: 0.25 }
    );

    io.observe(path);
  }

  /* ======================================================================
     League bars grow when the table scrolls in
     ====================================================================== */
  function initLeague() {
    var bars = $$(".league__bar i");
    if (!bars.length || reduced || !("IntersectionObserver" in window)) return;

    bars.forEach(function (b) {
      b.dataset.p = b.style.getPropertyValue("--p");
      b.style.setProperty("--p", "0%");
    });

    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          var b = entry.target;
          setTimeout(function () {
            b.style.setProperty("--p", b.dataset.p);
          }, bars.indexOf(b) * 90);
          io.unobserve(b);
        });
      },
      { threshold: 0.5 }
    );

    bars.forEach(function (b) {
      io.observe(b);
    });
  }

  /* ======================================================================
     Scrollspy
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
      { rootMargin: "-40% 0px -55% 0px" }
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
    initMenu();
    initRows();
    initCounters();
    initYear();
    initPath();
    initLeague();
    initSpy();

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
