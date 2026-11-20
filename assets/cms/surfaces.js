/* =====================================================================
   MEAUX CMS — MATERIAL, PATTERN & PHOTO BACKGROUND SURFACE ENGINE (v2.0)
   Supports: Initial Entrance Page (Vault), Global Site, and Per-Page
   ===================================================================== */

const SVG_HERRINGBONE = `url("data:image/svg+xml,${encodeURIComponent(
  `<svg xmlns='http://www.w3.org/2000/svg' width='48' height='48' viewBox='0 0 48 48'>
    <path d='M0 12 L12 0 L24 12 L12 24 Z M24 12 L36 0 L48 12 L36 24 Z M0 36 L12 24 L24 36 L12 48 Z M24 36 L36 24 L48 36 L36 48 Z' fill='none' stroke='#ffffff' stroke-opacity='0.22' stroke-width='1.2'/>
    <path d='M6 12 L12 6 L18 12 M30 12 L36 6 L42 12 M6 36 L12 30 L18 36 M30 36 L36 30 L42 36' fill='none' stroke='#ffffff' stroke-opacity='0.14' stroke-width='1'/>
  </svg>`
)}")`;

const SVG_CHROME_GRID = `url("data:image/svg+xml,${encodeURIComponent(
  `<svg xmlns='http://www.w3.org/2000/svg' width='64' height='64' viewBox='0 0 64 64'>
    <path d='M64 0 L0 0 0 64' fill='none' stroke='#ffffff' stroke-opacity='0.16' stroke-width='1'/>
    <circle cx='0' cy='0' r='2.2' fill='#ffffff' fill-opacity='0.55'/>
    <circle cx='64' cy='0' r='2.2' fill='#ffffff' fill-opacity='0.55'/>
    <circle cx='0' cy='64' r='2.2' fill='#ffffff' fill-opacity='0.55'/>
  </svg>`
)}")`;

const CSS_FLUTED_CHROME =
  'repeating-linear-gradient(90deg, rgba(255,255,255,0.03) 0px, rgba(255,255,255,0.22) 3px, rgba(255,255,255,0.02) 7px, rgba(0,0,0,0.45) 14px, rgba(255,255,255,0.09) 18px, rgba(0,0,0,0.25) 22px)';

export const LUXURY_SWATCHES = [
  { name: 'Obsidian', hex: '#08080a' },
  { name: 'Charcoal', hex: '#1c1c21' },
  { name: 'Oxblood', hex: '#7a1620' },
  { name: 'Deep Wine', hex: '#450d16' },
  { name: 'Atelier Forest', hex: '#123022' },
  { name: 'Espresso', hex: '#331f16' },
  { name: 'Midnight Navy', hex: '#101d33' },
  { name: 'Smoked Slate', hex: '#2e333c' },
  { name: 'Gunmetal', hex: '#4f545e' },
  { name: 'Warm Bronze', hex: '#6e573e' },
  { name: 'Limestone', hex: '#9e9280' },
  { name: 'Chalk Bone', hex: '#d8d2c7' }
];

