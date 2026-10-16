# Design overhaul — wilmoth.engineering

Branch `design/claude-opus-overhaul-2026-10-15`, from `8f9de4d`. Not pushed,
merged or deployed.

## Preview

```
http://localhost:8789/
http://100.86.236.109:8789/     (Tailscale, from your phone)
http://192.168.2.117:8789/      (LAN)
```

The brief asked for port **8788**, but something else is already listening
there (it serves a page titled "Bot Command Center"). I left it alone and used
**8789**, still bound to `0.0.0.0`. To run the preview again yourself:
`node tools/serve.mjs 8789`. It resolves paths exactly like the Caddyfile
(`try_files {path} {path}.html {path}/index.html`), so legacy URLs behave
locally the way they do in production.

## Revision 1 (your five fixes)

All five are done and committed on this branch. Nothing was pushed or deployed.

1. **Contactors, plural.** The drawing now has both main contactors: **K1
   on HV+** (with the precharge resistor R3 across it) and **K2 on HV−**, on
   separate positive and negative runs from the pack to the controller.
   They follow the usual sequence:
   - **Step 3 (Precharge):** K2 closes first, then R3 brings the DC link up.
   - **Step 4 ("Contactors closed"):** K1 closes, so both sides are connected.

   This works the same in the SVG and the 3D views. The readout cell is now
   "Contactors", reading Open, then K2 closed · precharging, then K1 + K2
   closed. The parts key lists K1 and K2 separately.
2. **Rosie and Wall-E.**
   - **Rosie** (1978 Beetle) is described as the test bed for the J1772
     charge controller. The J1772 controller row and hero step 6 both say it
     is tested on Rosie.
   - **Wall-E** (1996 Outback) is the test bed for the new custom dashboard
     and telematics.
   - **Everywhere:** Rosie no longer mentions dashboards or telematics
     anywhere, including the About copy and the unused `js/main.js`, which
     still ships.
3. **Only CANnery and Doodle A Day are public.** Lodebook, Snap & Wind and
   Keepsake are now `draft: true` in `content/apps.mjs`. Draft apps get no
   `/apps/<slug>/` pages, no home or `/apps/` listing, no footer link, no
   sitemap entry, and no mention on the Off the bench notes. I grepped every
   file that ships; see "Drafts" below for the one deliberate exception and
   why.
4. **Apps layout.** The card grid is now two **detail views on a drawing
   sheet**. Each app has:
   - a lettered detail balloon (A, B) with a leader to a dashed detail circle
     with centre lines;
   - its icon at large size inside the circle, captioned "Detail A · Mac &
     iPad";
   - numbered drawing notes for what it does;
   - a document schedule listing each document's address;
   - the App Store link, where one exists.

   CANnery cross-references "Drawn as U6 on the system drawing", which is
   true: it is U6 in the hero. With two apps, the two details split the sheet
   down the middle. A third app would span a full row, so the layout never
   leaves a hole. It uses the same component on the home page and `/apps/`.
5. **Hero first line** is now "Jacob Wilmoth, electrical engineer". It
   fits on one line at 320, 390 and 1440 px (measured). `<title>` is "Jacob
   Wilmoth, electrical engineer | Wilmoth Engineering".

### Drafts: what is and isn't reachable

| URL | Now |
|---|---|
| `/apps/lodebook/…`, `/apps/snap-and-wind/…`, `/apps/keepsake/` | not generated, not shipped (404) |
| home, `/apps/`, footer, sitemap, Off the bench | only CANnery and Doodle A Day |
| `/lodebook/privacy`, `/lodebook/support`, `/snap-and-wind/privacy`, `/terms`, `/support` (+ `.html`, `/`), `/snap-and-wind/review-demo.mp4` | **still 200**, unlisted: nothing links to them, `noindex`, not in the sitemap, and their rail links only to each other |
| `/drafts/apps/<slug>/` | full draft preview, **local only** (`drafts/` is never copied into the image) |

**Why the old Lodebook and Snap & Wind URLs still work:**
- The original brief marks every existing privacy, terms and support URL as
  linked from App Store Connect, and says to keep them all working.
- Snap & Wind has an App Review demo on the site.
- Before this redesign, those pages were already live at those addresses and
  unlinked. They now have exactly that unlisted status again.

Removing them could break App Review or a submitted listing. If you'd rather
they 404 too, delete the `legacy` entries for those docs in
`content/apps.mjs`, rebuild, and remove the Dockerfile's
`COPY lodebook` / `COPY snap-and-wind` lines.

