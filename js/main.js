/*
 * main.js — site behavior: project data + rendering, scroll reveals,
 * mobile nav, and magnetic card tilt.
 *
 * TO ADD A NEW PROJECT: add an object to the PROJECTS array below.
 * Nothing else needs to change — the grid renders straight from this data.
 * Fields:
 *   id          unique slug, used for anchors/analytics (string)
 *   title       project name (string)
 *   category    short label shown above the title, e.g. "iOS App" (string)
 *   accent      "cyan" or "amber" — which brand accent the card uses
 *   gradient    CSS background (string) — swap for a real photo:
 *               set `image: "assets/your-photo.jpg"` instead and it
 *               will be used as a cover image behind the glyph.
 *   glyph       short mono tag shown on the card media, e.g. "iOS · SwiftUI"
 *   description short 1-2 sentence summary (string)
 *   tags        array of short strings (tech/skills)
 *   links       array of {label, href} — external links, App Store, etc.
 */
var PROJECTS = [
  {
    id: 'doodle-a-day',
    title: 'Doodle a Day',
    category: 'iOS App · Shipped',
    accent: 'amber',
    gradient: 'linear-gradient(135deg, #2A1B12, #402615 60%, #FF9A4D22)',
    glyph: 'SwiftUI · App Store',
    description: 'A daily doodling and mood journal for iPhone. One prompt a day, one quick sketch, a running visual diary of how you’ve been feeling.',
    tags: ['SwiftUI', 'iOS', 'StoreKit'],
    links: [
      { label: 'App Store', href: 'https://apps.apple.com/', external: true },
      { label: 'Privacy', href: 'privacy.html' },
      { label: 'Terms', href: 'terms.html' }
    ]
  },
  {
    id: 'cannery',
    title: 'CANnery',
    category: 'Mac & iPad App · Shipped',
    accent: 'cyan',
    gradient: 'linear-gradient(135deg, #0E2228, #163840 60%, #46E4D322)',
    glyph: 'SwiftUI · App Store',
    description: 'A native CAN bus analyzer for Mac and iPad. Import ASC, BLF or CSV logs, load DBC files, and read every decoded signal as a chart or a raw trace.',
    tags: ['CAN Bus', 'DBC', 'J1939'],
    links: [
      { label: 'App Store', href: 'https://apps.apple.com/us/app/cannery/id6807928738', external: true },
      { label: 'Privacy', href: '/cannery/privacy' },
      { label: 'Support', href: '/cannery/support' }
    ]
  },
  {
    id: 'ev-conversions',
    title: 'EV Conversions — Rosie & Wall-E',
    category: 'EV Engineering',
    accent: 'cyan',
    gradient: 'linear-gradient(135deg, #10232A, #133339 60%, #46E4D322)',
    glyph: '1978 Beetle · 1996 Outback',
    description: 'Two daily-driven EV conversions: Rosie, a 1978 VW Beetle, and Wall-E, a 1996 Subaru Outback. Custom dashboards and telematics turn each one into a rolling data platform, not just a swap.',
    tags: ['Battery Systems', 'CAN Bus', 'Dashboards'],
    links: [
      { label: 'Project log', href: '#contact' }
    ]
  },
  {
    id: 'j1772-controller',
    title: 'J1772 Controller',
    category: 'Embedded Hardware',
    accent: 'cyan',
    gradient: 'linear-gradient(135deg, #0F1D24, #12333A 60%, #46E4D31A)',
    glyph: 'Firmware · PCB',
    description: 'A ground-up EV charging controller built to the J1772 standard — pilot signaling, relay control, and safety interlocks on custom hardware. Prototype proven, telematics features in progress.',
    tags: ['Embedded C', 'Power Electronics', 'CAD'],
    links: [
      { label: 'Project log', href: '#contact' }
    ]
  },
  {
    id: 'photo-cinema',
    title: 'Photography & Cinematography',
    category: 'Creative',
    accent: 'amber',
    gradient: 'linear-gradient(135deg, #241812, #3A2414 60%, #FF9A4D22)',
    glyph: 'Stills · Motion',
    description: 'Visual work outside the lab — landscape and portrait photography, with a growing body of cinematic short-form video. The gallery is live.',
    tags: ['Photography', 'Color', 'Cinematography'],
    links: [
      { label: 'View the photography', href: 'https://jacobwilmoth.com', external: true }
    ]
  },
  {
    id: 'consulting',
    title: 'Engineering Consulting',
    category: 'Wilmoth Engineering, LLC',
    accent: 'cyan',
    gradient: 'linear-gradient(135deg, #141922, #1B2733 60%, #46E4D31A)',
    glyph: 'Remote · Project or Retainer',
    description: 'EV conversion planning, off-grid and solar electrical systems, circuit design, and iOS or embedded development — brought in as a specialist or a full build partner.',
    tags: ['EV Systems', 'Solar / Off-grid', 'Circuit Design', 'iOS & Embedded'],
    links: [
      { label: 'Get in touch', href: '#contact' }
    ]
  }
];

