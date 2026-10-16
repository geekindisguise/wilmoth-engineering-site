# wilmoth.engineering

Static site for Wilmoth Engineering, LLC (Jacob Wilmoth). Plain HTML, CSS
and JavaScript modules. The deployed site has no build step; a small Node
script (no dependencies) generates the app pages, and its output is committed.

## Structure

```
index.html              Home: system hero, work, apps (detail views), off the bench, about, contact
css/style.css           All styles; design tokens at the top (light + dark)
js/system/              The hero drawing
  graph.js              The EV system: parts, nets, scroll states (single source)
  bus.js                CAN traffic: frames broadcast from each sender
  svg.js                2D schematic renderer (phones, reduced motion, no WebGL)
  scene.js              three.js renderer (desktop only, lazy-loaded)
  index.js              Picks a renderer, maps scroll steps to states
js/vendor/three.js      Minified three.js subset (tools/vendor-three.mjs)
content/apps.mjs        Per-app data: name, platforms, facts, docs, legacy URLs
content/apps/<slug>/    Verbatim legal/support copy: privacy.html, terms.html, support.html
apps/                   GENERATED: /apps/, /apps/<slug>/, /apps/<slug>/<doc>/ (released apps only)
drafts/apps/<slug>/     GENERATED: local-only preview of draft apps. Never deployed.
privacy.html, terms.html, cannery/, lodebook/, snap-and-wind/
                        GENERATED legacy URLs (App Store links). Do not hand-edit.
.dockerignore           Has a GENERATED block keeping drafts out of the image
tools/build.mjs         Generates the above + header/apps/footer inside index.html
tools/check-legal.mjs   Fails if any legal text or link target drifted
tools/serve.mjs         Local preview that resolves paths exactly like the Caddyfile
```

## Everyday commands

```sh
node tools/build.mjs          # regenerate app pages after editing content/
node tools/build.mjs --check  # CI-style: exit 1 if generated files are stale
node tools/check-legal.mjs    # legal copy still matches the pre-overhaul pages
node tools/serve.mjs 8789     # preview on http://0.0.0.0:8789/
```

## Adding an app

1. Add an entry to `APPS` in `content/apps.mjs` (slug, name, platforms, kind,
   icon or monogram, summary, facts, docs).
2. Put its documents in `content/apps/<slug>/privacy.html` (and `terms.html`,
   `support.html` as needed). These are the `<main>` body only.
3. `node tools/build.mjs`, then commit the generated `apps/<slug>/` files.
4. In App Store Connect use `https://wilmoth.engineering/apps/<slug>/privacy`
   (and `/terms`, `/support`).

New apps need no legacy URLs and no Dockerfile change: everything lives under
`apps/`, which the Dockerfile already copies.

### Drafts (unreleased apps)

Only released apps appear on the public site. Today that's **CANnery** and
**Doodle A Day**. An entry with `draft: true` (Lodebook, Snap & Wind,
Keepsake) gets no `/apps/<slug>/` pages, no listing on the home page or
`/apps/`, no footer link and no sitemap entry. If it already has `legacy`
URLs that App Store Connect or App Review uses, those keep serving the
verbatim copy, **unlisted** (nothing links to them) and `noindex`, as they did
before the redesign. A full preview of the draft's pages is written to
`drafts/apps/<slug>/` (open `http://localhost:8789/drafts/apps/<slug>/`).
`tools/build.mjs` keeps a generated block in `.dockerignore` so neither
`drafts/` nor any draft's `apps/<slug>/` can ship.

To release a draft: delete `draft: true`, run `node tools/build.mjs`, commit.

## Legal pages

Legal and support copy is reproduced **verbatim** from each app. Do not
reword it. It lives in `content/apps/<slug>/*.html`; the layout around it
(header, document rail, footer) is shared and can change freely.

Every URL that App Store listings or the apps already link to still returns
the page with a 200, with a `<link rel="canonical">` pointing at the new
`/apps/...` address:

| Old URL (still live) | Canonical |
|---|---|
| `/privacy.html` | `/apps/doodle-a-day/privacy` |
| `/terms.html` | `/apps/doodle-a-day/terms` |
| `/cannery/privacy`, `/cannery/privacy.html`, `/cannery/privacy/` | `/apps/cannery/privacy` |
| `/cannery/support` (+ `.html`, `/`) | `/apps/cannery/support` |
| `/lodebook/privacy`, `/lodebook/support` (+ `.html`, `/`) | none: draft, unlisted + `noindex` |
| `/snap-and-wind/privacy`, `/terms`, `/support` (+ `.html`, `/`) | none: draft, unlisted + `noindex` |

`/snap-and-wind/review-demo.mp4` is unchanged and still served `noindex`.

## Design

A drawing sheet rather than a dark "tech" template. Light drafting paper by
default; dark follows the OS. Colour means what it means on a wiring diagram:
**orange is high voltage** (as HV cabling is in every EV), **blue is CAN /
signal**, ink is 12 V and linework. Type is Archivo (display and text, using
its width axis) and IBM Plex Mono (annotations).

The hero is a single-line diagram of a typical EV conversion, drawn from
`js/system/graph.js`. Scrolling walks through a real startup sequence
(12 V wake, BMS check, K2 (−) and precharge, K1 (+) so both contactors are
closed, drive, J1772 charge, reading the bus in CANnery). CAN frames are broadcast the way CAN works: down the
sender's stub, then both ways along a trunk terminated with 120 Ω at each end.
Message names in the bus trace are illustrative, and labelled that way.

Performance and accessibility:

- three.js loads only on wide, fine-pointer screens with WebGL, after idle,
  and without Save-Data. Phones get the SVG (about 24 KB of JS).
- `prefers-reduced-motion`: static SVG, every step readable, nothing animates.
- The render loop stops when the hero is off screen or the tab is hidden.
- The drawing is `aria-hidden`; the steps carry the same information as text.

To change which three.js classes are bundled, edit `NAMES` in
`tools/vendor-three.mjs` and rerun it (instructions at the top of the file).

## Hosting

Live on Railway (`wilmoth-engineering`), served by Caddy (see `Caddyfile`,
`Dockerfile`). Apex is `wilmoth.engineering`. `content/`, `tools/`,
`design-pass/` and `drafts/` are not copied into the image. Do not serve `luke/` (local only).