**One cleanup only you can do:**
- The old generated `apps/lodebook/` and `apps/snap-and-wind/` folders are
  still in the tree. I'm not allowed to delete files, and `git mv` was
  blocked in this session.
- They are stale and harmless: `tools/build.mjs` writes a block into
  `.dockerignore` that excludes every draft's `apps/<slug>` folder (and
  `drafts/`) from the image, and the local preview server returns 404 for
  them too.
- The build prints a reminder until you run
  `git rm -r apps/lodebook apps/snap-and-wind`.

## The idea

You said the circuits didn't make sense and the site looked like AI slop. So
the circuit is now a **real system you'd find in one of your cars**, and the
site around it is a **drawing sheet** instead of a dark tech template.

- **The hero is a single-line diagram of a typical EV conversion.** J1772
  inlet → on-board charger → pack (4 modules) + BMS → main contactors on
  HV+ (K1, with a precharge resistor across it) and HV− (K2) → motor
  controller → three-phase motor, plus a DC-DC
  converter, 12 V battery, and a CAN trunk terminated with 120 Ω at each end.
  CANnery and the dash tap the bus. Every part has a reference designator
  (J1, U3, BT1, K1, K2, R3, U2, M1…).
- **Scrolling walks through the actual startup sequence:** 12 V wake → BMS
  checks the pack → K2 closes and precharge → K1 closes (contactors closed) →
  drive → plug in (J1772 pilot) → read every frame in CANnery. Each step
  changes what's live. The DC link ramps during precharge, each contactor's
  plunger drops as it closes, the
  rotor turns only while driving, and the pack fills while charging.
- **CAN behaves like CAN.** A frame goes down the sender's stub, then both ways
  along the trunk to every node. Receivers blink. An instrument strip shows
  12 V / contactors / DC link / motor / J1772 / bus frames per second, next to a live
  bus trace. The trace is labelled "illustrative" because the message names
  are generic, not your DBC.
- **Colour means what it means on a wiring diagram:** orange is high voltage
  (as HV cable is in every EV, and it matches the CANnery can), blue is
  CAN/signal, ink is 12 V and linework. Nothing is coloured for decoration.
- **Light drafting paper by default, dark follows the OS.** Archivo (using its
  width axis) and IBM Plex Mono replace Space Grotesk / Inter / JetBrains
  Mono. No Departure Mono. The name is "Wilmoth Engineering" everywhere.
- **Drafting conventions instead of AI tells:** Work is a parts list with
  drawing balloons, About is a datasheet, the footer is a title block. The
  hero is left-aligned beside the drawing, not centred. There are no gradient
  blobs, no glassmorphism, and no cyan on black.

### three.js, and what's done to keep it cheap

- One description of the system (`js/system/graph.js`) feeds **two
  renderers**. The SVG schematic is the base on every device. The three.js
  axonometric version (`js/system/scene.js`) is **lazy-loaded** after idle,
  only on screens ≥ 960 px with a fine pointer, WebGL, and no Save-Data. It
  cross-fades in once ready.
- **Phones** get the animated SVG: about **24 KB of JS**, and the home page is
  about 550 KB in total (it was 2.3 MB before I made 256 px copies of the app
  icons).
- **`prefers-reduced-motion`**: static SVG, all steps fully readable, no
  animation, no loop. A parts key replaces the bus trace.
- The render loop **stops** when the hero scrolls off screen or the tab is
  hidden.
- three.js is a **tree-shaken r186 subset** (`js/vendor/three.js`, 550 KB
  minified before gzip), self-hosted with no CDN. Rebuild it with
  `tools/vendor-three.mjs`.
- Measured in Playwright Chromium on this Mac: **60 fps, worst frame 17 ms,
  zero long tasks** on desktop with the 3D scene running, and the same on the
  mobile SVG.

### Your interests and skills on the page

Facts come only from the repo and the brief:

- **EV and vehicle electronics**: the hero system; Rosie (1978 Beetle, the
  J1772 charge-controller test bed) and Wall-E (1996 Outback, the new
  dashboard and telematics test bed); the J1772 controller; EV Engineering Lab
  (evengineeringlab.com, a link only, since the repo says nothing else about
  it); consulting.
