

Thinking: User picked "Full parchment restyle". I need to propose a concrete reference look + execution. The current renderer rasterizes polygons to a PNG used as Leaflet ImageOverlay. To go fully hand-illustrated parchment, two viable paths:

A) **Procedural parchment renderer** — rewrite `azgaarMapRenderer.ts` to draw aged-paper background (noise + vignette + stains), sepia/ink land fills, hatched coastlines, hand-drawn-style borders (jittered strokes), and scatter vector tree/mountain/hill glyphs based on cell height. State color shown as faint tinted wash only. All baked into the PNG, no animation. Keeps existing pipeline, no new assets.

B) **AI-generated parchment basemap** — generate one large illustrated map via nano-banana-pro using current state polygons as guidance. Risk: doesn't match cell geometry, expensive, hard to iterate.

A is the right call — deterministic, matches the actual world geometry, no asset pipeline. Should pick a clear reference: classic Tolkien/D&D hex-map style — cream parchment, brown ink, tiny pine-tree clusters, triangle mountains, dotted coastline shading, cursive-friendly tinted state regions.

Keep it tight — one file change + minor tweak to ocean styling.

