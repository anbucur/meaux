# Meaux atelier

A static portfolio built from the original leather-and-chrome entrance and Meaux’s local photographic archive. Open `index.html` directly, or serve this folder with `python -m http.server 4173` and visit `http://localhost:4173`.

## Files

- `index.html`: entrance, page sections, and project viewer.
- `assets/site.css`: responsive page design.
- `assets/site.js`: curated selection, searchable archive, project viewer, and entrance controls.
- `assets/vault.js`: original canvas screw, reflection, leather, and audio effects.
- `assets/materials.js`: a continuous WebGL mercury sculpture whose surface becomes ferrofluid near the cursor, with a static fallback when WebGL is unavailable.
- `assets/entrance.css`: the unified lambskin, liquid aperture, and wordmark composition.
- `assets/portfolio-data.js`: the 61 local posts used by the gallery.
- `instagram/meauxsvision/`: source images and original JSON/CSV metadata.

## Content

Original photo colors are preserved. Eight works form the selected portfolio; the full archive contains all 61 downloaded images. Opening a work displays its original caption and source link. Carousel posts contain their downloaded cover only; the viewer links to the full Instagram post.

The four service descriptions are editorial website copy. Photographic works are not presented as interior or identity case studies. Contact links open email to `bucuralexandrunicolae@gmail.com`.

The entrance supports keyboard controls, a skip button, optional sound (off by default), and reduced motion. The page keeps the base’s Tailwind CDN and Google Fonts dependencies, which require internet access.