- **Apps**: CANnery and Doodle A Day (the released ones), each with a
  landing page whose facts come from its own privacy and support copy.
  Lodebook, Snap & Wind and Keepsake are drafts and appear nowhere public.
- **Off the bench**: photography (your existing photo, linking to
  jacobwilmoth.com), mountain biking in the Colorado mountains, prospecting
  and geology, and a Proxmox homelab with self-hosted services.

## Structure proposal (implemented)

Each app gets one home, and all of them come from one template:

```
/apps/                         apps index
/apps/<slug>/                  app landing (icon, what it does, App Store link, documents)
/apps/<slug>/privacy           ┐
/apps/<slug>/terms             ├ one shared legal layout: app rail with tabs + verbatim copy
/apps/<slug>/support           ┘
```

- `content/apps.mjs` holds the per-app data. Each app's legal and support copy
  lives **verbatim** in `content/apps/<slug>/<doc>.html`, moved byte for byte
  from the old `<main>` bodies. Only relative hrefs were made root-absolute.
- `node tools/build.mjs` generates the pages above, the legacy URLs, the apps
  shelf, the shared header and footer in `index.html`, and `sitemap.xml`.
  The output is committed, so the deployed site still has no build step.
  `--check` exits 1 if anything is stale.
- `node tools/check-legal.mjs` compares the text and link targets of every
  legal page, at both its old and new URL, against `8f9de4d`. **All 32 checks
  pass.** I confirmed it fails on a one-word edit.
- **Adding app #6** is one data entry, its doc fragments, and a rebuild. It
  needs no Dockerfile or Caddyfile change. The README has the steps.

## Old → new URL map

Every old URL still returns **200** with the same content, plus a
`<link rel="canonical">` pointing at the new address. They are full pages, not
redirects, so App Store links, in-app links and App Review all keep working
even if the Caddy config changes later. All 46 old and new URLs were fetched
and returned 200.

| Old URL (still live, 200) | New canonical URL |
|---|---|
| `/privacy.html` | `/apps/doodle-a-day/privacy` |
| `/terms.html` | `/apps/doodle-a-day/terms` |
| `/cannery/privacy` · `/cannery/privacy.html` · `/cannery/privacy/` | `/apps/cannery/privacy` |
| `/cannery/support` · `/cannery/support.html` · `/cannery/support/` | `/apps/cannery/support` |
| `/lodebook/privacy` · `.html` · `/` | none: draft (unlisted, `noindex`) |
| `/lodebook/support` · `.html` · `/` | none: draft (unlisted, `noindex`) |
| `/snap-and-wind/privacy` · `.html` · `/` | none: draft (unlisted, `noindex`) |
| `/snap-and-wind/terms` · `.html` · `/` | none: draft (unlisted, `noindex`) |
| `/snap-and-wind/support` · `.html` · `/` | none: draft (unlisted, `noindex`) |
| `/snap-and-wind/review-demo.mp4` | unchanged (still `X-Robots-Tag: noindex`) |
| `/app-ads.txt` | unchanged |
| — | `/apps/`, `/apps/cannery/`, `/apps/doodle-a-day/` (new), `/sitemap.xml` (new) |

After revision 1 the URL check covers 49 URLs: every old and new URL above
returns 200, and the eight `/apps/` URLs for the draft apps return 404.

You don't have to change anything in App Store Connect. When you next touch a
listing, you can switch it to the `/apps/...` URL.

## What changed

| Area | Change |
|---|---|
| Home | New hero (system drawing + 7 steps), parts-list Work, apps as detail views, Off the bench, datasheet About, contact, title-block footer |
| Legal/support pages | Shared layout: app rail with Overview / Privacy / Terms / Support tabs and the page address; same verbatim copy. Draft apps' legacy pages: same layout without an Overview, `noindex` |
| App pages | New `/apps/` index and landing pages for CANnery and Doodle A Day; local-only draft previews for Lodebook and Snap & Wind under `/drafts/apps/` |
| Navigation | Same header on every page: System, Work, Apps, Off the bench, Contact. On phones it becomes a second scrolling row, so it needs no hamburger and no script |
| Footer | App directory with each app's privacy/terms/support links (the old footer pointed "Privacy/Terms" at Doodle from every page) |
| Copy | Hero, section intros and the About datasheet rewritten in plain language. Removed "Operating temp: comfortable under deadline pressure"; dropped the "Project log" links that went to #contact and the generic `apps.apple.com` link for Doodle |
| Deploy | Dockerfile also copies `apps/` and `sitemap.xml`. `.dockerignore` gains a generated block excluding `drafts/` and each draft's `apps/<slug>`. Caddyfile unchanged |
| Docs | README rewritten for the new layout and workflow |

