/* ==========================================
   PORTFOLIO DATA (overridable by the CMS)
   ========================================== */
let archive = Array.isArray(window.MEAUX_ARCHIVE) ? window.MEAUX_ARCHIVE.slice() : [];
let curated = [
  {id: 'DW9lQW_DUjv', title: 'Anouk', category: 'Portrait & styling'},
  {id: 'DTpuNcKjeUN', title: 'Unidentified', category: 'Photography & styling'},
  {id: 'DL-e-W1N1w-', title: 'Fetus', category: 'Photographic study'},
  {id: 'DEXuQ0gNbcp', title: 'Tenebris Papilionem', category: 'Photographic study'},
  {id: 'DTPohhYjdPI', title: 'Powerwoman', category: 'Portrait photography'},
  {id: 'CqOSc5kN3gA', title: 'Vanderwilt', category: 'Photography & creative direction'},
  {id: 'DALs3rUt3RC', title: 'Vigil', category: 'Photography, styling & direction'},
  {id: 'CbI4R9FMcTQ', title: 'Gucci Beauty', category: 'Photography'}
];
const DEFAULT_CONTACT_EMAIL = 'bucuralexandrunicolae@gmail.com';
let view = 'selected';
let currentItems = [];
let activeProject = null;
let returnFocus = null;

/* ==========================================
   PHOTOGRAPHY BENTO PORTFOLIO (BY SHOOT STYLE)
   ========================================== */