document.addEventListener('DOMContentLoaded', function () {
  renderProjects();
  setupNav();
  setupReveals();
  setupCardTilt();
});

function renderProjects() {
  var grid = document.getElementById('projectGrid');
  if (!grid) return;

  PROJECTS.forEach(function (p) {
    var card = document.createElement('div');
    card.className = 'card reveal';
    card.style.setProperty('--card-accent', p.accent === 'amber' ? 'var(--amber)' : 'var(--cyan)');
    card.style.setProperty('--card-gradient', p.gradient);

    var media = document.createElement('div');
    media.className = 'card-media';
    media.style.background = p.gradient;
    if (p.image) {
      media.style.backgroundImage = 'url(' + p.image + '), ' + p.gradient;
      media.style.backgroundSize = 'cover';
      media.style.backgroundPosition = 'center';
    }
    var glyph = document.createElement('span');
    glyph.className = 'card-glyph mono';
    glyph.textContent = p.glyph || '';
    media.appendChild(glyph);

    var body = document.createElement('div');
    body.className = 'card-body';

    var cat = document.createElement('p');
    cat.className = 'card-cat mono';
    cat.textContent = p.category;

    var title = document.createElement('h3');
    title.className = 'card-title';
    title.textContent = p.title;

    var desc = document.createElement('p');
    desc.className = 'card-desc';
    desc.textContent = p.description;

    var tags = document.createElement('div');
    tags.className = 'card-tags';
    (p.tags || []).forEach(function (t) {
      var span = document.createElement('span');
      span.textContent = t;
      tags.appendChild(span);
    });

    body.appendChild(cat);
    body.appendChild(title);
    body.appendChild(desc);
    body.appendChild(tags);

    if (p.links && p.links.length) {
      var linksEl = document.createElement('div');
      linksEl.className = 'card-links';
      p.links.forEach(function (l) {
        var a = document.createElement('a');
        a.href = l.href;
        a.textContent = l.label;
        if (l.external) {
          a.target = '_blank';
          a.rel = 'noopener noreferrer';
        }
        linksEl.appendChild(a);
      });
      body.appendChild(linksEl);
    }

    card.appendChild(media);
    card.appendChild(body);
    grid.appendChild(card);
  });
}

function setupNav() {
  var toggle = document.getElementById('navToggle');
  var list = document.getElementById('navList');
  if (!toggle || !list) return;
  toggle.addEventListener('click', function () {
    var open = list.classList.toggle('is-open');
    toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
  });
  list.querySelectorAll('a').forEach(function (a) {
    a.addEventListener('click', function () {
      list.classList.remove('is-open');
      toggle.setAttribute('aria-expanded', 'false');
    });
  });
}

function setupReveals() {
  var items = document.querySelectorAll('.reveal');
  if (!items.length) return;

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduceMotion || !('IntersectionObserver' in window)) {
    items.forEach(function (el) { el.classList.add('is-visible'); });
    return;
  }

  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry, i) {
      if (entry.isIntersecting) {
        var el = entry.target;
        var delay = (i % 4) * 60;
        setTimeout(function () { el.classList.add('is-visible'); }, delay);
        io.unobserve(el);
      }
    });
  }, { threshold: 0.15, rootMargin: '0px 0px -40px 0px' });

  items.forEach(function (el) { io.observe(el); });
}

function setupCardTilt() {
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduceMotion) return;
  if (window.matchMedia('(pointer: coarse)').matches) return; // skip on touch

  var grid = document.getElementById('projectGrid');
  if (!grid) return;

  grid.addEventListener('mousemove', function (e) {
    var card = e.target.closest('.card');
    if (!card) return;
    var rect = card.getBoundingClientRect();
    var relX = (e.clientX - rect.left) / rect.width - 0.5;
    var relY = (e.clientY - rect.top) / rect.height - 0.5;
    card.style.setProperty('--tilt-y', (relX * 8).toFixed(2) + 'deg');
    card.style.setProperty('--tilt-x', (relY * -8).toFixed(2) + 'deg');
  });

  grid.addEventListener('mouseleave', function () {
    grid.querySelectorAll('.card').forEach(function (card) {
      card.style.setProperty('--tilt-x', '0deg');
      card.style.setProperty('--tilt-y', '0deg');
    });
  }, true);
}
