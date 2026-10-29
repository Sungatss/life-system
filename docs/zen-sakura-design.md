# Zen Sakura theme

A complete application preset, available in the existing theme selector. It is the default for new visitors and unknown theme IDs. Existing saved choices stay intact.

## Implementation

- `frontend/src/zen-sakura.css`: scoped palette, typography, component states, responsive date header, and page treatments.
- `frontend/src/refinement.css`: shared rules for fully opaque themes, including Zen Sakura.
- `frontend/src/theme.js`: theme registration and default selection.
- `frontend/src/components/DateNavigator.jsx`: adds only a styling class; date navigation logic is unchanged.
- `frontend/public/art/zen-sakura-header.webp`: 1440 × 480, opaque WebP; approximately 36 KB. Used only in a separate decorative grid cell of the date navigator, never behind content or controls.
- `frontend/public/fonts/AdwaitaSans-Variable.woff2`: self-hosted variable sans-serif, approximately 343 KB, with Latin, Cyrillic, and Kazakh characters. SIL Open Font License is bundled in `AdwaitaSans-LICENSE.txt`.
- Existing self-hosted Liberation Serif provides display headings.
- Service worker v10 precaches both the new font and artwork. The launch palette uses warm ivory.

The required palette is preserved: background `#F7F4ED`, cards `#FFFCF7`, sidebar `#EFEAE0`, ink `#202B34`, vermilion `#C34B3F`, sage `#8C9B85`, borders `#E5DED3`. Small accent text uses `#A83F35` for readable contrast on tinted surfaces; vermilion remains the accent color for marks, checks, and selection borders. Primary buttons use ink on cream, keeping vermilion sparse.

## Coverage

The theme applies to Today, Tasks (list/compact/board), Habits, Calendar, Inbox, Projects, Goals, Finance (all five sections), Profile, and Weekly Review. Shared styling covers login, edit dialogs, assistant messages and proposals, theme dropdown, filter panel, tooltip text, selected/error/disabled/focus states, pet speech bubbles, and reward overlays.

Artwork has its own date-header grid cell. On narrow screens it moves below the date controls. Sidebar expansion/collapse, responsive navigation, date picking, filters, task/habit actions, assistant behavior, APIs, and stored data remain unchanged. Other themes retain their styling.

## Validation

- Production build and existing frontend tests.
- Server-rendered markup checks for date navigation, sidebar, header, quick task input, filter panel, task/habit cards, events/deadlines, and five finance forms (13 component cases, synthetic data only).
- CSS parsing and opacity checks for the preset and shared overlay rules.
- Text contrast checked across primary, card, elevated, sidebar, subtle, and selection surfaces: at least 4.57:1; semantic badge text also exceeds 4.5:1.
- Generated WebP verified fully opaque; font family and Kazakh glyph coverage verified locally.
- Browser and touch visual QA were unavailable in this session. Source/layout checks and server-rendered markup do not establish visual acceptance.

## Artwork provenance

Created with the built-in imagegen tool. The resulting PNG was converted to an optimized, fully opaque WebP for the application. The original remains in the generator's output folder.

Final generation prompt:

> Create a production website decorative banner asset, NOT a UI mockup. Use case: illustration-story. Panoramic horizontal Japanese stationery illustration, approximately 3:1 aspect ratio. OPAQUE flat solid cream background matching hex #FFFCF7, with absolutely no transparent pixels. Subject: a very understated Japanese ink-wash Mount Fuji with snowy ivory summit, a small muted vermilion rising sun (#C34B3F) behind it, a delicate sparse cherry blossom branch entering from the upper right with dusty pale pink blossoms and a few muted vermilion buds, and a few quiet sage-gray mountain foothills along the bottom. Medium: elegant contemporary sumi-e on smooth cream paper, restrained imperfect brush contours, wabi-sabi, Muji editorial stationery, very subtle ink texture ONLY inside the artwork. Composition: low visual density, generous empty cream space above and around the scene, art along the lower third and right side, leftmost 15 percent completely empty flat #FFFCF7 cream so the edge can meet a matching solid card. Mountains are pale sage and warm ink gray, never dark heavy or high contrast; sun is small and desaturated. Fine unobtrusive seigaiha wave linework in warm beige near the lower-left corner. The artwork should remain quiet at 400 pixels wide and 160 pixels tall. No text, no labels, no interface controls, no gradients in the background, no people, no photorealism, no glossy effect, no strong drop shadows, no large detailed pattern behind content.