const PHOTO_STYLES = {
  all: {
    summary: 'A cross-section of sculptural studio studies, fashion campaigns, intimate portraits, and destination shoots.',
    items: [
      { id: 'DW9lQW_DUjv', title: 'Anouk', subtitle: 'Chiaroscuro Study', tag: 'Sculptural', span: 'span-6x6', pos: '50% 35%' },
      { id: 'CqOSc5kN3gA', title: 'Vanderwilt Amsterdam', subtitle: 'Campaign & Direction', tag: 'Campaign', span: 'span-3x3', pos: '50% 42%' },
      { id: 'CbI4R9FMcTQ', title: 'Gucci Beauty', subtitle: 'Beauty Campaign', tag: 'Campaign', span: 'span-3x3', pos: '50% 50%' },
      { id: 'DTPohhYjdPI', title: 'Powerwoman', subtitle: 'Fatima Essahsah', tag: 'Portrait', span: 'span-3x3', pos: '50% 30%' },
      { id: 'C0RNWyrt7sx', title: 'Lanzarote', subtitle: 'Destination Shoot', tag: 'Location', span: 'span-3x3', pos: '50% 50%' },
      { id: 'DEXuQ0gNbcp', title: 'Tenebris Papilionem', subtitle: 'Coastal Veil Study', tag: 'Sculptural', span: 'span-4x4', pos: '50% 42%' },
      { id: 'Cr8e19bN3mq', title: 'Jean Paul Gaultier', subtitle: 'Editorial Shoot', tag: 'Campaign', span: 'span-4x4', pos: '50% 38%' },
      { id: 'C7ZtLU_NaDC', title: 'Sabri', subtitle: 'Shadow Profile', tag: 'Portrait', span: 'span-4x4', pos: '50% 40%' },
      { id: 'DL-e-W1N1w-', title: 'Fetus', subtitle: 'Sculptural Monochrome', tag: 'Sculptural', span: 'span-6x5', pos: '50% 50%' },
      { id: 'DALs3rUt3RC', title: 'Vigil', subtitle: 'Princeps Tenebris', tag: 'Sculptural', span: 'span-6x5', pos: '50% 50%' }
    ]
  },
  'avant-garde': {
    summary: 'Shadow, silhouette, and conceptual studio studies built on high contrast and restraint.',
    items: [
      { id: 'DW9lQW_DUjv', title: 'Anouk', subtitle: 'Chiaroscuro Study', tag: 'Sculptural', span: 'span-6x6', pos: '50% 35%' },
      { id: 'DEXuQ0gNbcp', title: 'Tenebris Papilionem', subtitle: 'Coastal Veil Study', tag: 'Sculptural', span: 'span-3x3', pos: '50% 42%' },
      { id: 'DTpuNcKjeUN', title: 'Unidentified', subtitle: 'Frosted Glass Study', tag: 'Avant-Garde', span: 'span-3x3', pos: '50% 40%' },
      { id: 'DF8iodrtbss', title: 'Daan', subtitle: 'Dark Studio Silhouette', tag: 'Avant-Garde', span: 'span-3x3', pos: '50% 38%' },
      { id: 'DH8FEYCNA1U', title: 'Butterfly', subtitle: 'Backlit Silhouette', tag: 'Sculptural', span: 'span-3x3', pos: '50% 38%' },
      { id: 'DL-e-W1N1w-', title: 'Fetus', subtitle: 'Sculptural Monochrome', tag: 'Sculptural', span: 'span-4x4', pos: '50% 50%' },
      { id: 'DALs3rUt3RC', title: 'Vigil', subtitle: 'Princeps Tenebris', tag: 'Sculptural', span: 'span-4x4', pos: '50% 50%' },
      { id: 'C-vbQzBtHy8', title: 'Cosmica Mullier', subtitle: 'Studio Study', tag: 'Avant-Garde', span: 'span-4x4', pos: '50% 38%' }
    ]
  },
  campaigns: {
    summary: 'Editorial campaigns and lookbooks directed for fashion houses and independent labels.',
    items: [
      { id: 'CqOSc5kN3gA', title: 'Vanderwilt Amsterdam', subtitle: 'Campaign & Direction', tag: 'Campaign', span: 'span-6x6', pos: '50% 42%' },
      { id: 'Cxz0P5ytark', title: 'Vanderwilt × Gowtu', subtitle: 'Monochrome Editorial', tag: 'Editorial', span: 'span-3x3', pos: '50% 45%' },
      { id: 'CbI4R9FMcTQ', title: 'Gucci Beauty', subtitle: 'Beauty Campaign', tag: 'Campaign', span: 'span-3x3', pos: '50% 50%' },
      { id: 'CoITMmjtXDQ', title: 'Jacquemus', subtitle: 'Studio Lookbook', tag: 'Lookbook', span: 'span-3x3', pos: '50% 50%' },
      { id: 'C7zMIi5tSg4', title: 'Dubai Silhouette', subtitle: 'Editorial Direction', tag: 'Editorial', span: 'span-3x3', pos: '50% 42%' },
      { id: 'Cr8e19bN3mq', title: 'Jean Paul Gaultier', subtitle: 'Editorial Shoot', tag: 'Editorial', span: 'span-4x4', pos: '50% 38%' },
      { id: 'CdVsxkntawa', title: 'Fendi / Versace', subtitle: 'Campaign Portrait', tag: 'Campaign', span: 'span-4x4', pos: '50% 35%' },
      { id: 'CcRGa1DN6AL', title: 'Josh V HQ', subtitle: 'Architectural Lookbook', tag: 'Lookbook', span: 'span-4x4', pos: '50% 42%' }
    ]
  },
  portraits: {
    summary: 'Intimate studio portraits and beauty frames focused on presence, eyes, and character.',
    items: [
      { id: 'DTPohhYjdPI', title: 'Powerwoman', subtitle: 'Fatima Essahsah', tag: 'Portrait', span: 'span-6x6', pos: '50% 30%' },
      { id: 'C7ZtLU_NaDC', title: 'Sabri', subtitle: 'Shadow Profile', tag: 'Portrait', span: 'span-3x3', pos: '50% 40%' },
      { id: 'C3Ky93mNNFw', title: 'Isabelle’s Eyes', subtitle: 'Close-Up Study', tag: 'Beauty', span: 'span-3x3', pos: '50% 45%' },
      { id: 'CneOhP-t126', title: 'Fleur', subtitle: 'Beauty & Makeup', tag: 'Beauty', span: 'span-3x3', pos: '50% 40%' },
      { id: 'CblHULWsvwV', title: 'Bromtji', subtitle: 'Chiaroscuro Close-Up', tag: 'Portrait', span: 'span-3x3', pos: '50% 40%' },
      { id: 'DT2XryvjWCB', title: 'Daan Series', subtitle: 'Monochrome Portrait', tag: 'Portrait', span: 'span-4x4', pos: '50% 35%' },
      { id: 'C4a1FCkNysZ', title: 'Gloom', subtitle: 'Studio Portrait', tag: 'Portrait', span: 'span-4x4', pos: '50% 40%' },
      { id: 'DRKpcsjDSo2', title: 'Anouk', subtitle: 'Editorial Beauty', tag: 'Beauty', span: 'span-4x4', pos: '50% 38%' }
    ]
  },
  location: {
    summary: 'Natural light, architectural landscapes, destination shoots, and editorial bridal stories.',
    items: [
      { id: 'C0RNWyrt7sx', title: 'Lanzarote', subtitle: 'Destination Shoot', tag: 'Location', span: 'span-6x6', pos: '50% 48%' },
      { id: 'C7b4UpfNrcR', title: 'Milos', subtitle: 'Coastal Editorial', tag: 'Location', span: 'span-3x3', pos: '50% 40%' },
      { id: 'CgZWrHYtSBE', title: 'IB', subtitle: 'Architectural Location', tag: 'Location', span: 'span-3x3', pos: '50% 45%' },
      { id: 'CmUE_30NMYe', title: 'Golden Hour', subtitle: 'Sunset Silhouette', tag: 'Location', span: 'span-3x3', pos: '50% 50%' },
      { id: 'CnClh0aN_b4', title: 'Oum in Paris', subtitle: 'Night Architecture', tag: 'Location', span: 'span-3x3', pos: '50% 45%' },
      { id: 'CxlF0ZWtP8T', title: 'Liza & Omar', subtitle: 'Editorial Wedding', tag: 'Bridal', span: 'span-4x4', pos: '50% 45%' },
      { id: 'CjKj4H5tdNK', title: 'To Have & To Hold', subtitle: 'Bridal Couple', tag: 'Bridal', span: 'span-4x4', pos: '50% 38%' },
      { id: 'CbaXNFuMYHG', title: 'She Bridal House', subtitle: 'Bridal Campaign', tag: 'Bridal', span: 'span-4x4', pos: '50% 42%' }
    ]
  }
};
let activePhotoStyle = 'all';

/**
 * Automatically computes gap-free, portrait-native Bento spans (12-col grid)
 * for any number of items so adding, removing, or reordering images always
 * produces a balanced, solid Bento composition with zero empty holes.
 */