### Yesterday's five fixes (`design/claude-opus-pass-2026-10-14`)

Re-applied by hand where they still apply. Most are now built into the new
layout rather than patched on.

1. **Legal pages' mobile gutter**: the new `.doc` layout uses the standard
   `.wrap` gutter, so the 390 px shots have 16 px side margins.
2. **Subpage nav on mobile**: fixed for every page. The header no longer
   collapses into a JS hamburger anywhere, and on phones the nav is a
   scrolling second row. No `:has()` needed.
3. **Hero alignment**: the hero copy sits in the page column, left-aligned
   with the masthead brand.
4. **Card label legibility**: no text sits on photos any more. The photo has a
   caption beneath it, and app icons are plain images.
5. **"01 — About" label**: there are no numbered eyebrows now. All section
   labels share one `.kicker` style.

## Screenshots

- `design-pass/before/`: the original site, 10 pages × desktop 1440 and
  mobile 390, viewport + full page.
- `design-pass/after/`: the same filenames, plus `apps-index`, `app-*`.
  Re-shot after revision 1. `app-lodebook-*` and `app-snapwind-*` now show
  the local draft previews, with the "Draft · not published" flag.
- `design-pass/after/hero-steps/`: every scroll step on desktop (three.js) and
  mobile (SVG), plus `*-dark`.
- `design-pass/after/reduced-motion/`: the static schematic.

All captures used Playwright with the cached Chromium. `screencapture` was not
used.

## Rough spots and things for you to decide

- **`js/circuit.js` and `js/main.js` are no longer used**, but the brief rules
  out `rm`, so they're still in the tree and the Dockerfile still ships `js/`.
  Run `git rm js/circuit.js js/main.js` when you're happy.
- **Legacy URLs are duplicated files**, generated, so there's no drift. If
  you'd rather have 301s, add `redir` lines to the Caddyfile and drop the
  `legacy` entries in `content/apps.mjs`. I chose 200 pages because they can't
  break an App Store link.
- **Not tested on a real phone or in Safari.** Everything was verified in
  headless Chromium only. Worth a look on your iPhone over Tailscale. The CSS
  uses `color-mix()` (Safari 16.2+) and the individual `translate` property.
- **Missing facts I didn't invent:** Doodle A Day's App Store URL (its
  detail and landing page have no store button), and what EV Engineering Lab
  is (it has a one-line row and a link). Add an `appStore` URL to Doodle's
  entry in `content/apps.mjs`, and edit `index.html` for EV Engineering Lab.
- **The photo**: a mountain-bike shot from your portfolio. I didn't caption
  the rider or location because the repo doesn't say who or where.
- **The 3D part names are hover-only**, with a native tooltip in the SVG. The
  drawing is `aria-hidden` and the step text carries the same information, but
  keyboard users can't explore individual parts.
- **The mobile drawing band** stays pinned at about 38% of the screen while
  you read the steps. That's deliberate, so you can watch it change, but the
  steps section is long on a phone (7 steps).
- **Verbatim duplicate**: every legal page body still ends with
  "© 2026 Wilmoth.Engineering. All rights reserved. Links: Home | Doodle
  privacy". It's part of the copy, so it stays unless you say otherwise.
- **Fonts** still load from Google Fonts, as before.

## Commits

```
before screenshots + tools/serve.mjs
Apps structure: /apps/<slug>/ pages generated from one template
Hero: a live single-line diagram of an EV conversion
Redesign: drawing-sheet visual system and new home page
Apps: keep original doc titles, 256px icons, wrap URLs at slashes
Hero: no cropping push-ins, parts key, readout; README for new layout
Hero: drop camera push-ins; wider parts key under reduced motion
after screenshots
REPORT.md
— revision 1 —
Hero: drop brand from first line so Jacob's name fits on one line
Hero: positive and negative main contactors (K1, K2); Rosie/Wall-E copy
Apps: only released apps are public (drafts unlisted); detail-view layout; REPORT
```

`CLAUDE-DESIGN-PASS.md` is left untracked, as I found it. There is no
CLAUDE.md or AGENTS.md in this repo or the main checkout; the README and
yesterday's report were the design docs.
