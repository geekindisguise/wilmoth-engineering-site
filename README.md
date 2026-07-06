# wilmoth.engineering

Static portfolio site for Jacob Wilmoth — electrical engineer and visual
storyteller. Plain HTML/CSS/JS, no build step, no framework. Serve the
folder as-is behind Caddy (or any static file server).

## Structure

```
index.html        Home page: hero, about, work, contact
privacy.html       Doodle A Day privacy policy (verbatim legal text — do not reword)
terms.html         Doodle A Day terms of service (verbatim legal text — do not reword)
css/style.css      All styles (design tokens live at the top as CSS custom properties)
js/circuit.js      Hero canvas — the interactive "live circuit board" (signature element)
js/main.js         Project data + rendering, scroll reveals, mobile nav, card tilt
assets/            Drop real photos/screenshots here as projects get real media
```

Everything is self-contained static files. Open `index.html` directly in a
browser, or drop the whole folder on any static host / Caddy `file_server`.
The only external network dependency is the Google Fonts stylesheet link
(Space Grotesk, JetBrains Mono, Inter) in the `<head>` of each page — swap
that for self-hosted font files if the deploy target has no internet egress.

## Design direction

Dark, PCB-inspired base with two accent colors that carry meaning rather
than being decorative:

- **Cyan (`--cyan`, `#46E4D3`)** — the engineering register: circuits, specs,
  consulting.
- **Amber (`--amber`, `#FF9A4D`)** — the creative register: photography,
  cinematography, the shipped app.

The hero is a live canvas circuit board (`js/circuit.js`): current drifts
along traces on its own, the cursor pulls nearby current toward it, and
clicking a node fires a bright cascade down connected traces ("energizing
the board"). It's the one deliberately showy element on the page — every­
thing else (reveal-on-scroll, card tilt, nav) is quieter by design.

The About section is styled as a component datasheet (spec-sheet table) —
a small, on-brand joke about describing a person the way you'd describe a
part.

All motion respects `prefers-reduced-motion`: the canvas doesn't mount at
all (a static gradient grid takes its place), scroll reveals show content
immediately, and the blinking cursor / card tilt are disabled.

## Adding a new project

Open `js/main.js` and add an object to the `PROJECTS` array at the top of
the file. Each object needs:

```js
{
  id: 'unique-slug',
  title: 'Project Name',
  category: 'Short label shown above the title',
  accent: 'cyan' | 'amber',
  gradient: 'CSS background, e.g. linear-gradient(...)',
  glyph: 'short mono tag shown on the card image, e.g. "iOS · SwiftUI"',
  description: 'One or two sentences.',
  tags: ['Tech', 'Skills', 'Here'],
  links: [
    { label: 'Link text', href: 'https://...', external: true }, // external adds target=_blank
    { label: 'Another link', href: '#contact' }
  ]
}
```

To use a real photo instead of a gradient placeholder, add an `image:
'assets/your-file.jpg'` field — it renders behind the gradient as a cover
image. No other file needs to change; the grid renders straight from this
array, in order.

## Legal pages

`privacy.html` and `terms.html` reproduce the Doodle A Day privacy policy
and terms of service **verbatim** — the App Store listing links directly
to these URLs, so the paths (`/privacy.html`, `/terms.html`) and the
wording must not change. Restyle the surrounding header/footer chrome
freely; leave the legal copy itself untouched.