function computeBentoSpans(count) {
  if (count <= 0) return [];
  if (count === 1) return ['span-6x6'];
  if (count === 2) return ['span-6x6', 'span-6x6'];
  if (count === 3) return ['span-4x4', 'span-4x4', 'span-4x4'];
  if (count === 4) return ['span-3x3', 'span-3x3', 'span-3x3', 'span-3x3'];
  if (count === 5) return ['span-6x6', 'span-3x3', 'span-3x3', 'span-3x3', 'span-3x3'];
  if (count === 6) return ['span-6x6', 'span-6x6', 'span-3x3', 'span-3x3', 'span-3x3', 'span-3x3'];
  if (count === 7) return ['span-6x6', 'span-3x3', 'span-3x3', 'span-3x3', 'span-3x3', 'span-6x5', 'span-6x5'];
  if (count === 8) return ['span-6x6', 'span-3x3', 'span-3x3', 'span-3x3', 'span-3x3', 'span-4x4', 'span-4x4', 'span-4x4'];
  if (count === 9) return ['span-6x6', 'span-3x3', 'span-3x3', 'span-3x3', 'span-3x3', 'span-3x3', 'span-3x3', 'span-3x3', 'span-3x3'];
  if (count === 10) return ['span-6x6', 'span-3x3', 'span-3x3', 'span-3x3', 'span-3x3', 'span-4x4', 'span-4x4', 'span-4x4', 'span-6x5', 'span-6x5'];

  // For 11+ items: peel off 5-item Hero blocks, keeping remainder >= 2 (never 1 orphan)
  const spans = [];
  let rem = count;
  while (rem > 10) {
    spans.push('span-6x6', 'span-3x3', 'span-3x3', 'span-3x3', 'span-3x3');
    rem -= 5;
  }
  return spans.concat(computeBentoSpans(rem));
}

function renderPhotoBento(styleKey = activePhotoStyle, animate = true) {
  const grid = document.getElementById('photo-bento-grid');
  if (!grid) return;
  const config = PHOTO_STYLES[styleKey] || PHOTO_STYLES.all;
  activePhotoStyle = PHOTO_STYLES[styleKey] ? styleKey : 'all';

  // Update pill counts dynamically as items are added/removed
  document.querySelectorAll('.photo-style-pill[data-photo-style]').forEach(pill => {
    const key = pill.dataset.photoStyle;
    const isCurrent = key === activePhotoStyle;
    pill.classList.toggle('active', isCurrent);
    pill.setAttribute('aria-selected', isCurrent ? 'true' : 'false');
    const countEl = pill.querySelector('.pill-count');
    if (countEl && PHOTO_STYLES[key]) {
      countEl.textContent = String(PHOTO_STYLES[key].items.length).padStart(2, '0');
    }
  });

  const summaryEl = document.getElementById('photo-style-summary');
  if (summaryEl && summaryEl.textContent.trim() !== config.summary) {
    summaryEl.classList.add('is-swapping');
    setTimeout(() => {
      summaryEl.textContent = config.summary;
      summaryEl.classList.remove('is-swapping');
    }, reducedMotion.matches ? 0 : 140);
  }

  const pool = visibleArchive();
  const resolved = config.items
    .map((item, rawIdx) => {
      const post = item.image_url ? item : pool.find(p => p.shortcode === item.id);
      if (!post && !item.image_url) return null;
      return { item, post, rawIdx };
    })
    .filter(Boolean);

  const autoSpans = computeBentoSpans(resolved.length);
  grid.replaceChildren();
  const tiles = [];

  resolved.forEach(({ item, post, rawIdx }, idx) => {
    const spanClass = autoSpans[idx] || 'span-4x4';
    const src = item.image_url || imagePath(post);
    const shortcode = item.id || (post && post.shortcode) || `custom_${rawIdx}`;

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `bento-tile ${spanClass}`;
    btn.dataset.post = shortcode;
    btn.dataset.bentoScope = activePhotoStyle;
    btn.dataset.bentoIndex = String(rawIdx);
    btn.style.setProperty('--stagger', `${Math.min(idx, 10) * 45}ms`);
    btn.style.setProperty('--pos', item.pos || '50% 35%');
    btn.setAttribute('aria-label', `View ${item.title || 'Photograph'} — ${item.subtitle || ''}`);

    const img = document.createElement('img');
    img.src = src;
    img.alt = `${item.title || 'Photograph'} — ${item.subtitle || ''}`;
    img.loading = 'eager';
    img.decoding = 'async';

    const topBar = document.createElement('span');
    topBar.className = 'bento-top-bar';
    const tag = document.createElement('span');
    tag.className = 'bento-style-tag';
    tag.textContent = item.tag || 'Photography';
    const arrow = document.createElement('span');
    arrow.className = 'bento-arrow';
    arrow.setAttribute('aria-hidden', 'true');
    arrow.textContent = '↗';
    topBar.append(tag, arrow);

    const caption = document.createElement('span');
    caption.className = 'bento-caption';
    const heading = document.createElement('h3');
    heading.textContent = item.title || 'Untitled';
    const sub = document.createElement('span');
    sub.textContent = item.subtitle || 'Atelier Meaux';
    caption.append(heading, sub);

    btn.append(img, topBar, caption);
    grid.append(btn);
    tiles.push(btn);
  });

  if (!animate || reducedMotion.matches) {
    tiles.forEach(t => t.classList.add('is-revealed'));
  } else {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        tiles.forEach(t => t.classList.add('is-revealed'));
      });
    });
  }

  document.dispatchEvent(new CustomEvent('meaux:bento-rendered', { detail: { style: activePhotoStyle, count: resolved.length } }));
}
const dialog = document.getElementById('project-dialog');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const getGrid = () => document.getElementById('portfolio-grid');
const getSearchInput = () => document.getElementById('archive-search');
const imagePath = p => p.image_url || `instagram/meauxsvision/images/${p.image_file}`;
const contactEmail = () => (window.MEAUX_SETTINGS && window.MEAUX_SETTINGS.contactEmail) || DEFAULT_CONTACT_EMAIL;
const escapeHTML = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

function projectInfo(post) {
  const pick = curated.find(c => c.id === post.shortcode);
  if (pick && pick.title) return {title: pick.title, category: pick.category || 'Photography'};
  if (post.title) return {title: post.title, category: post.category || 'Photography'};
  const first = (post.caption || '').split('\n').find(s => /[a-zA-Z]/.test(s)) || 'From the archive';
  const title = first.replace(/📸|🖤|🤍|❤️|🦋|🩶|🕷️|🕸️|⚪️/gu, '').trim();
  return {title: title.length > 62 ? title.slice(0,59) + '…' : title, category: post.category || 'Photography'};
}