export const SURFACE_CATALOG = [
  {
    id: 'default',
    name: 'Atelier Default',
    category: 'solid',
    tag: 'Reset',
    type: 'default',
    defaults: { color: '#080808', intensity: 0, scale: 320, darkness: 0, blur: 0, finish: 'multiply' }
  },
  {
    id: 'custom-photo',
    name: 'Custom Photo',
    category: 'photo',
    tag: 'Full-Bleed Image',
    type: 'custom-photo',
    url: 'instagram/meauxsvision/images/DW9lQW_DUjv.jpg',
    defaults: {
      color: '#08080a',
      imageUrl: 'instagram/meauxsvision/images/DW9lQW_DUjv.jpg',
      intensity: 0.85,
      scale: 320,
      darkness: 0.45,
      blur: 0,
      finish: 'normal'
    }
  },
  {
    id: 'solid',
    name: 'Solid Color',
    category: 'solid',
    tag: 'Pure Tone',
    type: 'solid',
    defaults: { color: '#101d33', intensity: 0, scale: 320, darkness: 0.1, blur: 0, finish: 'multiply' }
  },
  {
    id: 'intrecciato',
    name: 'Intrecciato Weave',
    category: 'leather',
    tag: 'Woven Leather',
    type: 'image',
    url: 'assets/textures/intrecciato.jpg?v=2',
    defaults: { color: '#7a1620', intensity: 0.88, scale: 340, darkness: 0.42, blur: 0, finish: 'multiply' }
  },
  {
    id: 'calfskin',
    name: 'Calfskin Grain',
    category: 'leather',
    tag: 'Matte Leather',
    type: 'image',
    url: 'assets/leather-grain.svg',
    defaults: { color: '#141418', intensity: 0.7, scale: 260, darkness: 0.25, blur: 0, finish: 'screen' }
  },
  {
    id: 'silk-moire',
    name: 'Silk Moiré',
    category: 'leather',
    tag: 'Couture Textile',
    type: 'image',
    url: 'assets/textures/silk-moire.jpg',
    defaults: { color: '#1c1c21', intensity: 0.78, scale: 460, darkness: 0.45, blur: 0, finish: 'soft-light' }
  },
  {
    id: 'herringbone',
    name: 'Couture Herringbone',
    category: 'leather',
    tag: 'Geometric Weave',
    type: 'pattern',
    backgroundImage: SVG_HERRINGBONE,
    defaults: { color: '#141418', intensity: 0.55, scale: 48, darkness: 0.15, blur: 0, finish: 'screen' }
  },
  {
    id: 'concrete',
    name: 'Raw Concrete',
    category: 'stone',
    tag: 'Brutalist',
    type: 'image',
    url: 'assets/textures/concrete.jpg',
    defaults: { color: '#2e333c', intensity: 0.85, scale: 480, darkness: 0.48, blur: 0, finish: 'multiply' }
  },
  {
    id: 'travertine',
    name: 'Honed Travertine',
    category: 'stone',
    tag: 'Architectural Stone',
    type: 'image',
    url: 'assets/textures/travertine.jpg',
    defaults: { color: '#6e573e', intensity: 0.82, scale: 520, darkness: 0.5, blur: 0, finish: 'multiply' }
  },
  {
    id: 'chrome-liquid',
    name: 'Liquid Chrome',
    category: 'chrome',
    tag: 'Molten Mercury',
    type: 'image',
    url: 'assets/textures/chrome-liquid.jpg',
    defaults: { color: '#1c1c21', intensity: 0.55, scale: 540, darkness: 0.52, blur: 0, finish: 'screen' }
  },
  {
    id: 'chrome-brushed',
    name: 'Brushed Titanium',
    category: 'chrome',
    tag: 'Machined Metal',
    type: 'image',
    url: 'assets/textures/chrome-brushed.jpg',
    defaults: { color: '#2e333c', intensity: 0.65, scale: 440, darkness: 0.46, blur: 0, finish: 'soft-light' }
  },
  {
    id: 'chrome-fluted',
    name: 'Fluted Chrome',
    category: 'chrome',
    tag: 'Ribbed Metal',
    type: 'pattern',
    backgroundImage: CSS_FLUTED_CHROME,
    defaults: { color: '#18181c', intensity: 0.65, scale: 22, darkness: 0.25, blur: 0, finish: 'screen' }
  },
  {
    id: 'chrome-grid',
    name: 'Chrome Hairline Grid',
    category: 'chrome',
    tag: 'Architectural Grid',
    type: 'pattern',
    backgroundImage: SVG_CHROME_GRID,
    defaults: { color: '#0d0d10', intensity: 0.75, scale: 64, darkness: 0.1, blur: 0, finish: 'screen' }
  }
];

export function getSurfaceDef(surfaceId) {
  return SURFACE_CATALOG.find(s => s.id === surfaceId) || SURFACE_CATALOG[0];
}

export function buildSurfacePreviewStyle(surfaceId, overrides = {}) {
  const def = getSurfaceDef(surfaceId);
  const cfg = { ...def.defaults, ...overrides };
  if (def.type === 'default' || def.type === 'solid') {
    return `background-color: ${cfg.color};`;
  }
  if (def.type === 'custom-photo') {
    const imgUrl = cfg.imageUrl || def.url;
    return `background-color: ${cfg.color}; background-image: url('${imgUrl}'); background-size: cover; background-position: center;`;
  }
  const bgImg = def.type === 'image' ? `url('${def.url}')` : def.backgroundImage;
  const size = def.type === 'pattern' ? `${Math.max(16, Math.round(cfg.scale / 2))}px` : '120px';
  return `background-color: ${cfg.color}; background-image: ${bgImg}; background-size: ${size}; background-blend-mode: ${cfg.finish || 'multiply'};`;
}

