// Per-app data. tools/build.mjs turns this into:
//   /apps/                       apps index
//   /apps/<slug>/                app landing page
//   /apps/<slug>/<doc>/          privacy / terms / support (one shared legal layout)
//   every URL in `legacy`        same page, kept alive for App Store links
// plus the apps shelf on the home page, the footer directory and sitemap.xml.
//
// Legal and support copy lives in content/apps/<slug>/<doc>.html and is
// reproduced verbatim. Do not reword it here or there.
//
// TO ADD AN APP: add an entry below, drop its doc fragments in
// content/apps/<slug>/, run `node tools/build.mjs`, commit the output.
// The doc's canonical URL is /apps/<slug>/<doc>; point App Store Connect there.

// Default document names; an app's doc can override with `title`.
export const DOC_TITLES = {
  privacy: 'Privacy Policy',
  terms: 'Terms',
  support: 'Support',
};

export const APPS = [
  {
    slug: 'cannery',
    name: 'CANnery',
    platforms: 'Mac & iPad',
    kind: 'CAN bus analyzer',
    icon: '/assets/cannery-icon-256.png', // 256px copy of CANnery_Icon_Dock_Light.png
    accent: 'hv',
    summary: 'A native CAN bus analyzer for Mac and iPad. Import ASC, BLF or CSV logs, load DBC files, and read every decoded signal as a chart or a raw trace.',
    // Lines sourced from the CANnery privacy and support pages.
    facts: [
      'Opens logs and traces, loads a DBC, decodes and charts signals.',
      'Demo Bus runs locally so you can learn the layout on the device.',
      'Plus adds live adapters, transmit, J1939, UDS, and export.',
      'No account. Logs, DBC files and bus traffic stay on your device.',
    ],
    appStore: 'https://apps.apple.com/us/app/cannery/id6807928738',
    docs: {
      privacy: { legacy: ['/cannery/privacy.html', '/cannery/privacy/index.html'] },
      support: { legacy: ['/cannery/support.html', '/cannery/support/index.html'] },
    },
  },
  {
    slug: 'lodebook',
    name: 'Lodebook',
    platforms: 'iPhone, iPad & Mac',
    kind: 'Field notebook for mining claims',
    monogram: 'Lb',
    accent: 'ore',
    summary: 'A field notebook for spots, finds, notes, and mining claims on iPhone, iPad, and Mac.',
    // Lines sourced from the Lodebook privacy and support pages.
    facts: [
      'Spots, finds, field notes, and Lode, Placer, Mill site or Tunnel site claims.',
      'Satellite, USGS topographic, lidar relief and public-land layers.',
      'Offline field kits for a spot or a claim.',
      'Stake Day: a field aide for corners, monuments, and a GPS walk-in.',
    ],
    docs: {
      privacy: { legacy: ['/lodebook/privacy.html', '/lodebook/privacy/index.html'] },
      support: { legacy: ['/lodebook/support.html', '/lodebook/support/index.html'] },
    },
  },
  {
    slug: 'snap-and-wind',
    name: 'Snap & Wind',
    platforms: 'iPhone',
    kind: 'Disposable-film camera',
    monogram: 'S&W',
    accent: 'film',
    summary: 'A disposable-film camera for iPhone. You take photos the way you would with a disposable film camera.',
    // Lines sourced from the Snap & Wind privacy, terms and support pages.
    facts: [
      'No account, no sign-in, no ads, no tracking.',
      'Photos stay on your device; iCloud backup is optional.',
      'One optional in-app purchase: “Quicker develop”.',
    ],
    docs: {
      privacy: { legacy: ['/snap-and-wind/privacy.html', '/snap-and-wind/privacy/index.html'] },
      terms: { title: 'Terms of Use', legacy: ['/snap-and-wind/terms.html', '/snap-and-wind/terms/index.html'] },
      support: { legacy: ['/snap-and-wind/support.html', '/snap-and-wind/support/index.html'] },
    },
  },
  {
    slug: 'doodle-a-day',
    name: 'Doodle A Day',
    platforms: 'iPhone',
    kind: 'Doodle & mood journal',
    icon: '/assets/doodle-a-day-icon-256.png', // 256px copy of DoodleADay-AppIcon-1024.png
    accent: 'pencil',
    summary: 'A daily doodling and mood journal for iPhone. One prompt a day, one quick sketch, a running visual diary of how you’ve been feeling.',
    // Lines sourced from the Doodle A Day privacy policy and terms.
    facts: [
      'Doodles, moods and notes are stored locally on your device.',
      'Doodle A Day Pro: sketchbook exports, custom mood colors, font customization.',
      'Rated 4+. No account needed.',
    ],
    docs: {
      // The original App Store URLs for Doodle are at the site root.
      privacy: { legacy: ['/privacy.html'] },
      terms: { title: 'Terms of Service', legacy: ['/terms.html'] },
    },
  },
  {
    slug: 'keepsake',
    name: 'Keepsake',
    platforms: '',
    kind: '',
    monogram: 'K',
    accent: 'ink',
    // No published page yet: listed on the shelf, no landing or docs generated.
    unpublished: true,
    summary: '',
    facts: [],
    docs: {},
  },
];