function visibleArchive() {
  return archive.filter(p => !p.hidden);
}

function renderPortfolio() {
  const grid = getGrid();
  const searchInput = getSearchInput();
  const query = searchInput ? searchInput.value.toLocaleLowerCase().trim() : '';
  const pool = visibleArchive();
  const selectedItems = curated.map(c => pool.find(p => p.shortcode === c.id)).filter(Boolean);
  currentItems = view === 'selected'
    ? selectedItems
    : pool.filter(p => `${p.caption || ''} ${projectInfo(p).title}`.toLocaleLowerCase().includes(query));

  document.querySelectorAll('[data-view="selected"] span').forEach(s => s.textContent = String(selectedItems.length).padStart(2,'0'));
  document.querySelectorAll('[data-view="archive"] span').forEach(s => s.textContent = String(pool.length).padStart(2,'0'));
  if (!grid) return;

  grid.classList.toggle('archive', view === 'archive');
  grid.replaceChildren();
  for (const [index, post] of currentItems.entries()) {
    const info = projectInfo(post);
    const article = document.createElement('article');
    article.className = 'work-card';
    const button = document.createElement('button');
    button.type = 'button'; button.className = 'work-image';
    button.dataset.post = post.shortcode;
    button.setAttribute('aria-label', `View ${info.title}`);
    const img = document.createElement('img');
    img.src = imagePath(post); img.alt = info.title;
    img.loading = 'lazy'; img.decoding = 'async';
    const arrow = document.createElement('span');
    arrow.className = 'image-corner'; arrow.textContent = '↗'; arrow.setAttribute('aria-hidden','true');
    button.append(img,arrow);
    const meta = document.createElement('div'); meta.className = 'work-meta';
    const text = document.createElement('div');
    const heading = document.createElement('h3'); heading.textContent = info.title;
    const category = document.createElement('p'); category.textContent = info.category;
    text.append(heading,category);
    const number = document.createElement('span'); number.textContent = String(index+1).padStart(2,'0');
    meta.append(text,number); article.append(button,meta); grid.append(article);
  }
  const statusEl = document.getElementById('archive-status');
  if (statusEl) {
    statusEl.textContent = view === 'archive' ? `${currentItems.length} of ${pool.length} works${query && !currentItems.length ? '. Try another name or project.' : ''}` : '';
  }
}