function renderSurfaceIntoLayer(layer, activeCfg) {
  const def = getSurfaceDef(activeCfg.surfaceId);
  const color = activeCfg.color || def.defaults.color;
  const intensity = activeCfg.intensity !== undefined ? Number(activeCfg.intensity) : def.defaults.intensity;
  const scale = activeCfg.scale !== undefined ? Number(activeCfg.scale) : def.defaults.scale;
  const darkness = activeCfg.darkness !== undefined ? Number(activeCfg.darkness) : def.defaults.darkness;
  const blur = activeCfg.blur !== undefined ? Number(activeCfg.blur) : (def.defaults.blur || 0);
  const finish = activeCfg.finish || def.defaults.finish || 'multiply';

  layer.style.display = 'block';
  layer.style.backgroundColor = color;

  const tex = layer.querySelector('.meaux-surface-texture');
  const veil = layer.querySelector('.meaux-surface-veil');

  if (tex) {
    tex.style.filter = blur > 0 ? `blur(${blur}px)` : '';
    tex.style.transform = blur > 0 ? 'scale(1.06)' : '';

    if (def.type === 'solid') {
      tex.style.backgroundImage = 'none';
      tex.style.opacity = '0';
    } else if (def.type === 'custom-photo') {
      const photoUrl = activeCfg.imageUrl || def.url;
      tex.style.backgroundImage = photoUrl ? `url('${photoUrl}')` : 'none';
      tex.style.backgroundSize = 'cover';
      tex.style.backgroundPosition = activeCfg.focalPoint || 'center center';
      tex.style.backgroundRepeat = 'no-repeat';
      tex.style.mixBlendMode = finish === 'normal' ? 'normal' : finish;
      tex.style.opacity = String(intensity);
    } else if (def.type === 'image') {
      tex.style.backgroundImage = `url('${def.url}')`;
      tex.style.backgroundSize = `${scale}px auto`;
      tex.style.backgroundPosition = 'center center';
      tex.style.backgroundRepeat = 'repeat';
      tex.style.mixBlendMode = finish;
      tex.style.opacity = String(intensity);
    } else if (def.type === 'pattern') {
      tex.style.backgroundImage = def.backgroundImage;
      tex.style.backgroundSize = def.id === 'chrome-fluted' ? `${Math.max(12, Math.round(scale))}px 100%` : `${scale}px ${scale}px`;
      tex.style.backgroundPosition = 'center center';
      tex.style.backgroundRepeat = 'repeat';
      tex.style.mixBlendMode = finish;
      tex.style.opacity = String(intensity);
    }
  }

  if (veil) {
    veil.style.background = `radial-gradient(ellipse at 50% 0%, rgba(5, 5, 6, ${(darkness * 0.65).toFixed(2)}), rgba(5, 5, 6, ${darkness.toFixed(2)}) 78%)`;
  }
}

/**
 * Applies the custom background surface to the Initial Entrance Vault (#leather-vault).
 */
export function applyVaultSurface(backgroundsConfig) {
  const vault = document.getElementById('leather-vault');
  const stage = document.getElementById('vault-stage');
  if (!vault || !stage) return;

  let layer = document.getElementById('meaux-vault-surface-layer');
  if (!layer) {
    layer = document.createElement('div');
    layer.id = 'meaux-vault-surface-layer';
    layer.className = 'meaux-vault-surface-layer';
    layer.setAttribute('aria-hidden', 'true');
    layer.innerHTML = '<div class="meaux-surface-texture"></div><div class="meaux-surface-veil"></div>';
    stage.prepend(layer);
  }

  const bg = backgroundsConfig || {};
  const vaultCfg = bg.vault && bg.vault.surfaceId && bg.vault.surfaceId !== 'default'
    ? bg.vault
    : null;

  if (!vaultCfg) {
    vault.classList.remove('has-custom-vault-surface');
    layer.style.display = 'none';
    return;
  }

  vault.classList.add('has-custom-vault-surface');
  renderSurfaceIntoLayer(layer, vaultCfg);
}

/**
 * Ensures fixed background layers exist inside #atelier-world & #leather-vault
 * and applies the active surface (page override > global > default) + vault surface.
 */
export function applyActiveSurface(backgroundsConfig, activeTab = 'atelier') {
  // Always keep the Initial Entrance Page (Vault) surface in sync too
  applyVaultSurface(backgroundsConfig);

  const world = document.getElementById('atelier-world');
  if (!world) return;

  let layer = document.getElementById('meaux-surface-layer');
  if (!layer) {
    layer = document.createElement('div');
    layer.id = 'meaux-surface-layer';
    layer.className = 'meaux-surface-layer';
    layer.setAttribute('aria-hidden', 'true');
    layer.innerHTML = '<div class="meaux-surface-texture"></div><div class="meaux-surface-veil"></div>';
    world.prepend(layer);
  }

  const bg = backgroundsConfig || {};
  const pageCfg = bg.pages && bg.pages[activeTab];
  const activeCfg = (pageCfg && pageCfg.surfaceId && pageCfg.surfaceId !== 'default')
    ? pageCfg
    : (bg.global && bg.global.surfaceId && bg.global.surfaceId !== 'default' ? bg.global : null);

  if (!activeCfg) {
    document.body.classList.remove('has-custom-surface');
    layer.style.display = 'none';
    return;
  }

  document.body.classList.add('has-custom-surface');
  renderSurfaceIntoLayer(layer, activeCfg);
}