function setView(next, scroll = false) {
  view = next;
  document.querySelectorAll('[data-view]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.view === next)));
  const searchWrap = document.querySelector('.archive-search');
  if (searchWrap) searchWrap.hidden = next !== 'archive';
  const showArchiveBtn = document.getElementById('show-archive');
  if (showArchiveBtn) {
    showArchiveBtn.textContent = next === 'archive' ? 'Back to selected work ↗' : 'Explore the full archive ↗';
  }
  renderPortfolio();
  const toolbar = document.querySelector('.work-toolbar');
  if (scroll && toolbar) {
    toolbar.scrollIntoView({behavior:reducedMotion.matches?'instant':'smooth',block:'start'});
  }
}

function openProject(id, trigger) {
  let post = archive.find(p => p.shortcode === id);
  if (!post) {
    // Also support custom uploaded Bento items not in the original Instagram archive
    for (const st of Object.values(PHOTO_STYLES)) {
      const found = (st.items || []).find(i => i.id === id);
      if (found) {
        post = {
          shortcode: found.id,
          title: found.title || 'Atelier Frame',
          category: found.tag || 'Photography',
          caption: found.subtitle || '',
          image_url: found.image_url || '',
          permalink: found.permalink || ''
        };
        break;
      }
    }
  }
  if (!post || !dialog) return;
  activeProject = id;
  if (!dialog.open) returnFocus = trigger || document.activeElement;
  const info = projectInfo(post);
  document.getElementById('project-title').textContent = info.title;
  document.getElementById('project-caption').textContent = post.caption || '';
  const img = document.getElementById('project-image'); img.src = imagePath(post); img.alt = info.title;
  const source = document.getElementById('project-source');
  const permalink = (post.permalink || '').trim();
  if (permalink) {
    source.hidden = false;
    source.style.display = '';
    source.href = permalink;
  } else {
    source.hidden = true;
    source.style.display = 'none';
    source.removeAttribute('href');
  }
  const commission = dialog.querySelector('.project-commission');
  if (commission) commission.href = `mailto:${contactEmail()}`;
  document.getElementById('project-cover-note').textContent = post.media_type === 'carousel' ? 'Cover image from the series. View the original post for the complete carousel.' : '';
  const items = currentItems.some(p => p.shortcode === id) ? currentItems : visibleArchive();
  const index = Math.max(0, items.findIndex(p => p.shortcode === id));
  document.getElementById('project-position').textContent = `${String(index+1).padStart(2,'0')} / ${String(Math.max(1, items.length)).padStart(2,'0')}`;
  document.getElementById('previous-project').disabled = index <= 0;
  document.getElementById('next-project').disabled = index >= items.length - 1;
  if (!dialog.open) { dialog.showModal(); document.body.classList.add('dialog-open'); }
}

function stepProject(direction) {
  const items = currentItems.some(p => p.shortcode === activeProject) ? currentItems : visibleArchive();
  const target = items[items.findIndex(p => p.shortcode === activeProject) + direction];
  if (target) openProject(target.shortcode);
}

/* ==========================================
   TAB NAVIGATION SYSTEM (pages are discovered from the DOM)
   TAB NAVIGATION & MOBILE DRAWER SYSTEM
   ========================================== */
let activeTab = 'atelier';
const getTabs = () => Array.from(document.querySelectorAll('.tab-view')).map(v => v.id.replace(/^view-/, ''));

function syncMobileNav() {
  const list = document.getElementById('mobile-nav-list');
  const desktopNav = document.querySelector('.atelier-tabs');
  if (!list || !desktopNav) return;

  const buttons = Array.from(desktopNav.querySelectorAll('.tab-btn[data-tab]'))
    .filter(btn => btn.style.display !== 'none');

  list.replaceChildren();
  buttons.forEach((btn, idx) => {
    const tabId = btn.dataset.tab;
    const rawLabel = (btn.textContent || '').replace(/↗/g, '').trim();
    const isActive = tabId === activeTab;
    const item = document.createElement('button');
    item.type = 'button';
    item.className = `mobile-nav-item${isActive ? ' active' : ''}`;
    item.dataset.mobileTab = tabId;
    item.setAttribute('aria-current', isActive ? 'page' : 'false');
    item.innerHTML = `
      <span class="mobile-nav-item-main">
        <span class="mobile-nav-num">${String(idx + 1).padStart(2, '0')}</span>
        <span class="mobile-nav-label">${escapeHTML(rawLabel)}</span>
      </span>
      <span class="mobile-nav-arrow" aria-hidden="true">${tabId === 'enquiries' ? '↗' : '→'}</span>
    `;
    list.appendChild(item);
  });

  const mobileEnq = document.querySelector('.mobile-enquire-btn');
  if (mobileEnq) mobileEnq.classList.toggle('active', activeTab === 'enquiries');
}

function openMobileNav() {
  const drawer = document.getElementById('mobile-nav-drawer');
  const toggle = document.getElementById('mobile-menu-toggle');
  if (!drawer) return;
  syncMobileNav();
  drawer.hidden = false;
  drawer.setAttribute('aria-hidden', 'false');
  if (toggle) toggle.setAttribute('aria-expanded', 'true');
  document.body.classList.add('mobile-nav-open');
  const closeBtn = document.getElementById('mobile-menu-close');
  if (closeBtn) closeBtn.focus({ preventScroll: true });
}

function closeMobileNav(restoreFocus = false) {
  const drawer = document.getElementById('mobile-nav-drawer');
  const toggle = document.getElementById('mobile-menu-toggle');
  if (!drawer || drawer.hidden) return;
  drawer.hidden = true;
  drawer.setAttribute('aria-hidden', 'true');
  if (toggle) toggle.setAttribute('aria-expanded', 'false');
  document.body.classList.remove('mobile-nav-open');
  if (restoreFocus && toggle) toggle.focus({ preventScroll: true });
}

function switchTab(tabId, shouldScroll = true, preselectedDiscipline = null) {
  const tabs = getTabs();
  if (!tabs.includes(tabId)) {
    tabId = tabs.includes(activeTab) ? activeTab : (tabs[0] || 'atelier');
  }
  activeTab = tabId;
  closeMobileNav(false);

  // Update tab buttons
  document.querySelectorAll('.tab-btn[data-tab]').forEach(btn => {
    const isTarget = btn.dataset.tab === tabId;
    btn.classList.toggle('active', isTarget);
    btn.setAttribute('aria-selected', isTarget ? 'true' : 'false');
  });

  // Keep mobile nav active indicator synced
  syncMobileNav();

  // Update tab panels
  document.querySelectorAll('.tab-view').forEach(viewEl => {
    const matches = viewEl.id === `view-${tabId}`;
    viewEl.hidden = !matches;
    viewEl.classList.toggle('active', matches);
  });

  // Update hash without jumping
  if (window.location.hash !== `#${tabId}`) {
    history.replaceState(null, '', `${window.location.pathname}${window.location.search}#${tabId}`);
  }

  // Handle preselecting a discipline in the enquiry form if passed
  if (preselectedDiscipline) {
    const chipInput = Array.from(document.querySelectorAll('.chip-label input')).find(i => i.value === preselectedDiscipline);
    if (chipInput) chipInput.checked = true;
  }

  // Smoothly scroll to main view top
  if (shouldScroll) {
    const mainContent = document.getElementById('main-content');
    const header = document.querySelector('.site-header');
    const headerH = header ? header.offsetHeight : 80;
    if (mainContent) {
      const topOffset = mainContent.getBoundingClientRect().top + window.scrollY - headerH;
      window.scrollTo({
        top: Math.max(0, topOffset),
        behavior: reducedMotion.matches ? 'instant' : 'smooth'
      });
    }
  }
  document.dispatchEvent(new CustomEvent('meaux:tab', {detail: {tab: tabId}}));
}

// Deep link handling on initial load or hash change
function handleHashRoute() {
  const hash = window.location.hash.replace('#', '').trim();
  const tabs = getTabs();
  if (tabs.includes(hash)) switchTab(hash, false);
  else if (!tabs.includes(activeTab)) switchTab(tabs[0], false);
}

/* ==========================================
   BESPOKE ENQUIRY FORM LOGIC (delegated, survives content swaps)
   ========================================== */
async function handleEnquirySubmit(form) {
  const value = id => (form.querySelector(`#${id}`)?.value || '').trim();
  const name = value('client-name');
  const email = value('client-email');
  const phone = value('client-phone');
  const timeline = value('client-timeline');
  const brief = value('client-brief');

  const selectedDisciplines = Array.from(form.querySelectorAll('.chip-label input:checked')).map(cb => cb.value);
  const budgetSelected = form.querySelector('.budget-label input:checked');
  const budget = budgetSelected ? budgetSelected.value : 'Custom Commission';

  if (!name || !email || !brief) {
    alert('Please fill in your name, email, and project brief to submit your dossier.');
    return;
  }

  // Persist enquiry to Supabase database & local fallback so it appears in Admin Inbox
  const enquiryPayload = {
    client_name: name,
    client_email: email,
    phone: phone || null,
    timeline: timeline || null,
    disciplines: selectedDisciplines,
    budget,
    brief,
    status: 'new'
  };

  try {
    const localList = JSON.parse(localStorage.getItem('meaux_enquiries_local') || '[]');
    localList.unshift({
      id: 'enq_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
      ...enquiryPayload,
      created_at: new Date().toISOString()
    });
    localStorage.setItem('meaux_enquiries_local', JSON.stringify(localList.slice(0, 100)));
  } catch (e) {}

  try {
    if (window.MeauxCMS && window.MeauxCMS.supabase) {
      await window.MeauxCMS.supabase.from('enquiries').insert(enquiryPayload);
    }
  } catch (e) {
    console.warn('Could not persist enquiry to Supabase:', e);
  }

  // Build email draft mailto fallback
  const subject = encodeURIComponent(`Atelier Meaux Commission: ${name} — ${selectedDisciplines.join(', ') || 'General'}`);
  const emailBody = encodeURIComponent(
    `ATELIER MEAUX COMMISSION DOSSIER\n` +
    `==================================\n\n` +
    `CLIENT / HOUSE: ${name}\n` +
    `EMAIL: ${email}\n` +
    `PHONE: ${phone || 'Not provided'}\n` +
    `DISCIPLINES: ${selectedDisciplines.join(', ') || 'All Disciplines'}\n` +
    `INVESTMENT TIER: ${budget}\n` +
    `TARGET TIMELINE: ${timeline}\n\n` +
    `CREATIVE BRIEF / VISION:\n${brief}\n\n` +
    `==================================\n` +
    `Sent via Meaux Atelier Portal`
  );
  const mailtoUrl = `mailto:${contactEmail()}?subject=${subject}&body=${emailBody}`;

  const card = form.closest('#enquiry-form-container') || document.getElementById('enquiry-form-container');
  if (card) {
    card.innerHTML = `
      <div class="enquiry-confirmation">
        <div class="w-12 h-12 rounded-full border border-white/40 flex items-center justify-center text-white text-xl">✓</div>
        <span class="text-xs uppercase tracking-[0.25em] text-zinc-400">DOSSIER REGISTERED // ATELIER MEAUX</span>
        <h3>Thank you, ${escapeHTML(name)}.</h3>
        <p>
          Your commission brief has been recorded in our atelier database. Mohammed reviews all proposals personally to ensure alignment with the atelier's seasonal calendar. You will receive an initial appraisal within 24 to 48 hours.
        </p>
        <div class="mt-4 flex flex-col sm:flex-row gap-4">
          <a href="${mailtoUrl}" class="luxury-btn">
            <span>Open in Mail App ↗</span>
          </a>
          <button type="button" onclick="location.reload()" class="border border-white/20 text-white px-6 py-4 uppercase tracking-[0.16em] text-xs">
            <span>Submit Another Brief</span>
          </button>
        </div>
      </div>
    `;
  }
}

/* ==========================================
   VAULT INTRO & ENTRANCE SEQUENCE
   ========================================== */
function completeVaultEntry() {
  vaultIsOpen = true;
  clearTimeout(typewriterTimer);
  document.body.classList.remove('vault-locked');
  document.getElementById('leather-vault').hidden = true;
  document.getElementById('atelier-world').inert = false;
  resetMaterialExit();
  document.dispatchEvent(new CustomEvent('meaux:vault-state', { detail: { isOpen: true } }));
  const heroTitle = document.getElementById('hero-title');
  if (heroTitle) heroTitle.focus({preventScroll:true});
}

function skipIntro() {
  cancelVaultTimers();
  vaultSpring.openProgress = 1;
  vaultSpring.targetOpen = 1;
  completeVaultEntry();
}

function replayIntro() {
  cancelVaultTimers();
  resetMaterialExit();
  window.scrollTo({top:0,behavior:'instant'});
  document.getElementById('leather-vault').hidden = false;
  document.getElementById('atelier-world').inert = true;
  relockVault();
  document.dispatchEvent(new CustomEvent('meaux:vault-state', { detail: { isOpen: false } }));
  if (reducedMotion.matches) {
    cancelVaultTimers();
    vaultUnlocking = false;
    vaultSpring.openProgress = 0;
    vaultSpring.velocity = 0;
    panelEls.forEach(panel => panel.style.transform = '');
    centerPlateEl.style.transform = '';
    centerPlateEl.style.opacity = '1';
    screwPhysics.forEach((s, index) => {
      screwStates[index] = false;
      s.progress = 0;
      s.targetProgress = 0;
      s.velocity = 0;
      s.angularVelocity = 0;
      document.getElementById(`screw-wrap-${index}`).classList.remove('is-unscrewed');
      renderSingle3DScrew(s, 0);
    });
  } else {
    runTypewriter();
    requestAnimationFrame(masterAnimationLoop);
  }
  document.getElementById('enter-atelier-btn').focus();
}

/* ==========================================
   EVENT LISTENERS (delegated) & INITIALIZATION
   ========================================== */
const isEditing = () => document.body.classList.contains('cms-editing');

document.addEventListener('click', (event) => {
  // Mobile menu drawer controls
  if (event.target.closest('#mobile-menu-toggle')) {
    const drawer = document.getElementById('mobile-nav-drawer');
    if (drawer && !drawer.hidden) closeMobileNav(true);
    else openMobileNav();
    return;
  }
  if (event.target.closest('#mobile-menu-close')) {
    closeMobileNav(true);
    return;
  }
  if (event.target.closest('#mobile-replay-intro')) {
    closeMobileNav(false);
    replayIntro();
    return;
  }
  const mobileTabBtn = event.target.closest('.mobile-nav-item[data-mobile-tab]');
  if (mobileTabBtn) {
    switchTab(mobileTabBtn.dataset.mobileTab, true);
    return;
  }

  // Touch tap-to-reveal label on curated Instagram tiles
  const igTile = event.target.closest('.ig-tile');
  if (igTile && matchMedia('(hover: none)').matches && !isEditing()) {
    const wasTapped = igTile.classList.contains('is-tapped');
    document.querySelectorAll('.ig-tile.is-tapped').forEach(t => t.classList.remove('is-tapped'));
    if (!wasTapped) igTile.classList.add('is-tapped');
    return;
  }

  // CTA buttons that target a tab take priority over nav buttons
  const target = event.target.closest('[data-tab-target]');
  if (target) {
    event.preventDefault();
    switchTab(target.dataset.tabTarget, true, target.dataset.preselectDiscipline || null);
    return;
  }
  const tabBtn = event.target.closest('.tab-btn[data-tab]');
  if (tabBtn) {
    switchTab(tabBtn.dataset.tab, true);
    return;
  }
  const viewBtn = event.target.closest('[data-view]');
  if (viewBtn) {
    setView(viewBtn.dataset.view);
    return;
  }
  if (event.target.closest('#show-archive')) {
    setView(view === 'archive' ? 'selected' : 'archive', true);
    return;
  }
  const igTab = event.target.closest('.ig-feed-tab[data-ig-filter]');
  if (igTab) {
    const frame = igTab.closest('.ig-device-frame');
    const filter = igTab.dataset.igFilter;
    if (frame) {
      frame.querySelectorAll('.ig-feed-tab').forEach(btn => {
        const active = btn === igTab;
        btn.classList.toggle('active', active);
        btn.setAttribute('aria-selected', active ? 'true' : 'false');
      });
      frame.querySelectorAll('.ig-tile').forEach(tile => {
        const dim = filter === 'reel' && tile.dataset.igType !== 'reel';
        tile.classList.toggle('is-dimmed', dim);
      });
    }
    return;
  }
  const photoStylePill = event.target.closest('.photo-style-pill[data-photo-style]');
  if (photoStylePill) {
    renderPhotoBento(photoStylePill.dataset.photoStyle, true);
    return;
  }
  if (event.target.closest('#photo-open-archive')) {
    switchTab('atelier', false);
    setView('archive', true);
    return;
  }
  const postEl = event.target.closest('[data-post]');
  if (postEl && !postEl.closest('dialog') && !isEditing()) {
    if (postEl.dataset.bentoScope && PHOTO_STYLES[postEl.dataset.bentoScope]) {
      const pool = visibleArchive();
      currentItems = PHOTO_STYLES[postEl.dataset.bentoScope].items
        .map(item => pool.find(p => p.shortcode === item.id))
        .filter(Boolean);
    }
    openProject(postEl.dataset.post, postEl);
  }
});

document.addEventListener('input', (event) => {
  if (event.target.id === 'archive-search') renderPortfolio();
});

document.addEventListener('submit', (event) => {
  if (event.target.id === 'atelier-enquiry-form') {
    event.preventDefault();
    if (!isEditing()) handleEnquirySubmit(event.target);
  }
});

// Accordions in The Practice ("toggle" does not bubble, so listen in the capture phase)
document.addEventListener('toggle', (event) => {
  const detail = event.target;
  if (!(detail instanceof HTMLDetailsElement) || !detail.open || isEditing()) return;
  const group = detail.closest('.services');
  if (!group) return;
  group.querySelectorAll('details').forEach(other => {
    if (other !== detail) other.open = false;
  });
}, true);

const closeProjectBtn = document.getElementById('close-project');
if (closeProjectBtn) {
  closeProjectBtn.addEventListener('click', () => dialog.close());
}

if (dialog) {
  dialog.addEventListener('click', event => {
    if (event.target === dialog) {
      const r = dialog.getBoundingClientRect();
      if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) dialog.close();
    }
  });
  dialog.addEventListener('close', () => {
    document.body.classList.remove('dialog-open');
    returnFocus?.focus({preventScroll:true});
  });

  // Touch swipe left/right navigation inside lightbox dialog
  let swipeStartX = 0;
  let swipeStartY = 0;
  dialog.addEventListener('touchstart', (e) => {
    if (e.touches.length !== 1) return;
    swipeStartX = e.touches[0].clientX;
    swipeStartY = e.touches[0].clientY;
  }, { passive: true });
  dialog.addEventListener('touchend', (e) => {
    if (!e.changedTouches.length) return;
    const dx = e.changedTouches[0].clientX - swipeStartX;
    const dy = e.changedTouches[0].clientY - swipeStartY;
    if (Math.abs(dx) > 54 && Math.abs(dx) > Math.abs(dy) * 1.4) {
      stepProject(dx < 0 ? 1 : -1);
    }
  }, { passive: true });
}

const prevBtn = document.getElementById('previous-project');
if (prevBtn) prevBtn.addEventListener('click', () => stepProject(-1));
const nextBtn = document.getElementById('next-project');
if (nextBtn) nextBtn.addEventListener('click', () => stepProject(1));

const skipIntroBtn = document.getElementById('skip-intro');
if (skipIntroBtn) skipIntroBtn.addEventListener('click', skipIntro);
const replayIntroBtn = document.getElementById('replay-intro');
if (replayIntroBtn) replayIntroBtn.addEventListener('click', replayIntro);

document.querySelectorAll('.screw-assembly').forEach((button, index) => {
  button.addEventListener('keydown', event => {
    if (event.key === ' ' || event.key === 'Enter') {
      event.preventDefault();
      event.stopPropagation();
      toggleSingleScrew(index);
    }
  });
});

document.addEventListener('keydown', event => {
  const mobileDrawer = document.getElementById('mobile-nav-drawer');
  if (mobileDrawer && !mobileDrawer.hidden && event.key === 'Escape') {
    closeMobileNav(true);
    return;
  }
  if (dialog && dialog.open) {
    if (event.key === 'ArrowLeft') stepProject(-1);
    if (event.key === 'ArrowRight') stepProject(1);
    return;
  }
  if (!vaultIsOpen && !vaultUnlocking && event.key === 'Enter' && !event.target.closest('button,[role="button"],input,textarea,select,[contenteditable="true"]')) {
    triggerVaultSequence();
  }
  if (!vaultIsOpen && event.key === 'Escape') skipIntro();
});

function setCurrentYear() {
  const currentYearEl = document.getElementById('current-year');
  if (currentYearEl) currentYearEl.textContent = new Date().getFullYear();
}
setCurrentYear();

// Window hash routing listener
window.addEventListener('hashchange', handleHashRoute);

function syncPhotoStylePills() {
  const wrap = document.querySelector('.photo-style-pills');
  if (!wrap) return;
  const defaultLabels = {
    all: 'All Styles',
    'avant-garde': 'Sculptural & Avant-Garde',
    campaigns: 'Fashion & Campaigns',
    portraits: 'Portraits & Beauty',
    location: 'Location & Bridal'
  };
  wrap.innerHTML = Object.entries(PHOTO_STYLES).map(([key, cfg]) => {
    const label = cfg.label || defaultLabels[key] || key.replace(/-/g, ' ');
    const isCurrent = key === activePhotoStyle;
    const count = String((cfg.items || []).length).padStart(2, '0');
    return `
      <button type="button" class="photo-style-pill ${isCurrent ? 'active' : ''}" role="tab" aria-selected="${isCurrent ? 'true' : 'false'}" data-photo-style="${escapeHTML(key)}">
        <span>${escapeHTML(label)}</span>
        <span class="pill-count">${count}</span>
      </button>
    `;
  }).join('');
}

/* Public API used by the CMS (assets/cms/*) */
window.MeauxSite = {
  getPortfolio: () => ({items: archive.map(p => ({...p})), selected: curated.map(c => ({...c}))}),
  setPortfolio(portfolio) {
    if (!portfolio) return;
    if (Array.isArray(portfolio.items)) archive = portfolio.items.map(p => ({...p}));
    if (Array.isArray(portfolio.selected)) curated = portfolio.selected.map(c => ({...c}));
    renderPortfolio();
    renderPhotoBento(activePhotoStyle, false);
  },
  refresh() {
    setCurrentYear();
    renderPortfolio();
    syncPhotoStylePills();
    renderPhotoBento(activePhotoStyle, false);
    handleHashRoute();
    switchTab(activeTab, false);
  },
  getActiveTab: () => activeTab,
  getActiveProject: () => activeProject,
  getActivePhotoStyle: () => activePhotoStyle,
  getPhotoStyles: () => JSON.parse(JSON.stringify(PHOTO_STYLES)),
  setPhotoStyles(nextStyles) {
    if (!nextStyles || typeof nextStyles !== 'object') return;
    // Clear removed non-default keys
    for (const k of Object.keys(PHOTO_STYLES)) {
      if (!(k in nextStyles)) delete PHOTO_STYLES[k];
    }
    for (const [k, v] of Object.entries(nextStyles)) {
      if (v && Array.isArray(v.items)) {
        PHOTO_STYLES[k] = {
          label: v.label || (PHOTO_STYLES[k] && PHOTO_STYLES[k].label) || '',
          summary: v.summary !== undefined ? v.summary : ((PHOTO_STYLES[k] && PHOTO_STYLES[k].summary) || ''),
          items: v.items.map(i => ({ ...i }))
        };
      }
    }
    if (!PHOTO_STYLES[activePhotoStyle]) activePhotoStyle = Object.keys(PHOTO_STYLES)[0] || 'all';
    syncPhotoStylePills();
    renderPhotoBento(activePhotoStyle, false);
  },
  syncPhotoStylePills,
  renderPhotoBento,
  switchTab,
  skipIntro,
  replayIntro,
  openProject,
  isVaultOpen: () => vaultIsOpen
};

// Cursor liquid-chrome spotlight tracking on Bento tiles
document.addEventListener('pointermove', (event) => {
  if (reducedMotion.matches) return;
  const tile = event.target.closest('.bento-tile');
  if (!tile) return;
  const rect = tile.getBoundingClientRect();
  tile.style.setProperty('--mx', `${event.clientX - rect.left}px`);
  tile.style.setProperty('--my', `${event.clientY - rect.top}px`);
});

// Re-trigger staggered shutter reveal when opening the Photography tab
document.addEventListener('meaux:tab', (event) => {
  if (event.detail && event.detail.tab === 'photography') {
    renderPhotoBento(activePhotoStyle, true);
  }
});

// Keep mobile drawer synced whenever CMS modifies pages/navigation
document.addEventListener('meaux:nav-synced', syncMobileNav);

// Initialize components
syncMobileNav();
renderPortfolio();
renderPhotoBento(activePhotoStyle, true);
initScrewCanvases();
initFluidLandingCanvas();
handleHashRoute();

if (reducedMotion.matches) {
  const typewriter = document.getElementById('vault-typewriter');
  if (typewriter) typewriter.textContent = 'IMAGE. IDENTITY. SPACE.';
  screwPhysics.forEach(s => renderSingle3DScrew(s, 0));
  renderMercuryBlobCanvas('central-mercury-canvas', 0, 1, true);
  renderFluidLandingSurface(0);
} else {
  runTypewriter();
  requestAnimationFrame(masterAnimationLoop);
}
