/* =====================================================================
   MEAUX ATELIER OS — FUTURISTIC ADMIN CONTROLLER & VISUAL STUDIO (v2.0)
   ===================================================================== */
import {
  SURFACE_CATALOG,
  LUXURY_SWATCHES,
  getSurfaceDef,
  buildSurfacePreviewStyle,
  applyActiveSurface
} from './surfaces.js';
import {
  EDITABLE_TEXT_SELECTORS,
  EDITABLE_IMAGE_SELECTORS,
  loadGoogleFont
} from './runtime.js?v=2';
import {
  GOOGLE_FONTS,
  THEME_PRESETS,
  DEFAULT_MEDIA_CATEGORIES,
  CATEGORY_COLORS,
  BLOCK_CATALOG,
  BUILTIN_SECTIONS_BY_PAGE,
  REQUIRED_DB_TABLES,
  inferAssetMetadata
} from './admin-presets.js';

const LOCAL_DRAFT_KEY = 'meaux_content_draft';
const LOCAL_PUB_KEY = 'meaux_content_published';
const LOCAL_REV_KEY = 'meaux_local_revisions';
const LOCAL_ENQ_KEY = 'meaux_enquiries_local';

export async function initAdmin(runtime) {
  if (!document.querySelector('link[href*="assets/cms/admin.css"]')) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'assets/cms/admin.css?v=10';
    document.head.appendChild(link);
  }
  const admin = new AdminManager(runtime);
  await admin.mount();
  return admin;
}

class AdminManager {
  constructor(runtime) {
    this.runtime = runtime;
    this.supabase = runtime.supabase;
    this.user = runtime.user || { email: 'admin@meaux.atelier' };
    this.draft = JSON.parse(JSON.stringify(runtime.content || window.MEAUX_DEFAULT_CONTENT || {}));

    // UI State
    this.isEditMode = false;
    this.drawerOpen = false;
    this.drawerExpanded = false;
    this.assetDockOpen = false;
    this.activeDrawerTab = 'pages';
    this.viewportMode = 'desktop';
    this.dirtyCount = 0;

    // Undo / Redo History
    this.undoStack = [];
    this.redoStack = [];

    // Surface Controls
    this.surfaceScope = 'global';
    this.surfaceCategory = 'all';

    // Asset Gallery & Media Vault State
    this.mediaCategories = [];
    this.mediaList = [];
    this.dockSearch = '';
    this.dockCategory = 'all';
    this.dockTag = '';
    this.dockSource = 'all';
    this.dockSort = 'newest';
    this.dockView = 'grid';
    this.bulkMode = false;
    this.selectedAssetIds = new Set();

    // Portfolio, Enquiries, Revisions, Admins, DB Health
    this.portfolioSearch = '';
    this.portfolioFilter = 'all';
    this.enquiries = [];
    this.enquiryFilter = 'all';
    this.revisions = [];
    this.adminsList = [];
    this.dbHealth = {};
  }

  async mount() {
    // Restore local unpublished draft if present
    try {
      const localDraft = localStorage.getItem(LOCAL_DRAFT_KEY);
      if (localDraft) {
        const parsed = JSON.parse(localDraft);
        this.draft = this.runtime.mergeWithDefaults(
          JSON.parse(JSON.stringify(window.MEAUX_DEFAULT_CONTENT || {})),
          parsed
        );
        this.runtime.applyContent(this.draft);
      }
    } catch (e) {}

    this.ensureToastStack();

    // Hydrate categories, 61+ catalog media, enquiries & revisions INSTANTLY before cloud sync
    this.hydrateLocalData();

    this.buildAdminBar();
    this.buildDrawer();
    this.buildAssetDock();
    this.bindInlineEditing();
    this.bindBlockActions();
    this.bindBentoEditor();
    this.bindVaultDropzone();
    this.bindGlobalShortcuts();

    this.updateHudCounters();
    this.renderDrawerContent();
    this.renderAssetDock();

    // Sync cloud tables in background without blocking the futuristic UI
    Promise.allSettled([
      this.fetchCategories(),
      this.fetchAdmins(),
      this.fetchMedia(),
      this.fetchEnquiries(),
      this.fetchRevisions()
    ]).then(() => {
      this.updateHudCounters();
      this.renderDrawerContent();
      this.renderAssetDock();
    });
  }

  hydrateLocalData() {
    // 1. Categories
    if (Array.isArray(this.draft.mediaCategories) && this.draft.mediaCategories.length) {
      this.mediaCategories = this.draft.mediaCategories;
    } else {
      this.mediaCategories = JSON.parse(JSON.stringify(DEFAULT_MEDIA_CATEGORIES));
    }

    // 2. Catalog Media + Local Meta Overrides
    const catalog = Array.isArray(window.MEAUX_CATALOG_MEDIA) ? window.MEAUX_CATALOG_MEDIA : [];
    const localMeta = this.draft.mediaMeta || {};
    this.mediaList = catalog.map(c => {
      const inferred = inferAssetMetadata(c);
      const meta = localMeta[c.id] || {};
      return {
        id: c.id,
        shortcode: c.id.replace(/^media_/, ''),
        name: meta.title || c.title || c.filename,
        filename: c.filename,
        title: meta.title || c.title || c.filename,
        caption: meta.caption !== undefined ? meta.caption : (c.caption || ''),
        alt_text: meta.alt_text || '',
        category: meta.category || inferred.category,
        tags: Array.isArray(meta.tags) ? meta.tags : inferred.tags,
        focal_point: meta.focal_point || '50% 35%',
        permalink: meta.permalink !== undefined ? meta.permalink : (c.permalink || ''),
        credit: meta.credit || '',
        location: meta.location || '',
        featured: Boolean(meta.featured),
        url: c.url,
        isBlob: false,
        source: 'catalog'
      };
    });

    // 3. Local Enquiries & Revisions & Admins
    try { this.enquiries = JSON.parse(localStorage.getItem(LOCAL_ENQ_KEY) || '[]'); } catch (e) { this.enquiries = []; }
    try { this.revisions = JSON.parse(localStorage.getItem(LOCAL_REV_KEY) || '[]').map(r => ({ ...r, origin: 'local' })); } catch (e) { this.revisions = []; }
    this.adminsList = [{ email: this.runtime.config.initialAdmin || 'alexandru.n.bucur@gmail.com', role: 'owner' }];
  }

  /* ===================================================================
     TOASTS, CONFIRM MODAL & UNDO/REDO ENGINE
     =================================================================== */
  ensureToastStack() {
    if (!document.getElementById('cms-toast-stack')) {
      const stack = document.createElement('div');
      stack.id = 'cms-toast-stack';
      document.body.appendChild(stack);
    }
  }

  toast(message, type = 'info') {
    this.ensureToastStack();
    const stack = document.getElementById('cms-toast-stack');
    const el = document.createElement('div');
    el.className = `cms-toast ${type}`;
    const icon = type === 'success' ? '✦' : type === 'error' ? '⚠' : type === 'warn' ? '◈' : '❖';
    el.innerHTML = `<span style="color:var(--cms-cyan);font-size:13px;">${icon}</span><span style="flex:1;">${this.escape(message)}</span>`;
    stack.appendChild(el);
    setTimeout(() => {
      el.style.opacity = '0';
      el.style.transform = 'translateY(-6px)';
      el.style.transition = 'all 0.25s ease';
      setTimeout(() => el.remove(), 260);
    }, 3600);
  }

  confirmModal(title, message, confirmLabel = 'Confirm', danger = true) {
    return new Promise((resolve) => {
      const overlay = document.createElement('div');
      overlay.className = 'cms-modal-overlay';
      overlay.innerHTML = `
        <div class="cms-modal-card" style="max-width:420px;">
          <div class="cms-modal-header">
            <div>
              <span class="cms-eyebrow">ATELIER OS // CONFIRMATION</span>
              <h3 class="cms-modal-title" style="font-size:20px;">${this.escape(title)}</h3>
            </div>
            <button type="button" class="cms-modal-close" data-cancel>✕</button>
          </div>
          <p class="cms-modal-desc">${this.escape(message)}</p>
          <div class="cms-inline-row" style="justify-content:flex-end;">
            <button type="button" class="cms-btn-subtle" data-cancel>Cancel</button>
            <button type="button" class="${danger ? 'cms-btn-subtle cms-btn-danger' : 'cms-luxury-btn'}" style="width:auto;" data-ok>${this.escape(confirmLabel)}</button>
          </div>
        </div>
      `;
      document.body.appendChild(overlay);
      const cleanup = (val) => { overlay.remove(); resolve(val); };
      overlay.querySelectorAll('[data-cancel]').forEach(b => b.addEventListener('click', () => cleanup(false)));
      overlay.querySelector('[data-ok]').addEventListener('click', () => cleanup(true));
      overlay.addEventListener('click', (e) => { if (e.target === overlay) cleanup(false); });
    });
  }

  pushUndoSnapshot() {
    try {
      const snap = JSON.stringify(this.draft);
      if (this.undoStack[this.undoStack.length - 1] === snap) return;
      this.undoStack.push(snap);
      if (this.undoStack.length > 35) this.undoStack.shift();
      this.redoStack = [];
      this.updateHudCounters();
    } catch (e) {}
  }

  undo() {
    if (!this.undoStack.length) {
      this.toast('Nothing to undo', 'warn');
      return;
    }
    this.redoStack.push(JSON.stringify(this.draft));
    this.draft = JSON.parse(this.undoStack.pop());
    this.runtime.applyContent(this.draft);
    this.saveDraft();
    if (this.isEditMode) this.toggleEditMode(true);
    this.renderDrawerContent();
    this.updateHudCounters();
    this.toast('Reverted previous edit', 'info');
  }

  redo() {
    if (!this.redoStack.length) {
      this.toast('Nothing to redo', 'warn');
      return;
    }
    this.undoStack.push(JSON.stringify(this.draft));
    this.draft = JSON.parse(this.redoStack.pop());
    this.runtime.applyContent(this.draft);
    this.saveDraft();
    if (this.isEditMode) this.toggleEditMode(true);
    this.renderDrawerContent();
    this.updateHudCounters();
    this.toast('Redid edit', 'info');
  }

  bindGlobalShortcuts() {
    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        this.openCommandPalette();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        this.publish();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.target.closest('input,textarea,[contenteditable="true"]')) {
        e.preventDefault();
        if (e.shiftKey) this.redo();
        else this.undo();
      }
    });
  }

  /* ===================================================================
     1. ORBITAL COMMAND HUD (FLOATING BOTTOM CONSOLE)
     =================================================================== */
  buildAdminBar() {
    let bar = document.getElementById('cms-admin-bar');
    if (bar) bar.remove();

    const modeLabel = this.supabase && !this.user.isMock ? 'CLOUD' : 'LOCAL';
    bar = document.createElement('div');
    bar.id = 'cms-admin-bar';
    bar.innerHTML = `
      <div class="cms-admin-badge" title="Signed in as ${this.escape(this.user.email || 'Admin')}">
        <span class="cms-status-indicator" id="cms-bar-indicator"></span>
        <span>ATELIER OS · ${modeLabel}</span>
      </div>

      <button type="button" class="cms-bar-btn" id="cms-toggle-edit-btn" title="Inline edit any text, image, or block">
        <span id="cms-edit-btn-label">Edit: OFF</span>
      </button>

      <button type="button" class="cms-bar-btn" id="cms-toggle-assets-btn" title="Open Asset Vault Dock (Categories, Tags, Drag & Drop)">
        <span>Assets ⊞</span>
        <span class="cms-bar-pill-count" id="cms-hud-asset-count">0</span>
      </button>

      <button type="button" class="cms-bar-btn" id="cms-open-surfaces-btn" title="Material & Background Surfaces">
        <span>Surfaces ◈</span>
      </button>

      <div class="cms-bar-group" title="Responsive Viewport Preview">
        <button type="button" class="cms-bar-btn icon-only active" data-viewport="desktop" title="Desktop View">🖥</button>
        <button type="button" class="cms-bar-btn icon-only" data-viewport="tablet" title="Tablet Preview (780px)">▭</button>
        <button type="button" class="cms-bar-btn icon-only" data-viewport="mobile" title="Mobile Preview (402px)">▯</button>
      </div>

      <div class="cms-bar-group">
        <button type="button" class="cms-bar-btn icon-only" id="cms-undo-btn" title="Undo (Ctrl+Z)" disabled>↶</button>
        <button type="button" class="cms-bar-btn icon-only" id="cms-redo-btn" title="Redo (Ctrl+Shift+Z)" disabled>↷</button>
      </div>

      <button type="button" class="cms-bar-btn" id="cms-cmd-palette-btn" title="Command Palette (Ctrl+K)">
        <span>⌘K</span>
      </button>

      <button type="button" class="cms-bar-btn" id="cms-open-drawer-btn" title="Open Studio OS Panel">
        <span>Studio ☰</span>
      </button>

      <button type="button" class="cms-bar-btn primary" id="cms-publish-btn" title="Publish Live (Ctrl+S)">
        <span>Publish</span>
        <span class="cms-bar-pill-count" id="cms-hud-dirty-count" style="display:none;">0</span>
      </button>

      <button type="button" class="cms-bar-btn icon-only" id="cms-signout-btn" title="Sign out">✕</button>
    `;
    document.body.appendChild(bar);

    document.getElementById('cms-toggle-edit-btn').addEventListener('click', () => this.toggleEditMode());
    document.getElementById('cms-toggle-assets-btn').addEventListener('click', () => this.toggleAssetDock());
    document.getElementById('cms-open-surfaces-btn').addEventListener('click', () => {
      if (window.MeauxSite && !window.MeauxSite.isVaultOpen()) {
        this.surfaceScope = 'vault';
      }
      this.openDrawerTab('backgrounds');
    });
    document.getElementById('cms-open-drawer-btn').addEventListener('click', () => this.toggleSidebar());
    document.getElementById('cms-cmd-palette-btn').addEventListener('click', () => this.openCommandPalette());
    document.getElementById('cms-undo-btn').addEventListener('click', () => this.undo());
    document.getElementById('cms-redo-btn').addEventListener('click', () => this.redo());
    document.getElementById('cms-publish-btn').addEventListener('click', () => this.publish());

    bar.querySelectorAll('[data-viewport]').forEach(btn => {
      btn.addEventListener('click', () => this.setViewport(btn.dataset.viewport));
    });

    document.getElementById('cms-signout-btn').addEventListener('click', async () => {
      const ok = await this.confirmModal('Sign Out of Atelier OS?', 'Any unpublished local drafts remain cached in your browser.', 'Sign Out');
      if (!ok) return;
      if (this.supabase) await this.supabase.auth.signOut().catch(() => {});
      localStorage.removeItem('meaux_mock_admin_session');
      sessionStorage.removeItem('meaux_mock_admin_session');
      window.location.reload();
    });
  }

  setViewport(mode) {
    this.viewportMode = mode;
    document.body.classList.remove('cms-viewport-tablet', 'cms-viewport-mobile');
    if (mode === 'tablet') document.body.classList.add('cms-viewport-tablet');
    if (mode === 'mobile') document.body.classList.add('cms-viewport-mobile');
    document.querySelectorAll('#cms-admin-bar [data-viewport]').forEach(b => {
      b.classList.toggle('active', b.dataset.viewport === mode);
    });
    this.toast(`Viewport preview: ${mode.toUpperCase()}`, 'info');
  }

  updateHudCounters() {
    const assetEl = document.getElementById('cms-hud-asset-count');
    if (assetEl) assetEl.textContent = String(this.mediaList.length);
    const dirtyEl = document.getElementById('cms-hud-dirty-count');
    if (dirtyEl) {
      dirtyEl.style.display = this.dirtyCount > 0 ? 'inline-flex' : 'none';
      dirtyEl.textContent = String(this.dirtyCount);
    }
    const undoBtn = document.getElementById('cms-undo-btn');
    const redoBtn = document.getElementById('cms-redo-btn');
    if (undoBtn) undoBtn.disabled = this.undoStack.length === 0;
    if (redoBtn) redoBtn.disabled = this.redoStack.length === 0;

    // Update new enquiries badge on rail
    const newCount = this.enquiries.filter(e => e.status === 'new').length;
    const badge = document.getElementById('cms-enquiries-badge');
    if (badge) {
      badge.style.display = newCount > 0 ? 'grid' : 'none';
      badge.textContent = String(newCount);
    }
  }

  openDrawerTab(tabName) {
    this.activeDrawerTab = tabName;
    const drawer = document.getElementById('cms-admin-drawer');
    if (drawer) {
      drawer.querySelectorAll('.cms-drawer-tab').forEach(b => {
        b.classList.toggle('active', b.dataset.tab === tabName);
      });
    }
    this.toggleSidebar(true);
    this.renderDrawerContent();
  }

  /* ===================================================================
     COMMAND PALETTE (CTRL+K / ⌘K)
     =================================================================== */
  openCommandPalette() {
    const existing = document.getElementById('cms-command-palette');
    if (existing) { existing.remove(); return; }

    const commands = [
      { label: this.isEditMode ? 'Turn Edit Mode OFF' : 'Turn Edit Mode ON', group: 'Action', run: () => this.toggleEditMode() },
      { label: 'Publish Changes Live', group: 'Action', run: () => this.publish() },
      { label: 'Open Asset Vault Dock', group: 'Action', run: () => this.toggleAssetDock(true) },
      { label: 'Open Full-Screen Media Vault', group: 'Media', run: () => this.openFullVaultModal() },
      { label: 'Undo Last Edit', group: 'Action', run: () => this.undo() },
      { label: 'Preview Mobile Viewport', group: 'Viewport', run: () => this.setViewport('mobile') },
      { label: 'Preview Tablet Viewport', group: 'Viewport', run: () => this.setViewport('tablet') },
      { label: 'Preview Desktop Viewport', group: 'Viewport', run: () => this.setViewport('desktop') },
      { label: 'Studio → Pages & Navigation', group: 'Studio', run: () => this.openDrawerTab('pages') },
      { label: 'Studio → Add Section Block', group: 'Studio', run: () => this.openDrawerTab('blocks') },
      { label: 'Studio → Site Styles, Fonts & Vault', group: 'Studio', run: () => this.openDrawerTab('styles') },
      { label: 'Studio → Background Surfaces', group: 'Studio', run: () => this.openDrawerTab('backgrounds') },
      { label: 'Studio → Portfolio & Bento Styles', group: 'Studio', run: () => this.openDrawerTab('portfolio') },
      { label: 'Studio → Media Vault & Categories', group: 'Studio', run: () => this.openDrawerTab('media') },
      { label: 'Studio → Client Enquiries Inbox', group: 'Studio', run: () => this.openDrawerTab('enquiries') },
      { label: 'Studio → Revisions & Backups', group: 'Studio', run: () => this.openDrawerTab('history') },
      { label: 'Studio → Database Health & Settings', group: 'Studio', run: () => this.openDrawerTab('settings') },
      ...(this.draft.pages || []).map(p => ({
        label: `Go to Page: ${p.navLabel || p.title}`,
        group: 'Page',
        run: () => window.MeauxSite && window.MeauxSite.switchTab(p.id, true)
      }))
    ];

    const overlay = document.createElement('div');
    overlay.id = 'cms-command-palette';
    overlay.className = 'cms-modal-overlay';
    overlay.innerHTML = `
      <div class="cms-modal-card">
        <div class="cms-cmd-search-wrap">
          <span style="color:var(--cms-cyan);font-size:15px;">⌘</span>
          <input type="search" id="cms-cmd-input" placeholder="Jump to any page, studio tool, or action..." autofocus>
          <span class="cms-badge">ESC</span>
        </div>
        <div class="cms-cmd-list" id="cms-cmd-list"></div>
      </div>
    `;
    document.body.appendChild(overlay);

    const listEl = overlay.querySelector('#cms-cmd-list');
    const input = overlay.querySelector('#cms-cmd-input');

    const renderList = (q = '') => {
      const lower = q.toLowerCase();
      const hits = commands.filter(c => !lower || c.label.toLowerCase().includes(lower) || c.group.toLowerCase().includes(lower));
      listEl.innerHTML = hits.map((c, idx) => `
        <button type="button" class="cms-cmd-item ${idx === 0 ? 'active' : ''}" data-cmd-idx="${idx}">
          <span>${this.escape(c.label)}</span>
          <small>${this.escape(c.group)}</small>
        </button>
      `).join('') || '<p class="cms-muted-note" style="padding:16px;">No matching commands.</p>';

      listEl.querySelectorAll('.cms-cmd-item').forEach((btn, idx) => {
        btn.addEventListener('click', () => {
          overlay.remove();
          hits[idx].run();
        });
      });
    };

    renderList();
    input.focus();
    input.addEventListener('input', (e) => renderList(e.target.value.trim()));
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') overlay.remove();
      if (e.key === 'Enter') {
        const first = listEl.querySelector('.cms-cmd-item');
        if (first) first.click();
      }
    });
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
  }

  /* ===================================================================
     2. INLINE EDIT MODE & UNIVERSAL IMAGE SWAPPING
     =================================================================== */
  toggleEditMode(forceState = null) {
    this.isEditMode = forceState !== null ? forceState : !this.isEditMode;
    document.body.classList.toggle('cms-editing', this.isEditMode);

    const btn = document.getElementById('cms-toggle-edit-btn');
    const label = document.getElementById('cms-edit-btn-label');
    if (btn && label) {
      btn.classList.toggle('active', this.isEditMode);
      label.textContent = this.isEditMode ? 'Edit: ON' : 'Edit: OFF';
    }

    if (this.runtime && this.runtime.assignContentAndImageKeys) {
      this.runtime.assignContentAndImageKeys();
    }

    document.querySelectorAll(EDITABLE_TEXT_SELECTORS.join(', ')).forEach((el) => {
      if (el.closest('#cms-admin-bar, #cms-admin-drawer, #cms-asset-dock, .cms-modal-overlay, .cms-block-actions, .cms-bento-controls, dialog')) return;
      if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'BUTTON' || el.closest('button.tab-btn, .cms-block-actions, .cms-bento-controls')) return;
      if (!el.getAttribute('data-cms-key') && !el.getAttribute('data-cms')) return;

      if (this.isEditMode) {
        el.setAttribute('contenteditable', 'true');
        el.classList.add('cms-editable-text');
      } else {
        el.removeAttribute('contenteditable');
        el.classList.remove('cms-editable-text');
      }
    });

    this.bindImageEditing();
    this.updateAddBlockZones();
    this.refreshBentoEditUI();
  }

  bindImageEditing() {
    const elements = document.querySelectorAll(EDITABLE_IMAGE_SELECTORS.join(', '));
    elements.forEach(img => {
      if (img.closest('#cms-admin-bar, #cms-admin-drawer, #cms-asset-dock, .cms-modal-overlay, dialog')) return;
      const container =
        img.closest('.bento-tile') ||
        img.closest('.image-link') ||
        img.closest('.work-image') ||
        img.closest('.gallery-item') ||
        img.closest('.narrative-image-wrap') ||
        img.closest('.about-portrait-wrap') ||
        img.closest('.ig-tile') ||
        img.closest('.ig-highlight-ring') ||
        img.closest('.ig-avatar-ring') ||
        img.closest('.session-step-media') ||
        img.closest('.image-interlude') ||
        img.parentElement || img;

      if (this.isEditMode) {
        container.classList.add('cms-image-editable');
        if (!container.__cmsClickHandler) {
          container.__cmsClickHandler = (e) => {
            if (!this.isEditMode) return;
            if (e.target.closest('.cms-bento-controls, .cms-block-actions, [contenteditable="true"]')) return;
            e.preventDefault();
            e.stopPropagation();
            if (container.classList.contains('bento-tile')) {
              this.openBentoTileEditor(Number(container.dataset.bentoIndex));
            } else {
              this.openImagePickerModal(img);
            }
          };
          container.addEventListener('click', container.__cmsClickHandler, true);
        }
      } else {
        container.classList.remove('cms-image-editable');
        if (container.__cmsClickHandler) {
          container.removeEventListener('click', container.__cmsClickHandler, true);
          delete container.__cmsClickHandler;
        }
      }
    });
  }

  bindBlockActions() {
    document.addEventListener('click', async (e) => {
      const btn = e.target.closest('[data-block-action]');
      if (!btn) return;
      e.preventDefault();
      e.stopPropagation();
      const { blockAction, pageId, blockId } = btn.dataset;
      if (blockAction === 'up') this.moveSectionBlock(pageId, blockId, -1);
      else if (blockAction === 'down') this.moveSectionBlock(pageId, blockId, 1);
      else if (blockAction === 'duplicate') this.duplicateSectionBlock(pageId, blockId);
      else if (blockAction === 'edit') this.openBlockEditorModal(pageId, blockId);
      else if (blockAction === 'delete') await this.deleteSectionBlock(pageId, blockId);
    });
  }

  /* ===================================================================
     3. OVERLAP-PROOF ASSET GALLERY DOCK, CATEGORIES, TAGS & INSPECTOR
     =================================================================== */
  getCategoryColor(catName) {
    const found = this.mediaCategories.find(c => c.name.toLowerCase() === String(catName || '').toLowerCase() || c.slug === String(catName || '').toLowerCase());
    return found ? found.color : '#94a3b8';
  }

  getAllUniqueTags() {
    const counts = new Map();
    this.mediaList.forEach(m => {
      (m.tags || []).forEach(t => {
        const clean = String(t || '').trim().toLowerCase();
        if (clean) counts.set(clean, (counts.get(clean) || 0) + 1);
      });
    });
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  }

  getFilteredAssets(overrides = {}) {
    const q = (overrides.search !== undefined ? overrides.search : this.dockSearch).toLowerCase().trim();
    const cat = overrides.category !== undefined ? overrides.category : this.dockCategory;
    const tag = (overrides.tag !== undefined ? overrides.tag : this.dockTag).toLowerCase().trim();
    const source = overrides.source !== undefined ? overrides.source : this.dockSource;
    const sort = overrides.sort !== undefined ? overrides.sort : this.dockSort;

    let list = this.mediaList.filter(m => {
      if (cat && cat !== 'all' && (m.category || 'Uncategorized').toLowerCase() !== cat.toLowerCase()) return false;
      if (tag && !(m.tags || []).some(t => t.toLowerCase() === tag)) return false;
      if (source === 'starred' && !m.featured) return false;
      if (source === 'upload' && !['blob', 'storage', 'upload'].includes(m.source)) return false;
      if (source === 'catalog' && m.source !== 'catalog') return false;
      if (source === 'link' && m.source !== 'link') return false;
      if (q) {
        const hay = `${m.title || ''} ${m.filename || ''} ${m.caption || ''} ${m.alt_text || ''} ${m.category || ''} ${(m.tags || []).join(' ')}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    if (sort === 'az') list = list.slice().sort((a, b) => (a.title || '').localeCompare(b.title || ''));
    else if (sort === 'category') list = list.slice().sort((a, b) => (a.category || '').localeCompare(b.category || ''));
    else if (sort === 'oldest') list = list.slice().reverse();

    return list;
  }

  renderAssetCardHtml(asset, { showSelect = false, mode = 'dock' } = {}) {
    const cat = asset.category || 'Uncategorized';
    const catColor = this.getCategoryColor(cat);
    const tags = Array.isArray(asset.tags) ? asset.tags : [];
    const selected = this.selectedAssetIds.has(asset.id);
    const focal = asset.focal_point || '50% 35%';
    const canDelete = ['upload', 'blob', 'storage', 'link'].includes(asset.source);

    return `
      <article class="cms-asset-card ${selected ? 'is-selected' : ''}"
        draggable="${showSelect ? 'false' : 'true'}"
        data-asset-id="${this.escape(asset.id)}"
        data-asset-url="${this.escape(asset.url)}"
        data-asset-title="${this.escape(asset.title || asset.filename || 'Asset')}">
        <div class="cms-asset-thumb-box">
          <img src="${this.escape(asset.url)}" alt="${this.escape(asset.alt_text || asset.title || '')}" style="object-position:${this.escape(focal)};" loading="lazy">
          <div class="cms-asset-top-badges">
            ${showSelect
              ? `<input type="checkbox" class="cms-asset-select-check" data-select-asset="${this.escape(asset.id)}" ${selected ? 'checked' : ''}>`
              : `<span class="cms-asset-source-pill">${this.escape(asset.source || 'catalog')}</span>`
            }
            <div class="cms-asset-quick-actions">
              <button type="button" class="cms-asset-mini-btn ${asset.featured ? 'starred' : ''}" data-asset-star="${this.escape(asset.id)}" title="Star / Favorite">${asset.featured ? '★' : '☆'}</button>
              <button type="button" class="cms-asset-mini-btn" data-asset-inspect="${this.escape(asset.id)}" title="Edit Category, Tags, Alt Text & Focal Point">✎</button>
              ${mode !== 'picker' ? `<button type="button" class="cms-asset-mini-btn" data-asset-bento="${this.escape(asset.id)}" title="Add to Photography Bento">+</button>` : ''}
              ${mode === 'vault' && canDelete ? `<button type="button" class="cms-asset-mini-btn danger" data-asset-delete="${this.escape(asset.id)}" title="Delete Asset">✕</button>` : ''}
            </div>
          </div>
        </div>
        <div class="cms-asset-card-body">
          <p class="cms-asset-title" title="${this.escape(asset.title || asset.filename)}">${this.escape(asset.title || asset.filename || 'Untitled')}</p>
          <div class="cms-asset-cat-row">
            <span class="cms-asset-cat-pill">
              <span class="cms-cat-dot" style="background:${this.escape(catColor)};"></span>
              <span>${this.escape(cat)}</span>
            </span>
          </div>
          <div class="cms-asset-tags-row">
            ${tags.slice(0, 3).map(t => `<span class="cms-tag-chip">#${this.escape(t)}</span>`).join('')}
            ${tags.length > 3 ? `<span class="cms-tag-chip">+${tags.length - 3}</span>` : ''}
            ${tags.length === 0 ? `<span style="font-size:8.5px;color:var(--cms-dim);">No tags · click ✎</span>` : ''}
          </div>
        </div>
      </article>
    `;
  }

  bindAssetCardEvents(container, { onPick = null } = {}) {
    container.querySelectorAll('.cms-asset-card').forEach(card => {
      const id = card.dataset.assetId;
      const asset = this.mediaList.find(m => m.id === id);
      if (!asset) return;

      card.addEventListener('dragstart', (e) => {
        if (this.bulkMode) { e.preventDefault(); return; }
        card.classList.add('is-dragging');
        const payload = JSON.stringify({
          source: 'asset-dock',
          id: asset.shortcode || asset.id,
          url: asset.url,
          title: asset.title || asset.filename,
          tag: asset.category || 'Photography',
          pos: asset.focal_point || '50% 35%'
        });
        e.dataTransfer.setData('application/x-meaux-asset', payload);
        e.dataTransfer.setData('text/plain', payload);
        e.dataTransfer.effectAllowed = 'copy';
      });

      card.addEventListener('dragend', () => card.classList.remove('is-dragging'));

      if (onPick) {
        card.addEventListener('click', (e) => {
          if (e.target.closest('button, input')) return;
          onPick(asset);
        });
      } else if (this.bulkMode) {
        card.addEventListener('click', (e) => {
          if (e.target.closest('button, input')) return;
          this.toggleAssetSelection(id);
        });
      }
    });

    container.querySelectorAll('[data-select-asset]').forEach(cb => {
      cb.addEventListener('change', (e) => {
        e.stopPropagation();
        this.toggleAssetSelection(cb.dataset.selectAsset, cb.checked);
      });
    });

    container.querySelectorAll('[data-asset-star]').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const asset = this.mediaList.find(m => m.id === btn.dataset.assetStar);
        if (!asset) return;
        await this.updateAssetMetadata(asset.id, { featured: !asset.featured });
      });
    });

    container.querySelectorAll('[data-asset-inspect]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.openAssetInspector(btn.dataset.assetInspect);
      });
    });

    container.querySelectorAll('[data-asset-bento]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const asset = this.mediaList.find(m => m.id === btn.dataset.assetBento);
        if (!asset) return;
        if (window.MeauxSite && window.MeauxSite.getActiveTab() !== 'photography') {
          window.MeauxSite.switchTab('photography', true);
        }
        this.appendAssetToBento({
          id: asset.shortcode || asset.id,
          title: asset.title || asset.filename,
          subtitle: asset.caption ? asset.caption.split('\n')[0].slice(0, 40) : 'Atelier Shoot',
          tag: asset.category || 'Photography',
          pos: asset.focal_point || '50% 35%',
          image_url: asset.url
        });
        this.toast(`Added "${asset.title}" to Photography Bento`, 'success');
      });
    });

    container.querySelectorAll('[data-asset-delete]').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        await this.deleteMedia(btn.dataset.assetDelete);
      });
    });
  }

  toggleAssetSelection(id, force = null) {
    const next = force !== null ? force : !this.selectedAssetIds.has(id);
    if (next) this.selectedAssetIds.add(id);
    else this.selectedAssetIds.delete(id);
    this.renderAssetDock();
    if (this.activeDrawerTab === 'media') this.renderDrawerContent();
  }

  buildAssetDock() {
    let dock = document.getElementById('cms-asset-dock');
    if (dock) dock.remove();

    dock = document.createElement('aside');
    dock.id = 'cms-asset-dock';
    dock.setAttribute('aria-label', 'Atelier Asset Vault Dock');
    document.body.appendChild(dock);

    // Drag & drop files directly onto the dock to upload
    dock.addEventListener('dragover', (e) => {
      if (e.dataTransfer.types && e.dataTransfer.types.includes('Files')) {
        e.preventDefault();
        dock.style.borderRightColor = 'var(--cms-cyan)';
      }
    });
    dock.addEventListener('dragleave', () => { dock.style.borderRightColor = ''; });
    dock.addEventListener('drop', async (e) => {
      dock.style.borderRightColor = '';
      if (e.dataTransfer.files && e.dataTransfer.files.length) {
        e.preventDefault();
        await this.handleBatchFileUpload(e.dataTransfer.files, {
          category: this.dockCategory !== 'all' ? this.dockCategory : 'Photography',
          tags: this.dockTag ? [this.dockTag] : []
        });
      }
    });

    this.renderAssetDock();
  }

  renderAssetDock() {
    const dock = document.getElementById('cms-asset-dock');
    if (!dock) return;

    const filtered = this.getFilteredAssets();
    const allTags = this.getAllUniqueTags().slice(0, 18);

    dock.innerHTML = `
      <div class="cms-dock-header">
        <div>
          <span class="cms-eyebrow">MEDIA VAULT · ${filtered.length}/${this.mediaList.length}</span>
          <h4>Asset Gallery</h4>
        </div>
        <div class="cms-header-actions">
          <button type="button" class="cms-icon-btn ${this.bulkMode ? 'active' : ''}" id="cms-dock-bulk-btn" title="Bulk Categorize & Tag">☑</button>
          <button type="button" class="cms-icon-btn" id="cms-dock-view-btn" title="Switch Grid / List View">${this.dockView === 'grid' ? '☰' : '⊞'}</button>
          <button type="button" class="cms-icon-btn" id="cms-dock-expand-btn" title="Expand Full-Screen Asset Vault">⤢</button>
          <button type="button" class="cms-icon-btn" id="cms-dock-close-btn" title="Close">✕</button>
        </div>
      </div>

      <div class="cms-dock-controls">
        <div class="cms-dock-toolbar">
          <input type="search" id="cms-dock-search" class="cms-input" placeholder="Search title, category, #tag..." value="${this.escape(this.dockSearch)}">
          <label class="cms-dock-upload-btn" title="Upload one or multiple images">
            <span>+ Upload</span>
            <input type="file" id="cms-dock-file-input" accept="image/*" multiple hidden>
          </label>
        </div>

        <!-- Category Filter Strip -->
        <div class="cms-filter-strip" id="cms-dock-cats">
          <button type="button" class="cms-filter-chip ${this.dockCategory === 'all' ? 'active' : ''}" data-dock-cat="all">All (${this.mediaList.length})</button>
          ${this.mediaCategories.map(c => {
            const count = this.mediaList.filter(m => (m.category || 'Uncategorized').toLowerCase() === c.name.toLowerCase()).length;
            return `
              <button type="button" class="cms-filter-chip ${this.dockCategory.toLowerCase() === c.name.toLowerCase() ? 'active' : ''}" data-dock-cat="${this.escape(c.name)}">
                <span class="cms-cat-dot" style="background:${this.escape(c.color)};"></span>
                <span>${this.escape(c.name)} (${count})</span>
              </button>
            `;
          }).join('')}
          <button type="button" class="cms-filter-chip" id="cms-dock-new-cat-btn" style="border-style:dashed;color:var(--cms-cyan);">+ Category</button>
        </div>

        <!-- Tags Filter Strip -->
        ${allTags.length ? `
          <div class="cms-filter-strip" id="cms-dock-tags">
            <button type="button" class="cms-filter-chip ${!this.dockTag ? 'active' : ''}" data-dock-tag="">All Tags</button>
            ${allTags.map(([t, count]) => `
              <button type="button" class="cms-filter-chip ${this.dockTag === t ? 'active' : ''}" data-dock-tag="${this.escape(t)}">#${this.escape(t)} (${count})</button>
            `).join('')}
          </div>
        ` : ''}

        <!-- Source & Sort Row -->
        <div class="cms-inline-row" style="justify-content:space-between;">
          <div class="cms-inline-row" style="gap:4px;">
            ${[
              ['all', 'All'],
              ['starred', '★'],
              ['upload', 'Uploads'],
              ['catalog', 'Catalog']
            ].map(([id, lbl]) => `
              <button type="button" class="cms-filter-chip ${this.dockSource === id ? 'active' : ''}" data-dock-src="${id}">${lbl}</button>
            `).join('')}
          </div>
          <select id="cms-dock-sort" class="cms-select" style="width:auto;padding:4px 8px;font-size:9.5px;">
            <option value="newest" ${this.dockSort === 'newest' ? 'selected' : ''}>Newest</option>
            <option value="az" ${this.dockSort === 'az' ? 'selected' : ''}>A → Z</option>
            <option value="category" ${this.dockSort === 'category' ? 'selected' : ''}>Category</option>
            <option value="oldest" ${this.dockSort === 'oldest' ? 'selected' : ''}>Oldest</option>
          </select>
        </div>
      </div>

      ${this.bulkMode ? `
        <div class="cms-bulk-bar">
          <strong>${this.selectedAssetIds.size} selected</strong>
          <div class="cms-inline-row" style="gap:5px;flex-wrap:wrap;">
            <select id="cms-bulk-cat-select" class="cms-select" style="width:auto;padding:4px 6px;font-size:10px;">
              <option value="">Set Category...</option>
              ${this.mediaCategories.map(c => `<option value="${this.escape(c.name)}">${this.escape(c.name)}</option>`).join('')}
            </select>
            <input type="text" id="cms-bulk-tag-input" class="cms-input" placeholder="+ Add #tag" style="width:92px;padding:4px 6px;font-size:10px;">
            <button type="button" class="cms-btn-subtle" id="cms-bulk-apply-btn">Apply</button>
            <button type="button" class="cms-btn-subtle" id="cms-bulk-clear-btn">Done</button>
          </div>
        </div>
      ` : ''}

      <div class="cms-dock-grid ${this.dockView === 'list' ? 'view-list' : ''}" id="cms-dock-grid">
        ${filtered.length
          ? filtered.map(a => this.renderAssetCardHtml(a, { showSelect: this.bulkMode, mode: 'dock' })).join('')
          : `<div style="grid-column:1/-1;text-align:center;padding:40px 16px;color:var(--cms-muted);font-size:11px;">No assets match this filter.<br><button type="button" class="cms-btn-subtle" id="cms-dock-reset-filters" style="margin-top:12px;">Reset Filters</button></div>`
        }
      </div>
    `;

    // Bind dock controls
    dock.querySelector('#cms-dock-close-btn').addEventListener('click', () => this.toggleAssetDock(false));
    dock.querySelector('#cms-dock-view-btn').addEventListener('click', () => {
      this.dockView = this.dockView === 'grid' ? 'list' : 'grid';
      this.renderAssetDock();
    });
    dock.querySelector('#cms-dock-expand-btn').addEventListener('click', () => this.openFullVaultModal());
    dock.querySelector('#cms-dock-bulk-btn').addEventListener('click', () => {
      this.bulkMode = !this.bulkMode;
      if (!this.bulkMode) this.selectedAssetIds.clear();
      this.renderAssetDock();
    });

    const searchInput = dock.querySelector('#cms-dock-search');
    searchInput.addEventListener('input', (e) => {
      this.dockSearch = e.target.value;
      const caret = e.target.selectionStart;
      this.renderAssetDock();
      const nextInput = document.getElementById('cms-dock-search');
      if (nextInput) { nextInput.focus(); nextInput.setSelectionRange(caret, caret); }
    });

    dock.querySelector('#cms-dock-file-input').addEventListener('change', async (e) => {
      if (e.target.files && e.target.files.length) {
        await this.handleBatchFileUpload(e.target.files, {
          category: this.dockCategory !== 'all' ? this.dockCategory : 'Photography',
          tags: this.dockTag ? [this.dockTag] : []
        });
        e.target.value = '';
      }
    });

    dock.querySelectorAll('[data-dock-cat]').forEach(btn => {
      btn.addEventListener('click', () => {
        this.dockCategory = btn.dataset.dockCat;
        this.renderAssetDock();
      });
    });

    dock.querySelector('#cms-dock-new-cat-btn').addEventListener('click', () => this.openNewCategoryModal());

    dock.querySelectorAll('[data-dock-tag]').forEach(btn => {
      btn.addEventListener('click', () => {
        this.dockTag = btn.dataset.dockTag;
        this.renderAssetDock();
      });
    });

    dock.querySelectorAll('[data-dock-src]').forEach(btn => {
      btn.addEventListener('click', () => {
        this.dockSource = btn.dataset.dockSrc;
        this.renderAssetDock();
      });
    });

    dock.querySelector('#cms-dock-sort').addEventListener('change', (e) => {
      this.dockSort = e.target.value;
      this.renderAssetDock();
    });

    const resetBtn = dock.querySelector('#cms-dock-reset-filters');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        this.dockSearch = '';
        this.dockCategory = 'all';
        this.dockTag = '';
        this.dockSource = 'all';
        this.renderAssetDock();
      });
    }

    if (this.bulkMode) {
      dock.querySelector('#cms-bulk-clear-btn').addEventListener('click', () => {
        this.bulkMode = false;
        this.selectedAssetIds.clear();
        this.renderAssetDock();
      });
      dock.querySelector('#cms-bulk-apply-btn').addEventListener('click', async () => {
        const newCat = dock.querySelector('#cms-bulk-cat-select').value;
        const newTag = dock.querySelector('#cms-bulk-tag-input').value.trim().toLowerCase().replace(/^#/, '');
        if (!this.selectedAssetIds.size) return this.toast('Select at least one photo first', 'warn');
        if (!newCat && !newTag) return this.toast('Choose a category or enter a tag to apply', 'warn');
        for (const id of this.selectedAssetIds) {
          const item = this.mediaList.find(m => m.id === id);
          if (!item) continue;
          const patch = {};
          if (newCat) patch.category = newCat;
          if (newTag) {
            const tags = new Set([...(item.tags || []), newTag]);
            patch.tags = Array.from(tags);
          }
          await this.updateAssetMetadata(id, patch, true);
        }
        this.toast(`Updated ${this.selectedAssetIds.size} assets`, 'success');
        this.renderAssetDock();
        if (this.activeDrawerTab === 'media') this.renderDrawerContent();
      });
    }

    this.bindAssetCardEvents(dock.querySelector('#cms-dock-grid'));
  }

  toggleAssetDock(forceState = null) {
    this.assetDockOpen = forceState !== null ? forceState : !this.assetDockOpen;
    const dock = document.getElementById('cms-asset-dock');
    if (dock) dock.classList.toggle('open', this.assetDockOpen);
    document.body.classList.toggle('cms-asset-dock-open', this.assetDockOpen);

    const btn = document.getElementById('cms-toggle-assets-btn');
    if (btn) btn.classList.toggle('active', this.assetDockOpen);

    if (this.assetDockOpen && !this.isEditMode) {
      this.toggleEditMode(true);
    }
    this.renderAssetDock();
    this.refreshBentoEditUI();
  }

  /* Full-Screen Asset Vault Modal (Squarespace Asset Library Experience) */
  openFullVaultModal() {
    const existing = document.getElementById('cms-full-vault-modal');
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.id = 'cms-full-vault-modal';
    modal.className = 'cms-modal-overlay';
    document.body.appendChild(modal);

    const renderVault = () => {
      const filtered = this.getFilteredAssets();
      const allTags = this.getAllUniqueTags().slice(0, 24);

      modal.innerHTML = `
        <div class="cms-modal-card fullscreen">
          <div class="cms-modal-header">
            <div>
              <span class="cms-eyebrow">ATELIER ASSET VAULT · FULL MATRIX (${filtered.length} / ${this.mediaList.length})</span>
              <h3 class="cms-modal-title">Media Library &amp; Taxonomy</h3>
            </div>
            <div class="cms-inline-row">
              <button type="button" class="cms-btn-subtle" id="cms-vault-new-cat">+ New Category</button>
              <label class="cms-dock-upload-btn" style="padding:7px 14px;">
                <span>+ Upload Photos</span>
                <input type="file" id="cms-vault-file-input" accept="image/*" multiple hidden>
              </label>
              <button type="button" class="cms-modal-close" id="cms-vault-close">✕</button>
            </div>
          </div>

          <div class="cms-inline-row" style="margin-bottom:10px;flex-wrap:wrap;">
            <input type="search" id="cms-vault-search" class="cms-input" placeholder="Search pictures by title, category, #tag, caption..." value="${this.escape(this.dockSearch)}" style="flex:1;min-width:220px;">
            <select id="cms-vault-sort" class="cms-select" style="width:auto;">
              <option value="newest" ${this.dockSort === 'newest' ? 'selected' : ''}>Newest First</option>
              <option value="az" ${this.dockSort === 'az' ? 'selected' : ''}>Title A → Z</option>
              <option value="category" ${this.dockSort === 'category' ? 'selected' : ''}>By Category</option>
              <option value="oldest" ${this.dockSort === 'oldest' ? 'selected' : ''}>Oldest First</option>
            </select>
          </div>

          <div class="cms-filter-strip" style="margin-bottom:8px;">
            <button type="button" class="cms-filter-chip ${this.dockCategory === 'all' ? 'active' : ''}" data-vcat="all">All (${this.mediaList.length})</button>
            ${this.mediaCategories.map(c => {
              const count = this.mediaList.filter(m => (m.category || 'Uncategorized').toLowerCase() === c.name.toLowerCase()).length;
              return `<button type="button" class="cms-filter-chip ${this.dockCategory.toLowerCase() === c.name.toLowerCase() ? 'active' : ''}" data-vcat="${this.escape(c.name)}"><span class="cms-cat-dot" style="background:${this.escape(c.color)};"></span>${this.escape(c.name)} (${count})</button>`;
            }).join('')}
          </div>

          ${allTags.length ? `
            <div class="cms-filter-strip" style="margin-bottom:12px;">
              <button type="button" class="cms-filter-chip ${!this.dockTag ? 'active' : ''}" data-vtag="">All Tags</button>
              ${allTags.map(([t, count]) => `<button type="button" class="cms-filter-chip ${this.dockTag === t ? 'active' : ''}" data-vtag="${this.escape(t)}">#${this.escape(t)} (${count})</button>`).join('')}
            </div>
          ` : ''}

          <div class="cms-modal-scroll">
            <div class="cms-media-grid cols-4" id="cms-full-vault-grid">
              ${filtered.map(a => this.renderAssetCardHtml(a, { mode: 'vault' })).join('') || '<p class="cms-muted-note">No assets match your filter.</p>'}
            </div>
          </div>
        </div>
      `;

      modal.querySelector('#cms-vault-close').addEventListener('click', () => modal.remove());
      modal.querySelector('#cms-vault-new-cat').addEventListener('click', () => this.openNewCategoryModal(() => renderVault()));
      modal.querySelector('#cms-vault-search').addEventListener('input', (e) => {
        this.dockSearch = e.target.value;
        const pos = e.target.selectionStart;
        renderVault();
        const el = modal.querySelector('#cms-vault-search');
        if (el) { el.focus(); el.setSelectionRange(pos, pos); }
      });
      modal.querySelector('#cms-vault-sort').addEventListener('change', (e) => { this.dockSort = e.target.value; renderVault(); });
      modal.querySelectorAll('[data-vcat]').forEach(b => b.addEventListener('click', () => { this.dockCategory = b.dataset.vcat; renderVault(); }));
      modal.querySelectorAll('[data-vtag]').forEach(b => b.addEventListener('click', () => { this.dockTag = b.dataset.vtag; renderVault(); }));
      modal.querySelector('#cms-vault-file-input').addEventListener('change', async (e) => {
        if (e.target.files && e.target.files.length) {
          await this.handleBatchFileUpload(e.target.files, { category: this.dockCategory !== 'all' ? this.dockCategory : 'Photography' });
          renderVault();
        }
      });

      this.bindAssetCardEvents(modal.querySelector('#cms-full-vault-grid'));
    };

    renderVault();
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
  }

  /* Asset Inspector Modal: Category, Tags, Alt Text, Focal Point Picker, Permalink, Credit */
  openAssetInspector(assetId) {
    const asset = this.mediaList.find(m => m.id === assetId);
    if (!asset) return;

    const existing = document.getElementById('cms-asset-inspector-modal');
    if (existing) existing.remove();

    let currentTags = Array.isArray(asset.tags) ? [...asset.tags] : [];
    let currentFocal = asset.focal_point || '50% 35%';
    const parseFocal = (fp) => {
      const m = String(fp || '50% 35%').match(/([\d.]+)%?\s+([\d.]+)%?/);
      return m ? [Number(m[1]), Number(m[2])] : [50, 35];
    };
    let [fx, fy] = parseFocal(currentFocal);
    const suggestedTags = this.getAllUniqueTags().slice(0, 12).map(([t]) => t);

    const modal = document.createElement('div');
    modal.id = 'cms-asset-inspector-modal';
    modal.className = 'cms-modal-overlay';
    modal.innerHTML = `
      <div class="cms-modal-card wide">
        <div class="cms-modal-header">
          <div>
            <span class="cms-eyebrow">ASSET INSPECTOR // METADATA &amp; FOCAL POINT</span>
            <h3 class="cms-modal-title" style="font-size:20px;">${this.escape(asset.title || asset.filename)}</h3>
          </div>
          <button type="button" class="cms-modal-close" id="cms-insp-close">✕</button>
        </div>

        <div class="cms-modal-scroll">
          <div class="cms-inspector-layout">
            <!-- Left: Interactive Focal Point Picker -->
            <div>
              <label class="cms-field-label">Focal Point — Click Image to Set (<span id="cms-focal-readout">${Math.round(fx)}% ${Math.round(fy)}%</span>)</label>
              <div class="cms-focal-stage" id="cms-focal-stage" title="Click anywhere on the photo to set focal point">
                <img src="${this.escape(asset.url)}" alt="" style="object-position:${fx}% ${fy}%;">
                <div class="cms-focal-dot" id="cms-focal-dot" style="left:${fx}%;top:${fy}%;"></div>
              </div>
              <div class="cms-inline-row" style="margin-top:10px;justify-content:space-between;">
                <span class="cms-badge info">${this.escape(asset.source || 'catalog')}</span>
                <div class="cms-inline-row" style="gap:6px;">
                  <button type="button" class="cms-btn-subtle" id="cms-insp-copy-url">⧉ Copy URL</button>
                  <button type="button" class="cms-btn-subtle" id="cms-insp-reset-focal">Center 50%</button>
                </div>
              </div>
            </div>

            <!-- Right: Metadata Form -->
            <div>
              <div class="cms-control-group">
                <label>Title</label>
                <input type="text" id="cms-insp-title" class="cms-input" value="${this.escape(asset.title || '')}">
              </div>

              <div class="cms-control-group">
                <label>Category</label>
                <div class="cms-inline-row">
                  <select id="cms-insp-category" class="cms-select" style="flex:1;">
                    ${this.mediaCategories.map(c => `<option value="${this.escape(c.name)}" ${(asset.category || 'Uncategorized').toLowerCase() === c.name.toLowerCase() ? 'selected' : ''}>${this.escape(c.name)}</option>`).join('')}
                  </select>
                  <button type="button" class="cms-btn-subtle" id="cms-insp-add-cat">+ New</button>
                </div>
              </div>

              <div class="cms-control-group">
                <label>Tags (Press Enter or Comma to Add)</label>
                <div class="cms-tag-input-box" id="cms-insp-tags-box">
                  <span id="cms-insp-tags-chips" style="display:contents;"></span>
                  <input type="text" id="cms-insp-tag-input" placeholder="chiaroscuro, leather, amsterdam...">
                </div>
                <div class="cms-filter-strip" style="margin-top:7px;">
                  ${suggestedTags.map(t => `<button type="button" class="cms-filter-chip" data-suggest-tag="${this.escape(t)}">+ #${this.escape(t)}</button>`).join('')}
                </div>
              </div>

              <div class="cms-control-group">
                <label>SEO Alt Text</label>
                <input type="text" id="cms-insp-alt" class="cms-input" placeholder="Describe the visual scene for accessibility & SEO" value="${this.escape(asset.alt_text || '')}">
              </div>

              <div class="cms-control-group">
                <label>Caption / Story</label>
                <textarea id="cms-insp-caption" class="cms-textarea" rows="2">${this.escape(asset.caption || '')}</textarea>
              </div>

              <div class="cms-grid-2">
                <div class="cms-control-group">
                  <label>Client / Credit</label>
                  <input type="text" id="cms-insp-credit" class="cms-input" placeholder="e.g. Gucci Beauty" value="${this.escape(asset.credit || '')}">
                </div>
                <div class="cms-control-group">
                  <label>Location</label>
                  <input type="text" id="cms-insp-location" class="cms-input" placeholder="e.g. Amsterdam" value="${this.escape(asset.location || '')}">
                </div>
              </div>

              <div class="cms-control-group">
                <label>Original Post / Social Link</label>
                <input type="url" id="cms-insp-permalink" class="cms-input" placeholder="https://instagram.com/p/..." value="${this.escape(asset.permalink || '')}">
              </div>

              <div class="cms-inline-row" style="justify-content:space-between;margin-bottom:14px;">
                <label class="cms-switch">
                  <input type="checkbox" id="cms-insp-featured" ${asset.featured ? 'checked' : ''}>
                  <span>Starred / Featured Asset ★</span>
                </label>
              </div>

              <button type="button" id="cms-insp-save-btn" class="cms-luxury-btn">
                Save Asset Metadata ↵
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    const renderChips = () => {
      const wrap = modal.querySelector('#cms-insp-tags-chips');
      wrap.innerHTML = currentTags.map((t, i) => `
        <span class="cms-tag-chip">
          #${this.escape(t)}
          <button type="button" data-rm-tag="${i}" aria-label="Remove tag">×</button>
        </span>
      `).join('');
      wrap.querySelectorAll('[data-rm-tag]').forEach(btn => {
        btn.addEventListener('click', () => {
          currentTags.splice(Number(btn.dataset.rmTag), 1);
          renderChips();
        });
      });
    };
    renderChips();

    const addTag = (raw) => {
      const clean = String(raw || '').trim().toLowerCase().replace(/^#/, '').replace(/[^a-z0-9_-]/g, '-');
      if (clean && !currentTags.includes(clean)) {
        currentTags.push(clean);
        renderChips();
      }
    };

    const tagInput = modal.querySelector('#cms-insp-tag-input');
    tagInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ',') {
        e.preventDefault();
        addTag(tagInput.value);
        tagInput.value = '';
      } else if (e.key === 'Backspace' && !tagInput.value && currentTags.length) {
        currentTags.pop();
        renderChips();
      }
    });

    modal.querySelectorAll('[data-suggest-tag]').forEach(btn => {
      btn.addEventListener('click', () => addTag(btn.dataset.suggestTag));
    });

    // Focal Point Interactive Crosshair
    const stage = modal.querySelector('#cms-focal-stage');
    const dot = modal.querySelector('#cms-focal-dot');
    const readout = modal.querySelector('#cms-focal-readout');
    const setFocalFromEvent = (e) => {
      const rect = stage.getBoundingClientRect();
      fx = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
      fy = Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100));
      currentFocal = `${Math.round(fx)}% ${Math.round(fy)}%`;
      dot.style.left = `${fx}%`;
      dot.style.top = `${fy}%`;
      readout.textContent = currentFocal;
    };
    stage.addEventListener('click', setFocalFromEvent);

    modal.querySelector('#cms-insp-reset-focal').addEventListener('click', () => {
      fx = 50; fy = 35;
      currentFocal = '50% 35%';
      dot.style.left = '50%';
      dot.style.top = '35%';
      readout.textContent = currentFocal;
    });

    modal.querySelector('#cms-insp-copy-url').addEventListener('click', () => {
      navigator.clipboard.writeText(asset.url);
      this.toast('Asset URL copied to clipboard', 'success');
    });

    modal.querySelector('#cms-insp-add-cat').addEventListener('click', () => {
      this.openNewCategoryModal((newCatName) => {
        const sel = modal.querySelector('#cms-insp-category');
        if (sel) {
          sel.innerHTML = this.mediaCategories.map(c => `<option value="${this.escape(c.name)}" ${c.name === newCatName ? 'selected' : ''}>${this.escape(c.name)}</option>`).join('');
        }
      });
    });

    modal.querySelector('#cms-insp-close').addEventListener('click', () => modal.remove());
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });

    modal.querySelector('#cms-insp-save-btn').addEventListener('click', async () => {
      if (tagInput.value.trim()) addTag(tagInput.value);
      const patch = {
        title: modal.querySelector('#cms-insp-title').value.trim() || asset.filename,
        category: modal.querySelector('#cms-insp-category').value || 'Uncategorized',
        tags: currentTags,
        alt_text: modal.querySelector('#cms-insp-alt').value.trim(),
        caption: modal.querySelector('#cms-insp-caption').value.trim(),
        credit: modal.querySelector('#cms-insp-credit').value.trim(),
        location: modal.querySelector('#cms-insp-location').value.trim(),
        permalink: modal.querySelector('#cms-insp-permalink').value.trim(),
        focal_point: currentFocal,
        featured: modal.querySelector('#cms-insp-featured').checked
      };
      await this.updateAssetMetadata(asset.id, patch);
      modal.remove();
    });
  }

  openNewCategoryModal(onCreated = null) {
    const overlay = document.createElement('div');
    overlay.className = 'cms-modal-overlay';
    let pickedColor = CATEGORY_COLORS[0];

    overlay.innerHTML = `
      <div class="cms-modal-card" style="max-width:420px;">
        <div class="cms-modal-header">
          <div>
            <span class="cms-eyebrow">MEDIA TAXONOMY</span>
            <h3 class="cms-modal-title" style="font-size:20px;">New Asset Category</h3>
          </div>
          <button type="button" class="cms-modal-close" data-close>✕</button>
        </div>
        <div class="cms-control-group">
          <label>Category Name</label>
          <input type="text" id="cms-new-cat-name" class="cms-input" placeholder="e.g. Backstage, Runway, Film Stills" autofocus>
        </div>
        <div class="cms-control-group">
          <label>Accent Color</label>
          <div style="display:flex;gap:8px;flex-wrap:wrap;" id="cms-new-cat-colors">
            ${CATEGORY_COLORS.map((c, i) => `
              <button type="button" class="cms-color-dot ${i === 0 ? 'active' : ''}" data-cat-col="${c}" style="width:28px;height:28px;background:${c};"></button>
            `).join('')}
          </div>
        </div>
        <button type="button" id="cms-create-cat-submit" class="cms-luxury-btn">Create Category ↵</button>
      </div>
    `;
    document.body.appendChild(overlay);

    overlay.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', () => overlay.remove()));
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
    overlay.querySelectorAll('[data-cat-col]').forEach(dot => {
      dot.addEventListener('click', () => {
        pickedColor = dot.dataset.catCol;
        overlay.querySelectorAll('[data-cat-col]').forEach(d => d.classList.remove('active'));
        dot.classList.add('active');
      });
    });

    overlay.querySelector('#cms-create-cat-submit').addEventListener('click', async () => {
      const name = overlay.querySelector('#cms-new-cat-name').value.trim();
      if (!name) return this.toast('Enter a category name', 'warn');
      await this.addCategory(name, pickedColor);
      overlay.remove();
      if (onCreated) onCreated(name);
    });
  }

  async addCategory(name, color = '#38bdf8') {
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    if (this.mediaCategories.some(c => c.slug === slug || c.name.toLowerCase() === name.toLowerCase())) {
      this.toast('Category already exists', 'warn');
      return;
    }
    const cat = { id: 'cat_' + slug + '_' + Date.now().toString(36), slug, name, color, sort_order: this.mediaCategories.length };
    this.mediaCategories.push(cat);
    this.draft.mediaCategories = this.mediaCategories;
    this.markDraftModified();

    if (this.supabase) {
      try {
        await this.supabase.from('media_categories').upsert(cat, { onConflict: 'slug' });
      } catch (e) {}
    }

    this.renderAssetDock();
    if (this.activeDrawerTab === 'media') this.renderDrawerContent();
    this.toast(`Created category "${name}"`, 'success');
  }

  async deleteCategory(slug) {
    if (slug === 'uncategorized') return this.toast('Default category cannot be removed', 'warn');
    const target = this.mediaCategories.find(c => c.slug === slug);
    if (!target) return;
    const ok = await this.confirmModal('Delete Category?', `Assets in "${target.name}" will be moved to Uncategorized.`, 'Delete');
    if (!ok) return;

    this.mediaCategories = this.mediaCategories.filter(c => c.slug !== slug);
    this.draft.mediaCategories = this.mediaCategories;
    this.mediaList.forEach(m => {
      if ((m.category || '').toLowerCase() === target.name.toLowerCase()) {
        m.category = 'Uncategorized';
        if (!this.draft.mediaMeta) this.draft.mediaMeta = {};
        this.draft.mediaMeta[m.id] = { ...(this.draft.mediaMeta[m.id] || {}), category: 'Uncategorized' };
      }
    });
    this.markDraftModified();

    if (this.supabase) {
      try {
        await this.supabase.from('media_categories').delete().eq('slug', slug);
        await this.supabase.from('media_items').update({ category: 'Uncategorized' }).eq('category', target.name);
      } catch (e) {}
    }

    if (this.dockCategory.toLowerCase() === target.name.toLowerCase()) this.dockCategory = 'all';
    this.renderAssetDock();
    if (this.activeDrawerTab === 'media') this.renderDrawerContent();
    this.toast(`Removed category "${target.name}"`, 'info');
  }

  async updateAssetMetadata(id, patch, silent = false) {
    const asset = this.mediaList.find(m => m.id === id);
    if (!asset) return;
    Object.assign(asset, patch, { name: patch.title || asset.title || asset.filename });

    if (!this.draft.mediaMeta) this.draft.mediaMeta = {};
    this.draft.mediaMeta[id] = {
      title: asset.title,
      category: asset.category,
      tags: asset.tags || [],
      alt_text: asset.alt_text || '',
      caption: asset.caption || '',
      focal_point: asset.focal_point || '50% 35%',
      permalink: asset.permalink || '',
      credit: asset.credit || '',
      location: asset.location || '',
      featured: Boolean(asset.featured)
    };
    this.markDraftModified();

    if (this.supabase) {
      try {
        const dbPatch = { ...patch, updated_at: new Date().toISOString() };
        const { error } = await this.supabase.from('media_items').update(dbPatch).eq('id', id);
        if (error) {
          // If catalog row wasn't seeded yet, upsert it cleanly
          await this.supabase.from('media_items').upsert({
            id: asset.id,
            filename: asset.filename || 'asset.jpg',
            title: asset.title,
            caption: asset.caption || '',
            alt_text: asset.alt_text || '',
            category: asset.category || 'Uncategorized',
            tags: asset.tags || [],
            focal_point: asset.focal_point || '50% 35%',
            permalink: asset.permalink || '',
            credit: asset.credit || '',
            location: asset.location || '',
            featured: Boolean(asset.featured),
            url: asset.isBlob ? null : asset.url,
            blob_data: asset.isBlob ? asset.url : null,
            source: asset.source || 'catalog',
            created_by: this.user.email || 'admin'
          }, { onConflict: 'id' });
        }
      } catch (e) {
        console.warn('Could not sync asset metadata to DB:', e);
      }
    }

    if (!silent) {
      this.renderAssetDock();
      if (this.activeDrawerTab === 'media') this.renderDrawerContent();
      this.toast(`Saved "${asset.title}"`, 'success');
    }
  }

  /* ===================================================================
     IMAGE PICKER MODAL (SWAP IMAGE & LINK ON PAGE CLICK)
     =================================================================== */
  openImagePickerModal(target) {
    let modal = document.getElementById('cms-image-picker-modal');
    if (modal) modal.remove();

    const targetImg = (target && target.tagName === 'IMG') ? target : (target ? target.querySelector('img') || target : null);
    if (!targetImg) return;
    const currentImgSrc = targetImg.src || '';
    const imgKey = targetImg.getAttribute('data-cms-img') || (target && target.getAttribute ? target.getAttribute('data-cms-img') : null) || this.getElementSelector(targetImg);

    let postShortcode = null;
    const postEl = targetImg.closest('[data-post]') || (target ? target.closest('[data-post]') : null);
    if (postEl && postEl.dataset.post) postShortcode = postEl.dataset.post;
    else if (targetImg.dataset && targetImg.dataset.post) postShortcode = targetImg.dataset.post;
    else if (targetImg.id === 'project-image' || targetImg.closest('#project-dialog')) {
      postShortcode = window.MeauxSite && window.MeauxSite.getActiveProject ? window.MeauxSite.getActiveProject() : null;
    }

    let currentPortfolio = window.MeauxSite ? window.MeauxSite.getPortfolio() : this.draft.portfolio;
    let matchedPost = null;
    if (currentPortfolio && Array.isArray(currentPortfolio.items)) {
      if (postShortcode) {
        matchedPost = currentPortfolio.items.find(p => p.shortcode === postShortcode);
      } else {
        const cleanSrc = (targetImg.src || '').split('?')[0];
        matchedPost = currentPortfolio.items.find(p => (p.image_url && cleanSrc.endsWith(p.image_url)) || (p.image_file && cleanSrc.endsWith(p.image_file)));
        if (matchedPost) postShortcode = matchedPost.shortcode;
      }
    }

    let currentPostLink = (matchedPost && matchedPost.permalink) || (postShortcode && this.draft.customPostLinks?.[postShortcode]) || '';
    let pickerSearch = '';
    let pickerCat = 'all';

    modal = document.createElement('div');
    modal.id = 'cms-image-picker-modal';
    modal.className = 'cms-modal-overlay';
    modal.innerHTML = `
      <div class="cms-modal-card wide">
        <div class="cms-modal-header">
          <div>
            <span class="cms-eyebrow">ATELIER ASSET VAULT · ${this.escape(imgKey)}</span>
            <h3 class="cms-modal-title" style="font-size:20px;">Swap Image, Focal Point &amp; Link</h3>
          </div>
          <button type="button" class="cms-modal-close" id="cms-img-picker-close">✕</button>
        </div>

        <div class="cms-modal-scroll">
          <div class="cms-glass-card">
            <label class="cms-field-label">Original Post / Social Link ${postShortcode ? `(#${this.escape(postShortcode)})` : ''}</label>
            <div class="cms-inline-row">
              <input type="url" id="cms-post-link-input" class="cms-input" placeholder="https://instagram.com/p/... (empty hides button)" value="${this.escape(currentPostLink)}" style="flex:1;">
              <button type="button" id="cms-clear-link-btn" class="cms-btn-subtle">Clear</button>
              <button type="button" id="cms-save-link-only-btn" class="cms-btn-subtle">Save Link</button>
            </div>
          </div>

          <div class="cms-glass-card">
            <div class="cms-inline-row" style="justify-content:space-between;flex-wrap:wrap;margin-bottom:10px;">
              <span class="cms-field-label" style="margin:0;">Upload New Photo or Paste URL</span>
              <div class="cms-inline-row" style="font-size:10.5px;">
                <label style="display:flex;align-items:center;gap:4px;cursor:pointer;"><input type="radio" name="modal-upload-mode" value="blob" checked> DB Blob</label>
                <label style="display:flex;align-items:center;gap:4px;cursor:pointer;"><input type="radio" name="modal-upload-mode" value="storage"> Storage Bucket</label>
              </div>
            </div>
            <div class="cms-grid-2">
              <input type="file" id="cms-modal-file-upload" accept="image/*" class="cms-input" style="padding:7px;">
              <div class="cms-inline-row">
                <input type="text" id="cms-img-url-input" class="cms-input" placeholder="https://..." value="${this.escape(currentImgSrc)}">
                <button type="button" id="cms-apply-img-url-btn" class="cms-btn-subtle">Apply ↵</button>
              </div>
            </div>
          </div>

          <div class="cms-inline-row" style="justify-content:space-between;margin-bottom:8px;flex-wrap:wrap;">
            <span class="cms-field-label" style="margin:0;">Choose from Categorized Vault (<span id="cms-picker-count">0</span>)</span>
            <input type="search" id="cms-picker-search" class="cms-input" placeholder="Filter by title, category, #tag..." style="width:240px;">
          </div>

          <div class="cms-filter-strip" id="cms-picker-cats" style="margin-bottom:10px;">
            <button type="button" class="cms-filter-chip active" data-pcat="all">All</button>
            ${this.mediaCategories.map(c => `<button type="button" class="cms-filter-chip" data-pcat="${this.escape(c.name)}"><span class="cms-cat-dot" style="background:${this.escape(c.color)};"></span>${this.escape(c.name)}</button>`).join('')}
          </div>

          <div class="cms-media-grid cols-3" id="cms-picker-grid"></div>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    const applyImage = (url, postLink, focalPoint = null) => {
      this.pushUndoSnapshot();
      if (targetImg && targetImg.tagName === 'IMG') {
        targetImg.src = url;
        if (focalPoint) targetImg.style.objectPosition = focalPoint;
      }

      if (!this.draft.customImages) this.draft.customImages = {};
      this.draft.customImages[imgKey] = url;
      if (focalPoint) {
        if (!this.draft.customImageFocalPoints) this.draft.customImageFocalPoints = {};
        this.draft.customImageFocalPoints[imgKey] = focalPoint;
      }

      const sc = postShortcode || (matchedPost ? matchedPost.shortcode : null);
      if (sc) {
        const linkToSave = postLink !== undefined ? (postLink || '').trim() : '';
        if (!this.draft.customPostLinks) this.draft.customPostLinks = {};
        this.draft.customPostLinks[sc] = linkToSave;

        if (window.MeauxSite) {
          const p = window.MeauxSite.getPortfolio();
          const targetPost = p.items.find(item => item.shortcode === sc);
          if (targetPost) {
            targetPost.image_url = url;
            targetPost.permalink = linkToSave;
          }
          this.draft.portfolio = p;
          window.MeauxSite.setPortfolio(p);
        }

        document.querySelectorAll(`[data-post="${sc}"]`).forEach(el => {
          const i = el.tagName === 'IMG' ? el : el.querySelector('img');
          if (i) i.src = url;
        });
      }

      this.bindImageEditing();
      this.markDraftModified();
      this.toast('Image updated', 'success');
      modal.remove();
    };

    const renderPickerGrid = () => {
      const grid = modal.querySelector('#cms-picker-grid');
      const items = this.getFilteredAssets({ search: pickerSearch, category: pickerCat, tag: '', source: 'all' });
      modal.querySelector('#cms-picker-count').textContent = String(items.length);
      grid.innerHTML = items.map(a => this.renderAssetCardHtml(a, { mode: 'picker' })).join('') || '<p class="cms-muted-note">No matching photos.</p>';
      this.bindAssetCardEvents(grid, {
        onPick: (asset) => {
          const linkVal = (modal.querySelector('#cms-post-link-input')?.value || '').trim();
          applyImage(asset.url, linkVal, asset.focal_point || null);
        }
      });
    };

    renderPickerGrid();

    modal.querySelector('#cms-picker-search').addEventListener('input', (e) => { pickerSearch = e.target.value; renderPickerGrid(); });
    modal.querySelectorAll('[data-pcat]').forEach(btn => {
      btn.addEventListener('click', () => {
        pickerCat = btn.dataset.pcat;
        modal.querySelectorAll('[data-pcat]').forEach(b => b.classList.toggle('active', b === btn));
        renderPickerGrid();
      });
    });
    modal.querySelector('#cms-clear-link-btn').addEventListener('click', () => {
      modal.querySelector('#cms-post-link-input').value = '';
      this.toast('Post link cleared', 'info');
    });
    modal.querySelector('#cms-save-link-only-btn').addEventListener('click', () => {
      applyImage(targetImg.src, modal.querySelector('#cms-post-link-input').value.trim());
    });
    modal.querySelector('#cms-apply-img-url-btn').addEventListener('click', () => {
      const url = modal.querySelector('#cms-img-url-input').value.trim();
      if (url) applyImage(url, modal.querySelector('#cms-post-link-input').value.trim());
    });
    modal.querySelector('#cms-modal-file-upload').addEventListener('change', async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const mode = modal.querySelector('input[name="modal-upload-mode"]:checked').value;
      const newUrl = await this.uploadMediaFile(file, mode);
      if (newUrl) applyImage(newUrl, '');
    });
    modal.querySelector('#cms-img-picker-close').addEventListener('click', () => modal.remove());
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
  }

  getElementSelector(el) {
    if (el.getAttribute('data-cms-img')) return `[data-cms-img="${el.getAttribute('data-cms-img')}"]`;
    if (el.id) return '#' + el.id;
    if (el.dataset.post) return `[data-post="${el.dataset.post}"] img`;
    return el.tagName.toLowerCase();
  }

  /* ===================================================================
     4. PHOTOGRAPHY BENTO EDITOR & DRAG-DROP ENGINE
     =================================================================== */
  bindBentoEditor() {
    document.addEventListener('meaux:bento-rendered', () => this.refreshBentoEditUI());
  }

  persistPhotoStyles(styles) {
    this.pushUndoSnapshot();
    this.draft.photoStyles = styles;
    if (window.MeauxSite && window.MeauxSite.setPhotoStyles) {
      window.MeauxSite.setPhotoStyles(styles);
    }
    this.markDraftModified();
  }

  appendAssetToBento(asset, insertAtIndex = null) {
    if (!window.MeauxSite || !window.MeauxSite.getPhotoStyles) return;
    const styles = window.MeauxSite.getPhotoStyles();
    const activeStyle = window.MeauxSite.getActivePhotoStyle();
    if (!styles[activeStyle]) return;

    const entry = {
      id: asset.id || ('custom_' + Date.now()),
      title: asset.title || 'New Frame',
      subtitle: asset.subtitle || 'Atelier Meaux',
      tag: asset.tag || 'Photography',
      pos: asset.pos || '50% 35%',
      image_url: asset.image_url || asset.url
    };

    if (insertAtIndex !== null && insertAtIndex >= 0 && insertAtIndex <= styles[activeStyle].items.length) {
      styles[activeStyle].items.splice(insertAtIndex, 0, entry);
    } else {
      styles[activeStyle].items.push(entry);
    }
    this.persistPhotoStyles(styles);
  }

  replaceBentoTileAsset(index, asset) {
    if (!window.MeauxSite || !window.MeauxSite.getPhotoStyles) return;
    const styles = window.MeauxSite.getPhotoStyles();
    const activeStyle = window.MeauxSite.getActivePhotoStyle();
    if (!styles[activeStyle] || !styles[activeStyle].items[index]) return;

    const existing = styles[activeStyle].items[index];
    styles[activeStyle].items[index] = {
      ...existing,
      id: asset.id || existing.id,
      title: asset.title || existing.title,
      pos: asset.pos || existing.pos || '50% 35%',
      image_url: asset.image_url || asset.url
    };
    this.persistPhotoStyles(styles);
    this.toast(`Swapped Bento frame #${index + 1}`, 'success');
  }

  reorderBentoTile(fromIdx, toIdx) {
    if (fromIdx === toIdx || !window.MeauxSite || !window.MeauxSite.getPhotoStyles) return;
    const styles = window.MeauxSite.getPhotoStyles();
    const activeStyle = window.MeauxSite.getActivePhotoStyle();
    if (!styles[activeStyle]) return;
    const list = styles[activeStyle].items;
    if (fromIdx < 0 || toIdx < 0 || fromIdx >= list.length || toIdx >= list.length) return;
    const [moved] = list.splice(fromIdx, 1);
    list.splice(toIdx, 0, moved);
    this.persistPhotoStyles(styles);
  }

  removeBentoTile(index) {
    if (!window.MeauxSite || !window.MeauxSite.getPhotoStyles) return;
    const styles = window.MeauxSite.getPhotoStyles();
    const activeStyle = window.MeauxSite.getActivePhotoStyle();
    if (!styles[activeStyle] || styles[activeStyle].items.length <= 1) {
      this.toast('Keep at least 1 frame in this Bento style', 'warn');
      return;
    }
    styles[activeStyle].items.splice(index, 1);
    this.persistPhotoStyles(styles);
    this.toast('Removed frame from Bento', 'info');
  }

  openBentoTileEditor(index) {
    if (!window.MeauxSite || !window.MeauxSite.getPhotoStyles) return;
    const styles = window.MeauxSite.getPhotoStyles();
    const activeStyle = window.MeauxSite.getActivePhotoStyle();
    const item = styles[activeStyle]?.items?.[index];
    if (!item) return;

    const portfolio = window.MeauxSite.getPortfolio();
    const matchedPost = portfolio.items.find(p => p.shortcode === item.id);
    let currentUrl = item.image_url || (matchedPost ? `instagram/meauxsvision/images/${matchedPost.image_file}` : '');
    let currentPos = item.pos || '50% 35%';
    const m = currentPos.match(/([\d.]+)%?\s+([\d.]+)%?/);
    let [fx, fy] = m ? [Number(m[1]), Number(m[2])] : [50, 35];

    const overlay = document.createElement('div');
    overlay.className = 'cms-modal-overlay';
    overlay.innerHTML = `
      <div class="cms-modal-card wide">
        <div class="cms-modal-header">
          <div>
            <span class="cms-eyebrow">BENTO FRAME EDITOR · SLOT ${String(index + 1).padStart(2, '0')} (${this.escape(activeStyle)})</span>
            <h3 class="cms-modal-title" style="font-size:20px;">Edit Frame &amp; Focal Point</h3>
          </div>
          <button type="button" class="cms-modal-close" data-close>✕</button>
        </div>
        <div class="cms-modal-scroll">
          <div class="cms-inspector-layout">
            <div>
              <label class="cms-field-label">Click Image to Adjust Crop Focal Point (<span id="cms-bf-readout">${Math.round(fx)}% ${Math.round(fy)}%</span>)</label>
              <div class="cms-focal-stage" id="cms-bf-stage">
                <img id="cms-bf-img" src="${this.escape(currentUrl)}" alt="">
                <div class="cms-focal-dot" id="cms-bf-dot" style="left:${fx}%;top:${fy}%;"></div>
              </div>
            </div>
            <div>
              <div class="cms-control-group">
                <label>Frame Title</label>
                <input type="text" id="cms-bf-title" class="cms-input" value="${this.escape(item.title || '')}">
              </div>
              <div class="cms-control-group">
                <label>Subtitle / Shoot Credit</label>
                <input type="text" id="cms-bf-subtitle" class="cms-input" value="${this.escape(item.subtitle || '')}">
              </div>
              <div class="cms-control-group">
                <label>Category / Corner Tag</label>
                <input type="text" id="cms-bf-tag" class="cms-input" value="${this.escape(item.tag || '')}">
              </div>
              <div class="cms-control-group">
                <label>Image URL</label>
                <input type="text" id="cms-bf-url" class="cms-input" value="${this.escape(currentUrl)}">
              </div>
              <button type="button" id="cms-bf-save" class="cms-luxury-btn">Update Bento Frame ↵</button>
            </div>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    const stage = overlay.querySelector('#cms-bf-stage');
    const dot = overlay.querySelector('#cms-bf-dot');
    const readout = overlay.querySelector('#cms-bf-readout');
    stage.addEventListener('click', (e) => {
      const r = stage.getBoundingClientRect();
      fx = Math.max(0, Math.min(100, ((e.clientX - r.left) / r.width) * 100));
      fy = Math.max(0, Math.min(100, ((e.clientY - r.top) / r.height) * 100));
      currentPos = `${Math.round(fx)}% ${Math.round(fy)}%`;
      dot.style.left = `${fx}%`;
      dot.style.top = `${fy}%`;
      readout.textContent = currentPos;
    });

    overlay.querySelector('#cms-bf-url').addEventListener('input', (e) => {
      overlay.querySelector('#cms-bf-img').src = e.target.value.trim();
    });

    overlay.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', () => overlay.remove()));
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });

    overlay.querySelector('#cms-bf-save').addEventListener('click', () => {
      styles[activeStyle].items[index] = {
        ...item,
        title: overlay.querySelector('#cms-bf-title').value.trim(),
        subtitle: overlay.querySelector('#cms-bf-subtitle').value.trim(),
        tag: overlay.querySelector('#cms-bf-tag').value.trim(),
        pos: currentPos,
        image_url: overlay.querySelector('#cms-bf-url').value.trim()
      };
      this.persistPhotoStyles(styles);
      overlay.remove();
      this.toast('Bento frame updated', 'success');
    });
  }

  async handleBentoFileDrop(files, targetIndex = null) {
    const file = Array.from(files || []).find(f => f.type && f.type.startsWith('image/'));
    if (!file) return;
    const url = await this.uploadMediaFile(file, 'blob', { category: 'Photography' });
    if (!url) return;
    const asset = {
      id: 'up_' + Date.now(),
      title: file.name.replace(/\.[^.]+$/, ''),
      subtitle: 'Atelier Shoot',
      image_url: url
    };
    if (targetIndex !== null) this.replaceBentoTileAsset(targetIndex, asset);
    else this.appendAssetToBento(asset);
    this.renderAssetDock();
  }

  refreshBentoEditUI() {
    const grid = document.getElementById('photo-bento-grid');
    if (!grid) return;

    const oldDrop = document.getElementById('cms-bento-dropzone');
    if (oldDrop) oldDrop.remove();

    const active = this.isEditMode || this.assetDockOpen;
    grid.classList.toggle('cms-bento-editable', active);

    grid.querySelectorAll('.bento-tile').forEach((tile) => {
      tile.querySelectorAll('.cms-bento-controls').forEach(c => c.remove());

      if (!active) {
        tile.removeAttribute('draggable');
        return;
      }

      const idx = Number(tile.dataset.bentoIndex);
      tile.setAttribute('draggable', 'true');

      const controls = document.createElement('span');
      controls.className = 'cms-bento-controls';
      const spanLabel = tile.classList.contains('span-6x6') ? 'HERO'
        : tile.classList.contains('span-6x5') ? 'SQUARE'
        : tile.classList.contains('span-4x4') ? 'FEATURE'
        : 'MEDIUM';
      controls.innerHTML = `
        <span class="cms-bento-slot-pill">${String(idx + 1).padStart(2, '0')} · ${spanLabel}</span>
        <span class="cms-bento-edit-btn" role="button" tabindex="0" title="Edit title, tag & focal point">✎</span>
        <span class="cms-bento-remove-btn" role="button" tabindex="0" title="Remove from Bento">✕</span>
      `;
      tile.appendChild(controls);

      controls.querySelector('.cms-bento-edit-btn').addEventListener('click', (e) => {
        e.preventDefault(); e.stopPropagation();
        this.openBentoTileEditor(idx);
      });
      controls.querySelector('.cms-bento-remove-btn').addEventListener('click', (e) => {
        e.preventDefault(); e.stopPropagation();
        this.removeBentoTile(idx);
      });

      if (!tile.__bentoDndBound) {
        tile.__bentoDndBound = true;
        tile.addEventListener('dragstart', (e) => {
          if (!this.isEditMode && !this.assetDockOpen) return;
          tile.classList.add('is-dragging');
          e.dataTransfer.setData('application/x-meaux-asset', JSON.stringify({ source: 'bento-tile', fromIndex: Number(tile.dataset.bentoIndex) }));
          e.dataTransfer.effectAllowed = 'move';
        });
        tile.addEventListener('dragend', () => {
          tile.classList.remove('is-dragging');
          grid.querySelectorAll('.bento-tile.is-drop-target').forEach(t => t.classList.remove('is-drop-target'));
        });
        tile.addEventListener('dragover', (e) => {
          if (!this.isEditMode && !this.assetDockOpen) return;
          e.preventDefault();
          tile.classList.add('is-drop-target');
        });
        tile.addEventListener('dragleave', () => tile.classList.remove('is-drop-target'));
        tile.addEventListener('drop', async (e) => {
          if (!this.isEditMode && !this.assetDockOpen) return;
          e.preventDefault(); e.stopPropagation();
          tile.classList.remove('is-drop-target');
          const targetIdx = Number(tile.dataset.bentoIndex);
          if (e.dataTransfer.files && e.dataTransfer.files.length) {
            await this.handleBentoFileDrop(e.dataTransfer.files, targetIdx);
            return;
          }
          const raw = e.dataTransfer.getData('application/x-meaux-asset') || e.dataTransfer.getData('text/plain');
          if (!raw) return;
          try {
            const data = JSON.parse(raw);
            if (data.source === 'bento-tile') this.reorderBentoTile(data.fromIndex, targetIdx);
            else if (data.source === 'asset-dock') this.replaceBentoTileAsset(targetIdx, data);
          } catch (err) {}
        });
      }
    });

    if (active) {
      const dropzone = document.createElement('div');
      dropzone.id = 'cms-bento-dropzone';
      dropzone.className = 'cms-bento-dropzone';
      dropzone.innerHTML = `
        <div class="cms-bento-dropzone-inner">
          <span class="cms-bento-drop-icon">+</span>
          <div>
            <strong>Drop Image Here to Append to Bento</strong>
            <span>Drag from the Asset Vault or your computer — auto-balanced layout with zero empty gaps.</span>
          </div>
          <button type="button" class="cms-btn-subtle" id="cms-open-dock-from-bento">
            ${this.assetDockOpen ? 'Asset Gallery Open ✓' : 'Open Asset Gallery ⊞'}
          </button>
        </div>
      `;
      grid.insertAdjacentElement('afterend', dropzone);
      dropzone.querySelector('#cms-open-dock-from-bento').addEventListener('click', () => this.toggleAssetDock(true));
      dropzone.addEventListener('dragover', (e) => { e.preventDefault(); dropzone.classList.add('is-over'); });
      dropzone.addEventListener('dragleave', () => dropzone.classList.remove('is-over'));
      dropzone.addEventListener('drop', async (e) => {
        e.preventDefault(); dropzone.classList.remove('is-over');
        if (e.dataTransfer.files && e.dataTransfer.files.length) {
          await this.handleBentoFileDrop(e.dataTransfer.files, null);
          return;
        }
        const raw = e.dataTransfer.getData('application/x-meaux-asset') || e.dataTransfer.getData('text/plain');
        if (!raw) return;
        try {
          const data = JSON.parse(raw);
          if (data.source === 'asset-dock') this.appendAssetToBento(data);
        } catch (err) {}
      });
    }
  }

  /* ===================================================================
     5. FUTURISTIC STUDIO OS RIGHT DRAWER & 10 MODULES
     =================================================================== */
  toggleSidebar(forceState = null) {
    this.drawerOpen = forceState !== null ? forceState : !this.drawerOpen;
    const drawer = document.getElementById('cms-admin-drawer');
    if (drawer) drawer.classList.toggle('open', this.drawerOpen);
    const btn = document.getElementById('cms-open-drawer-btn');
    if (btn) btn.classList.toggle('active', this.drawerOpen);
  }

  buildDrawer() {
    let drawer = document.getElementById('cms-admin-drawer');
    if (drawer) drawer.remove();

    const tabs = [
      { id: 'pages', icon: '◫', label: 'Pages' },
      { id: 'blocks', icon: '⊞', label: 'Blocks' },
      { id: 'styles', icon: '✦', label: 'Styles' },
      { id: 'backgrounds', icon: '◈', label: 'Surfaces' },
      { id: 'portfolio', icon: '◉', label: 'Works' },
      { id: 'media', icon: '▣', label: 'Vault' },
      { id: 'enquiries', icon: '✉', label: 'Inbox', hasBadge: true },
      { id: 'history', icon: '↺', label: 'History' },
      { id: 'admins', icon: '◎', label: 'Team' },
      { id: 'settings', icon: '⚙', label: 'System' }
    ];

    drawer = document.createElement('div');
    drawer.id = 'cms-admin-drawer';
    drawer.innerHTML = `
      <div class="cms-drawer-header">
        <div>
          <span class="cms-eyebrow">MEAUX ATELIER OS // V2.0</span>
          <h3>Studio Control</h3>
        </div>
        <div class="cms-header-actions">
          <button type="button" class="cms-icon-btn" id="cms-drawer-expand-btn" title="Expand / Compact Panel">⤢</button>
          <button type="button" class="cms-icon-btn" id="cms-drawer-close-btn" title="Close Panel">✕</button>
        </div>
      </div>

      <div class="cms-drawer-shell">
        <nav class="cms-drawer-rail" aria-label="Studio Modules">
          ${tabs.map(t => `
            <button type="button" class="cms-drawer-tab ${this.activeDrawerTab === t.id ? 'active' : ''}" data-tab="${t.id}">
              <span class="cms-tab-icon">${t.icon}</span>
              <span>${t.label}</span>
              ${t.hasBadge ? '<span class="cms-tab-badge" id="cms-enquiries-badge" style="display:none;">0</span>' : ''}
            </button>
          `).join('')}
        </nav>

        <div class="cms-drawer-body" id="cms-drawer-content"></div>
      </div>
    `;
    document.body.appendChild(drawer);

    drawer.querySelector('#cms-drawer-close-btn').addEventListener('click', () => this.toggleSidebar(false));
    drawer.querySelector('#cms-drawer-expand-btn').addEventListener('click', () => {
      this.drawerExpanded = !this.drawerExpanded;
      drawer.classList.toggle('expanded', this.drawerExpanded);
    });

    drawer.querySelectorAll('.cms-drawer-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        drawer.querySelectorAll('.cms-drawer-tab').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.activeDrawerTab = btn.dataset.tab;
        this.renderDrawerContent();
      });
    });
  }

  renderDrawerContent() {
    const container = document.getElementById('cms-drawer-content');
    if (!container) return;

    const map = {
      pages: () => this.renderPagesTab(container),
      blocks: () => this.renderBlocksTab(container),
      styles: () => this.renderStylesTab(container),
      backgrounds: () => this.renderBackgroundsTab(container),
      portfolio: () => this.renderPortfolioTab(container),
      media: () => this.renderMediaTab(container),
      enquiries: () => this.renderEnquiriesTab(container),
      history: () => this.renderHistoryTab(container),
      admins: () => this.renderAdminsTab(container),
      settings: () => this.renderSettingsTab(container)
    };
    (map[this.activeDrawerTab] || map.pages)();
  }

  /* -------------------------------------------------------------------
     MODULE 1: PAGES, NAVIGATION ORDER, PER-PAGE SEO & SECTION VISIBILITY
     ------------------------------------------------------------------- */
  renderPagesTab(container) {
    const pages = this.draft.pages || [];
    const activeTab = window.MeauxSite ? window.MeauxSite.getActiveTab() : 'atelier';
    const builtinSections = BUILTIN_SECTIONS_BY_PAGE[activeTab] || [];
    const vis = this.draft.sectionVisibility || {};

    container.innerHTML = `
      <div class="cms-section-head">
        <h4>Pages &amp; Navigation</h4>
        <span class="cms-badge info">${pages.length} Pages</span>
      </div>
      <p class="cms-muted-note">Reorder navigation tabs, rename labels, toggle visibility, configure per-page SEO, or add new pages.</p>

      <div id="cms-pages-list">
        ${pages.map((p, idx) => `
          <div class="cms-list-item">
            <div style="min-width:0;flex:1;">
              <div style="display:flex;align-items:center;gap:6px;">
                <strong style="font-size:12px;">${this.escape(p.navLabel || p.title)}</strong>
                ${p.id === activeTab ? '<span class="cms-badge info">Active</span>' : ''}
                ${p.showInNav === false ? '<span class="cms-badge warn">Hidden</span>' : ''}
              </div>
              <span style="color:var(--cms-dim);font-size:9.5px;">#${this.escape(p.id)} ${p.seoTitle ? '· Custom SEO' : ''}</span>
            </div>
            <div class="cms-inline-row" style="gap:4px;">
              <button type="button" class="cms-btn-subtle" data-move-page="${idx}" data-dir="-1" ${idx === 0 ? 'disabled' : ''} title="Move Left / Up">↑</button>
              <button type="button" class="cms-btn-subtle" data-move-page="${idx}" data-dir="1" ${idx === pages.length - 1 ? 'disabled' : ''} title="Move Right / Down">↓</button>
              <button type="button" class="cms-btn-subtle" data-view-page="${this.escape(p.id)}">Go</button>
              <button type="button" class="cms-btn-subtle" data-edit-page="${this.escape(p.id)}" title="Page Settings & SEO">⚙</button>
              ${!p.isSystem ? `<button type="button" class="cms-btn-subtle cms-btn-danger" data-delete-page="${this.escape(p.id)}" title="Delete Page">✕</button>` : ''}
            </div>
          </div>
        `).join('')}
      </div>

      ${builtinSections.length ? `
        <div class="cms-divider-line"><span>SECTIONS ON [${this.escape(activeTab)}]</span></div>
        <div class="cms-glass-card">
          ${builtinSections.map(sec => `
            <div style="display:flex;align-items:center;justify-content:space-between;padding:7px 0;border-bottom:1px solid rgba(255,255,255,0.06);">
              <span style="font-size:11px;">${this.escape(sec.label)}</span>
              <label class="cms-switch">
                <input type="checkbox" data-toggle-section="${sec.id}" ${vis[sec.id] !== false ? 'checked' : ''}>
              </label>
            </div>
          `).join('')}
        </div>
      ` : ''}

      <div class="cms-divider-line"><span>CREATE NEW PAGE</span></div>
      <div class="cms-glass-card">
        <div class="cms-control-group">
          <label>Page Title</label>
          <input type="text" id="cms-new-page-title" class="cms-input" placeholder="e.g. Exhibitions, Lookbooks, Press">
        </div>
        <div class="cms-control-group">
          <label>URL Slug / Tab ID</label>
          <input type="text" id="cms-new-page-id" class="cms-input" placeholder="e.g. exhibitions">
        </div>
        <div class="cms-control-group">
          <label>Opening Subtitle</label>
          <input type="text" id="cms-new-page-sub" class="cms-input" placeholder="Short architectural introduction...">
        </div>
        <button type="button" id="cms-add-page-btn" class="cms-luxury-btn">Create Page ↵</button>
      </div>
    `;

    container.querySelectorAll('[data-move-page]').forEach(btn => {
      btn.addEventListener('click', () => {
        const i = Number(btn.dataset.movePage);
        const dir = Number(btn.dataset.dir);
        const target = i + dir;
        if (target < 0 || target >= this.draft.pages.length) return;
        this.pushUndoSnapshot();
        const [moved] = this.draft.pages.splice(i, 1);
        this.draft.pages.splice(target, 0, moved);
        this.runtime.applyContent(this.draft);
        this.markDraftModified();
        this.renderPagesTab(container);
      });
    });

    container.querySelectorAll('[data-view-page]').forEach(btn => {
      btn.addEventListener('click', () => {
        window.MeauxSite?.switchTab(btn.dataset.viewPage, true);
        setTimeout(() => this.renderPagesTab(container), 60);
      });
    });

    container.querySelectorAll('[data-edit-page]').forEach(btn => {
      btn.addEventListener('click', () => this.openPageSettingsModal(btn.dataset.editPage));
    });

    container.querySelectorAll('[data-delete-page]').forEach(btn => {
      btn.addEventListener('click', () => this.deletePage(btn.dataset.deletePage));
    });

    container.querySelectorAll('[data-toggle-section]').forEach(cb => {
      cb.addEventListener('change', () => {
        this.pushUndoSnapshot();
        if (!this.draft.sectionVisibility) this.draft.sectionVisibility = {};
        this.draft.sectionVisibility[cb.dataset.toggleSection] = cb.checked;
        this.runtime.applySectionVisibility(this.draft.sectionVisibility);
        this.markDraftModified();
        this.toast(cb.checked ? 'Section visible' : 'Section hidden from visitors', 'info');
      });
    });

    const titleIn = container.querySelector('#cms-new-page-title');
    const slugIn = container.querySelector('#cms-new-page-id');
    titleIn.addEventListener('input', () => {
      slugIn.value = titleIn.value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    });

    container.querySelector('#cms-add-page-btn').addEventListener('click', () => {
      const title = titleIn.value.trim();
      const id = slugIn.value.trim();
      const subtitle = container.querySelector('#cms-new-page-sub').value.trim();
      if (!title || !id) return this.toast('Enter both page title and slug', 'warn');
      this.addPage(id, title, subtitle);
    });
  }

  openPageSettingsModal(pageId) {
    const page = (this.draft.pages || []).find(p => p.id === pageId);
    if (!page) return;
    const overlay = document.createElement('div');
    overlay.className = 'cms-modal-overlay';
    overlay.innerHTML = `
      <div class="cms-modal-card" style="max-width:480px;">
        <div class="cms-modal-header">
          <div>
            <span class="cms-eyebrow">PAGE SETTINGS &amp; SEO // #${this.escape(page.id)}</span>
            <h3 class="cms-modal-title" style="font-size:20px;">${this.escape(page.title)}</h3>
          </div>
          <button type="button" class="cms-modal-close" data-close>✕</button>
        </div>
        <div class="cms-control-group">
          <label>Navigation Label</label>
          <input type="text" id="cms-pg-nav" class="cms-input" value="${this.escape(page.navLabel || page.title)}">
        </div>
        <div class="cms-control-group">
          <label class="cms-switch">
            <input type="checkbox" id="cms-pg-show" ${page.showInNav !== false ? 'checked' : ''}>
            <span>Show in Top Navigation Bar</span>
          </label>
        </div>
        <div class="cms-control-group">
          <label>Per-Page SEO Meta Title</label>
          <input type="text" id="cms-pg-seo-title" class="cms-input" placeholder="Leave empty to use global site title" value="${this.escape(page.seoTitle || '')}">
        </div>
        <div class="cms-control-group">
          <label>Per-Page SEO Meta Description</label>
          <textarea id="cms-pg-seo-desc" class="cms-textarea" rows="3" placeholder="Custom description for search engines...">${this.escape(page.seoDescription || '')}</textarea>
        </div>
        <button type="button" id="cms-pg-save" class="cms-luxury-btn">Save Page Settings ↵</button>
      </div>
    `;
    document.body.appendChild(overlay);
    overlay.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', () => overlay.remove()));
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
    overlay.querySelector('#cms-pg-save').addEventListener('click', () => {
      this.pushUndoSnapshot();
      page.navLabel = overlay.querySelector('#cms-pg-nav').value.trim() || page.title;
      page.title = page.navLabel;
      page.showInNav = overlay.querySelector('#cms-pg-show').checked;
      page.seoTitle = overlay.querySelector('#cms-pg-seo-title').value.trim();
      page.seoDescription = overlay.querySelector('#cms-pg-seo-desc').value.trim();
      this.runtime.applyContent(this.draft);
      this.markDraftModified();
      overlay.remove();
      this.renderDrawerContent();
      this.toast(`Updated page "${page.navLabel}"`, 'success');
    });
  }

  addPage(id, title, subtitle = '') {
    if ((this.draft.pages || []).some(p => p.id === id)) {
      return this.toast('A page with this slug already exists', 'warn');
    }
    this.pushUndoSnapshot();
    this.draft.pages.push({ id, title, navLabel: title, subtitle, showInNav: true, isSystem: false, seoTitle: '', seoDescription: '' });
    this.runtime.applyContent(this.draft);
    this.markDraftModified();
    window.MeauxSite?.switchTab(id, true);
    this.renderPagesTab(document.getElementById('cms-drawer-content'));
    this.toast(`Created page "${title}"`, 'success');
  }

  async deletePage(id) {
    const ok = await this.confirmModal('Delete Page?', `Remove page "#${id}" and all of its custom section blocks?`, 'Delete Page');
    if (!ok) return;
    this.pushUndoSnapshot();
    this.draft.pages = (this.draft.pages || []).filter(p => p.id !== id);
    if (this.draft.customBlocks) delete this.draft.customBlocks[id];
    this.runtime.applyContent(this.draft);
    this.markDraftModified();
    window.MeauxSite?.switchTab('atelier', true);
    this.renderPagesTab(document.getElementById('cms-drawer-content'));
    this.toast(`Deleted page "${id}"`, 'info');
  }

  /* -------------------------------------------------------------------
     MODULE 2: SQUARESPACE-STYLE SECTION BLOCK BUILDER (10 BLOCK TYPES)
     ------------------------------------------------------------------- */
  renderBlocksTab(container) {
    const currentTab = window.MeauxSite ? window.MeauxSite.getActiveTab() : 'atelier';
    const blocks = (this.draft.customBlocks && this.draft.customBlocks[currentTab]) || [];

    container.innerHTML = `
      <div class="cms-section-head">
        <h4>Section Blocks</h4>
        <span class="cms-badge info">${this.escape(currentTab)}</span>
      </div>
      <p class="cms-muted-note">Add, reorder, duplicate, or customize architectural sections on the active page — just like Squarespace Fluid Engine.</p>

      ${blocks.length ? `
        <div class="cms-control-group">
          <label>Custom Blocks on [${this.escape(currentTab)}] (${blocks.length})</label>
          ${blocks.map((b, idx) => `
            <div class="cms-list-item">
              <div style="min-width:0;flex:1;">
                <strong style="font-size:11px;text-transform:uppercase;color:var(--cms-cyan);">${this.escape(b.type)}</strong>
                <div style="font-size:10px;color:var(--cms-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${this.escape(b.title || b.heading || b.quote || b.caption || b.id)}</div>
              </div>
              <div class="cms-inline-row" style="gap:4px;">
                <button type="button" class="cms-btn-subtle" data-bact="up" data-bid="${b.id}" ${idx === 0 ? 'disabled' : ''}>↑</button>
                <button type="button" class="cms-btn-subtle" data-bact="down" data-bid="${b.id}" ${idx === blocks.length - 1 ? 'disabled' : ''}>↓</button>
                <button type="button" class="cms-btn-subtle" data-bact="edit" data-bid="${b.id}">✎</button>
                <button type="button" class="cms-btn-subtle" data-bact="dup" data-bid="${b.id}">⧉</button>
                <button type="button" class="cms-btn-subtle cms-btn-danger" data-bact="del" data-bid="${b.id}">✕</button>
              </div>
            </div>
          `).join('')}
        </div>
        <div class="cms-divider-line"><span>ADD NEW BLOCK</span></div>
      ` : ''}

      <div style="display:flex;flex-direction:column;gap:8px;">
        ${BLOCK_CATALOG.map(blk => `
          <button type="button" class="cms-block-card" data-add-block="${blk.type}">
            <div>
              <strong>${this.escape(blk.name)}</strong>
              <p>${this.escape(blk.desc)}</p>
            </div>
            <span class="cms-block-plus">+</span>
          </button>
        `).join('')}
      </div>
    `;

    container.querySelectorAll('[data-add-block]').forEach(btn => {
      btn.addEventListener('click', () => this.addSectionBlock(currentTab, btn.dataset.addBlock));
    });

    container.querySelectorAll('[data-bact]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const act = btn.dataset.bact;
        const bid = btn.dataset.bid;
        if (act === 'up') this.moveSectionBlock(currentTab, bid, -1);
        else if (act === 'down') this.moveSectionBlock(currentTab, bid, 1);
        else if (act === 'dup') this.duplicateSectionBlock(currentTab, bid);
        else if (act === 'edit') this.openBlockEditorModal(currentTab, bid);
        else if (act === 'del') await this.deleteSectionBlock(currentTab, bid);
      });
    });
  }

  addSectionBlock(pageId, type) {
    const def = BLOCK_CATALOG.find(b => b.type === type);
    if (!def) return;
    this.pushUndoSnapshot();
    if (!this.draft.customBlocks) this.draft.customBlocks = {};
    if (!this.draft.customBlocks[pageId]) this.draft.customBlocks[pageId] = [];

    const id = 'blk_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6);
    const newBlock = { id, type, ...def.defaults() };
    this.draft.customBlocks[pageId].push(newBlock);
    this.runtime.applyContent(this.draft);
    this.markDraftModified();
    this.toggleEditMode(true);
    this.renderDrawerContent();
    this.toast(`Added "${def.name}" to [${pageId}]`, 'success');
    const el = document.querySelector(`[data-block-id="${id}"]`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  moveSectionBlock(pageId, blockId, dir) {
    const list = this.draft.customBlocks?.[pageId];
    if (!list) return;
    const idx = list.findIndex(b => b.id === blockId);
    const target = idx + dir;
    if (idx < 0 || target < 0 || target >= list.length) return;
    this.pushUndoSnapshot();
    const [moved] = list.splice(idx, 1);
    list.splice(target, 0, moved);
    this.runtime.applyContent(this.draft);
    if (this.isEditMode) this.toggleEditMode(true);
    this.markDraftModified();
    this.renderDrawerContent();
  }

  duplicateSectionBlock(pageId, blockId) {
    const list = this.draft.customBlocks?.[pageId];
    if (!list) return;
    const idx = list.findIndex(b => b.id === blockId);
    if (idx < 0) return;
    this.pushUndoSnapshot();
    const clone = JSON.parse(JSON.stringify(list[idx]));
    clone.id = 'blk_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6);
    list.splice(idx + 1, 0, clone);
    this.runtime.applyContent(this.draft);
    if (this.isEditMode) this.toggleEditMode(true);
    this.markDraftModified();
    this.renderDrawerContent();
    this.toast('Duplicated section block', 'success');
  }

  async deleteSectionBlock(pageId, blockId) {
    const ok = await this.confirmModal('Delete Section Block?', 'Remove this custom section from the page?', 'Delete');
    if (!ok) return;
    const list = this.draft.customBlocks?.[pageId];
    if (!list) return;
    this.pushUndoSnapshot();
    this.draft.customBlocks[pageId] = list.filter(b => b.id !== blockId);
    this.runtime.applyContent(this.draft);
    if (this.isEditMode) this.toggleEditMode(true);
    this.markDraftModified();
    this.renderDrawerContent();
    this.toast('Removed section block', 'info');
  }

  openBlockEditorModal(pageId, blockId) {
    const list = this.draft.customBlocks?.[pageId] || [];
    const block = list.find(b => b.id === blockId);
    if (!block) return;

    const existing = document.getElementById('cms-block-editor-modal');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'cms-block-editor-modal';
    overlay.className = 'cms-modal-overlay';

    let fieldsHtml = '';
    if (block.type === 'heading-text') {
      fieldsHtml = `
        <div class="cms-control-group"><label>Eyebrow Tagline</label><input id="bf-tagline" class="cms-input" value="${this.escape(block.tagline || '')}"></div>
        <div class="cms-control-group"><label>Display Title</label><input id="bf-title" class="cms-input" value="${this.escape(block.title || '')}"></div>
        <div class="cms-control-group"><label>Editorial Subtitle</label><textarea id="bf-subtitle" class="cms-textarea" rows="3">${this.escape(block.subtitle || '')}</textarea></div>
        <div class="cms-control-group"><label>Alignment</label><select id="bf-align" class="cms-select"><option value="left" ${block.align !== 'center' ? 'selected' : ''}>Left</option><option value="center" ${block.align === 'center' ? 'selected' : ''}>Centered</option></select></div>
      `;
    } else if (block.type === 'narrative') {
      fieldsHtml = `
        <div class="cms-control-group"><label>Heading</label><input id="bf-heading" class="cms-input" value="${this.escape(block.heading || '')}"></div>
        <div class="cms-control-group"><label>Story Body</label><textarea id="bf-body" class="cms-textarea" rows="4">${this.escape(block.body || '')}</textarea></div>
        <div class="cms-control-group"><label>Image URL</label><input id="bf-img" class="cms-input" value="${this.escape(block.imageUrl || '')}"></div>
        <div class="cms-control-group"><label>Image Caption</label><input id="bf-cap" class="cms-input" value="${this.escape(block.imageCaption || '')}"></div>
        <label class="cms-switch"><input type="checkbox" id="bf-rev" ${block.reversed ? 'checked' : ''}><span>Flip Layout (Image Right / Text Left)</span></label>
      `;
    } else if (block.type === 'quote') {
      fieldsHtml = `
        <div class="cms-control-group"><label>Monumental Quote</label><textarea id="bf-quote" class="cms-textarea" rows="3">${this.escape(block.quote || '')}</textarea></div>
        <div class="cms-control-group"><label>Attribution</label><input id="bf-author" class="cms-input" value="${this.escape(block.author || '')}"></div>
        <div class="cms-control-group"><label>Alignment</label><select id="bf-align" class="cms-select"><option value="left" ${block.align !== 'center' ? 'selected' : ''}>Left</option><option value="center" ${block.align === 'center' ? 'selected' : ''}>Centered</option></select></div>
      `;
    } else if (block.type === 'gallery') {
      const imgs = block.images || [];
      fieldsHtml = `
        <div class="cms-grid-2">
          <div class="cms-control-group"><label>Gallery Title</label><input id="bf-title" class="cms-input" value="${this.escape(block.title || '')}"></div>
          <div class="cms-control-group"><label>Columns</label><select id="bf-cols" class="cms-select"><option value="2" ${Number(block.columns) === 2 ? 'selected' : ''}>2 Columns</option><option value="3" ${Number(block.columns || 3) === 3 ? 'selected' : ''}>3 Columns</option><option value="4" ${Number(block.columns) === 4 ? 'selected' : ''}>4 Columns</option></select></div>
        </div>
        <div class="cms-control-group">
          <label>Gallery Images JSON (url, title, subtitle)</label>
          <textarea id="bf-gallery-json" class="cms-textarea" rows="8">${this.escape(JSON.stringify(imgs, null, 2))}</textarea>
        </div>
      `;
    } else if (block.type === 'cta-banner') {
      fieldsHtml = `
        <div class="cms-control-group"><label>Headline</label><input id="bf-title" class="cms-input" value="${this.escape(block.title || '')}"></div>
        <div class="cms-control-group"><label>Description</label><textarea id="bf-body" class="cms-textarea" rows="3">${this.escape(block.body || '')}</textarea></div>
        <div class="cms-grid-2">
          <div class="cms-control-group"><label>Button Label</label><input id="bf-btn-label" class="cms-input" value="${this.escape(block.buttonLabel || '')}"></div>
          <div class="cms-control-group"><label>Target (#enquiries or https://...)</label><input id="bf-btn-target" class="cms-input" value="${this.escape(block.buttonTarget || '#enquiries')}"></div>
        </div>
      `;
    } else if (block.type === 'video-embed') {
      fieldsHtml = `
        <div class="cms-control-group"><label>Section Title</label><input id="bf-title" class="cms-input" value="${this.escape(block.title || '')}"></div>
        <div class="cms-control-group"><label>YouTube, Vimeo, or MP4 Video URL</label><input id="bf-vurl" class="cms-input" placeholder="https://www.youtube.com/watch?v=..." value="${this.escape(block.videoUrl || '')}"></div>
        <div class="cms-control-group"><label>Caption</label><input id="bf-cap" class="cms-input" value="${this.escape(block.caption || '')}"></div>
      `;
    } else if (block.type === 'spacer-divider') {
      fieldsHtml = `
        <div class="cms-control-group"><label>Height (px)</label><input type="number" id="bf-height" class="cms-input" min="16" max="240" value="${Number(block.height) || 64}"></div>
        <label class="cms-switch"><input type="checkbox" id="bf-line" ${block.showLine !== false ? 'checked' : ''}><span>Display Chrome Hairline Divider</span></label>
      `;
    } else if (block.type === 'metrics-strip' || block.type === 'accordion') {
      fieldsHtml = `
        ${block.type === 'accordion' ? `<div class="cms-control-group"><label>Section Title</label><input id="bf-title" class="cms-input" value="${this.escape(block.title || '')}"></div>` : ''}
        <div class="cms-control-group">
          <label>Items (JSON Array)</label>
          <textarea id="bf-items-json" class="cms-textarea" rows="10">${this.escape(JSON.stringify(block.items || [], null, 2))}</textarea>
        </div>
      `;
    } else {
      fieldsHtml = `
        <div class="cms-control-group"><label>Custom HTML / Embed Code</label><textarea id="bf-html" class="cms-textarea" rows="10">${this.escape(block.html || '')}</textarea></div>
      `;
    }

    overlay.innerHTML = `
      <div class="cms-modal-card" style="max-width:600px;">
        <div class="cms-modal-header">
          <div>
            <span class="cms-eyebrow">BLOCK INSPECTOR // ${this.escape(block.type)}</span>
            <h3 class="cms-modal-title" style="font-size:20px;">Edit Section Properties</h3>
          </div>
          <button type="button" class="cms-modal-close" data-close>✕</button>
        </div>
        <div class="cms-modal-scroll">${fieldsHtml}</div>
        <div style="margin-top:14px;">
          <button type="button" id="cms-block-save-btn" class="cms-luxury-btn">Apply Section Changes ↵</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    overlay.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', () => overlay.remove()));
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });

    overlay.querySelector('#cms-block-save-btn').addEventListener('click', () => {
      this.pushUndoSnapshot();
      try {
        if (block.type === 'heading-text') {
          block.tagline = overlay.querySelector('#bf-tagline').value;
          block.title = overlay.querySelector('#bf-title').value;
          block.subtitle = overlay.querySelector('#bf-subtitle').value;
          block.align = overlay.querySelector('#bf-align').value;
        } else if (block.type === 'narrative') {
          block.heading = overlay.querySelector('#bf-heading').value;
          block.body = overlay.querySelector('#bf-body').value;
          block.imageUrl = overlay.querySelector('#bf-img').value.trim();
          block.imageCaption = overlay.querySelector('#bf-cap').value;
          block.reversed = overlay.querySelector('#bf-rev').checked;
        } else if (block.type === 'quote') {
          block.quote = overlay.querySelector('#bf-quote').value;
          block.author = overlay.querySelector('#bf-author').value;
          block.align = overlay.querySelector('#bf-align').value;
        } else if (block.type === 'gallery') {
          block.title = overlay.querySelector('#bf-title').value;
          block.columns = Number(overlay.querySelector('#bf-cols').value) || 3;
          block.images = JSON.parse(overlay.querySelector('#bf-gallery-json').value);
        } else if (block.type === 'cta-banner') {
          block.title = overlay.querySelector('#bf-title').value;
          block.body = overlay.querySelector('#bf-body').value;
          block.buttonLabel = overlay.querySelector('#bf-btn-label').value;
          block.buttonTarget = overlay.querySelector('#bf-btn-target').value.trim();
        } else if (block.type === 'video-embed') {
          block.title = overlay.querySelector('#bf-title').value;
          block.videoUrl = overlay.querySelector('#bf-vurl').value.trim();
          block.caption = overlay.querySelector('#bf-cap').value;
        } else if (block.type === 'spacer-divider') {
          block.height = Number(overlay.querySelector('#bf-height').value) || 64;
          block.showLine = overlay.querySelector('#bf-line').checked;
        } else if (block.type === 'metrics-strip' || block.type === 'accordion') {
          if (block.type === 'accordion') block.title = overlay.querySelector('#bf-title').value;
          block.items = JSON.parse(overlay.querySelector('#bf-items-json').value);
        } else {
          block.html = overlay.querySelector('#bf-html').value;
        }
      } catch (err) {
        return this.toast('Invalid JSON format: ' + err.message, 'error');
      }

      this.runtime.applyContent(this.draft);
      if (this.isEditMode) this.toggleEditMode(true);
      this.markDraftModified();
      this.renderDrawerContent();
      overlay.remove();
      this.toast('Section block updated', 'success');
    });
  }

  /* -------------------------------------------------------------------
     MODULE 3: SITE STYLES, TYPOGRAPHY, ANNOUNCEMENT BAR, VAULT & CUSTOM CSS
     ------------------------------------------------------------------- */
  renderStylesTab(container) {
    const theme = this.draft.theme || {};
    const colors = theme.colors || {};
    const bar = this.draft.announcementBar || {};
    const brand = this.draft.brand || {};
    const vault = this.draft.vault || {};

    const fontsHtml = GOOGLE_FONTS.map(f => `<option value="${f.family}">${f.name}</option>`).join('');

    container.innerHTML = `
      <div class="cms-section-head">
        <h4>Site Styles &amp; Brand OS</h4>
        <span class="cms-badge info">Live Sync</span>
      </div>

      <!-- Luxury Theme Presets -->
      <div class="cms-control-group">
        <label>One-Click Atelier Style Presets</label>
        <div class="cms-grid-2">
          ${THEME_PRESETS.map(p => `
            <button type="button" class="cms-preset-card ${theme.preset === p.id ? 'active' : ''}" data-preset="${p.id}">
              <div class="cms-preset-swatches">
                <span style="background:${p.colors.obsidian}"></span>
                <span style="background:${p.colors.panelBg}"></span>
                <span style="background:${p.colors.accent}"></span>
                <span style="background:${p.colors.paper}"></span>
              </div>
              <strong style="font-size:11px;color:#fff;">${this.escape(p.name)}</strong>
              <span style="font-size:9px;color:var(--cms-muted);text-transform:uppercase;">${this.escape(p.tag)}</span>
            </button>
          `).join('')}
        </div>
      </div>

      <div class="cms-divider-line"><span>TYPOGRAPHY (AUTO-LOADS GOOGLE FONTS)</span></div>
      <div class="cms-glass-card">
        <div class="cms-control-group">
          <label>Display Font (Headings)</label>
          <select id="cms-font-display" class="cms-select">${fontsHtml}</select>
        </div>
        <div class="cms-control-group">
          <label>Editorial Serif (Quotes &amp; Subtitles)</label>
          <select id="cms-font-serif" class="cms-select">${fontsHtml}</select>
        </div>
        <div class="cms-control-group" style="margin-bottom:0;">
          <label>Monospace / Technical UI</label>
          <select id="cms-font-mono" class="cms-select">${fontsHtml}</select>
        </div>
      </div>

      <div class="cms-divider-line"><span>COLOR PALETTE &amp; GEOMETRY</span></div>
      <div class="cms-glass-card">
        <div class="cms-grid-3" style="margin-bottom:14px;">
          ${[
            ['obsidian', 'Canvas', colors.obsidian || '#050506'],
            ['paper', 'Text / Ink', colors.paper || '#f4f4f0'],
            ['panelBg', 'Panels', colors.panelBg || '#0e0e10'],
            ['accent', 'Accent', colors.accent || '#c5a880'],
            ['line', 'Hairlines', colors.line || '#27272a'],
            ['muted', 'Muted', colors.muted || '#8e8e8a']
          ].map(([key, lbl, val]) => `
            <div>
              <label class="cms-field-label">${lbl}</label>
              <input type="color" class="cms-color-native" data-theme-color="${key}" value="${val}" style="width:100%;height:36px;">
            </div>
          `).join('')}
        </div>

        <div class="cms-control-group">
          <div class="cms-slider-head"><label style="margin:0;">Type Scale</label><span id="cms-scale-val">${Math.round((theme.typeScale || 1) * 100)}%</span></div>
          <input type="range" id="cms-type-scale" class="cms-range" min="0.88" max="1.15" step="0.01" value="${theme.typeScale || 1}">
        </div>

        <div class="cms-control-group">
          <div class="cms-slider-head"><label style="margin:0;">Card Corner Radius</label><span id="cms-radius-val">${Number(theme.borderRadius || 0)}px</span></div>
          <input type="range" id="cms-border-radius" class="cms-range" min="0" max="24" step="2" value="${Number(theme.borderRadius || 0)}">
        </div>

        <label class="cms-switch">
          <input type="checkbox" id="cms-grayscale-toggle" ${theme.imageGrayscale ? 'checked' : ''}>
          <span>Editorial Monochrome Photography Filter</span>
        </label>
      </div>

      <div class="cms-divider-line"><span>ANNOUNCEMENT BAR</span></div>
      <div class="cms-glass-card">
        <div class="cms-control-group">
          <label class="cms-switch">
            <input type="checkbox" id="cms-ann-enabled" ${bar.enabled ? 'checked' : ''}>
            <span>Enable Top Announcement Banner</span>
          </label>
        </div>
        <div class="cms-control-group">
          <label>Banner Copy</label>
          <input type="text" id="cms-ann-text" class="cms-input" value="${this.escape(bar.text || '')}">
        </div>
        <div class="cms-grid-2">
          <div class="cms-control-group"><label>Link Text</label><input type="text" id="cms-ann-link-label" class="cms-input" value="${this.escape(bar.linkLabel || 'Inquire ↗')}"></div>
          <div class="cms-control-group"><label>Link URL / #Tab</label><input type="text" id="cms-ann-link-href" class="cms-input" value="${this.escape(bar.linkHref || '#enquiries')}"></div>
        </div>
        <div class="cms-grid-3">
          <div><label class="cms-field-label">Background</label><input type="color" id="cms-ann-bg" class="cms-color-native" value="${bar.bgColor || '#0e1118'}" style="width:100%;height:32px;"></div>
          <div><label class="cms-field-label">Text</label><input type="color" id="cms-ann-fg" class="cms-color-native" value="${bar.textColor || '#f4f4f0'}" style="width:100%;height:32px;"></div>
          <div><label class="cms-field-label">Link Accent</label><input type="color" id="cms-ann-acc" class="cms-color-native" value="${bar.accentColor || '#38bdf8'}" style="width:100%;height:32px;"></div>
        </div>
      </div>

      <div class="cms-divider-line"><span>BRAND IDENTITY &amp; VAULT ENTRANCE</span></div>
      <div class="cms-glass-card">
        <div class="cms-grid-2">
          <div class="cms-control-group"><label>Brand Wordmark</label><input type="text" id="cms-brand-name" class="cms-input" value="${this.escape(brand.name || 'MEAUX')}"></div>
          <div class="cms-control-group"><label>Emblem Symbol</label><input type="text" id="cms-brand-symbol" class="cms-input" value="${this.escape(brand.symbol ?? '✳')}"></div>
        </div>
        <div class="cms-control-group">
          <label class="cms-switch">
            <input type="checkbox" id="cms-vault-enabled" ${vault.enabled !== false ? 'checked' : ''}>
            <span>Show 3D Leather Vault Entrance on Load</span>
          </label>
        </div>
        <div class="cms-grid-2">
          <div class="cms-control-group"><label>Vault Kicker</label><input type="text" id="cms-vault-kicker" class="cms-input" value="${this.escape(vault.kicker || '')}"></div>
          <div class="cms-control-group"><label>Vault Enter Button</label><input type="text" id="cms-vault-enter" class="cms-input" value="${this.escape(vault.enterLabel || 'ENTER THE ATELIER')}"></div>
        </div>
        <div class="cms-control-group">
          <label>Vault Typewriter Disciplines (One per line)</label>
          <textarea id="cms-vault-disciplines" class="cms-textarea" rows="4">${this.escape((vault.disciplines || []).join('\n'))}</textarea>
        </div>
        <button type="button" id="cms-save-brand-vault-btn" class="cms-holo-btn">Apply Brand, Banner &amp; Vault ↵</button>
      </div>

      <div class="cms-divider-line"><span>CUSTOM CSS OVERRIDES</span></div>
      <div class="cms-glass-card">
        <textarea id="cms-custom-css" class="cms-textarea" rows="5" placeholder="/* Live CSS overrides for your atelier */">${this.escape(theme.customCss || '')}</textarea>
        <button type="button" id="cms-apply-css-btn" class="cms-btn-subtle" style="margin-top:8px;width:100%;">Apply Custom CSS ↵</button>
      </div>
    `;

    // Initialize font dropdowns
    if (theme.fontDisplay) container.querySelector('#cms-font-display').value = theme.fontDisplay;
    if (theme.fontSerif) container.querySelector('#cms-font-serif').value = theme.fontSerif;
    if (theme.fontMono) container.querySelector('#cms-font-mono').value = theme.fontMono;

    const applyLiveTheme = () => {
      this.runtime.applyTheme(this.draft.theme);
      this.markDraftModified();
    };

    // Presets
    container.querySelectorAll('[data-preset]').forEach(btn => {
      btn.addEventListener('click', () => {
        const p = THEME_PRESETS.find(x => x.id === btn.dataset.preset);
        if (!p) return;
        this.pushUndoSnapshot();
        this.draft.theme = {
          ...(this.draft.theme || {}),
          preset: p.id,
          fontDisplay: p.fontDisplay,
          fontSerif: p.fontSerif,
          fontMono: p.fontMono,
          borderRadius: p.borderRadius,
          colors: { ...p.colors }
        };
        applyLiveTheme();
        this.renderStylesTab(container);
        this.toast(`Applied "${p.name}" preset`, 'success');
      });
    });

    // Live Google Font switching
    ['display', 'serif', 'mono'].forEach(k => {
      const prop = k === 'display' ? 'fontDisplay' : k === 'serif' ? 'fontSerif' : 'fontMono';
      container.querySelector(`#cms-font-${k}`).addEventListener('change', (e) => {
        this.pushUndoSnapshot();
        if (!this.draft.theme) this.draft.theme = {};
        this.draft.theme[prop] = e.target.value;
        loadGoogleFont(e.target.value);
        applyLiveTheme();
      });
    });

    // Live color pickers
    container.querySelectorAll('[data-theme-color]').forEach(inp => {
      inp.addEventListener('input', (e) => {
        if (!this.draft.theme) this.draft.theme = {};
        if (!this.draft.theme.colors) this.draft.theme.colors = {};
        this.draft.theme.colors[inp.dataset.themeColor] = e.target.value;
        applyLiveTheme();
      });
    });

    container.querySelector('#cms-type-scale').addEventListener('input', (e) => {
      const v = Number(e.target.value);
      container.querySelector('#cms-scale-val').textContent = `${Math.round(v * 100)}%`;
      if (!this.draft.theme) this.draft.theme = {};
      this.draft.theme.typeScale = v;
      applyLiveTheme();
    });

    container.querySelector('#cms-border-radius').addEventListener('input', (e) => {
      const v = Number(e.target.value);
      container.querySelector('#cms-radius-val').textContent = `${v}px`;
      if (!this.draft.theme) this.draft.theme = {};
      this.draft.theme.borderRadius = v;
      applyLiveTheme();
    });

    container.querySelector('#cms-grayscale-toggle').addEventListener('change', (e) => {
      if (!this.draft.theme) this.draft.theme = {};
      this.draft.theme.imageGrayscale = e.target.checked;
      applyLiveTheme();
    });

    container.querySelector('#cms-save-brand-vault-btn').addEventListener('click', () => {
      this.pushUndoSnapshot();
      this.draft.announcementBar = {
        enabled: container.querySelector('#cms-ann-enabled').checked,
        text: container.querySelector('#cms-ann-text').value.trim(),
        linkLabel: container.querySelector('#cms-ann-link-label').value.trim(),
        linkHref: container.querySelector('#cms-ann-link-href').value.trim(),
        bgColor: container.querySelector('#cms-ann-bg').value,
        textColor: container.querySelector('#cms-ann-fg').value,
        accentColor: container.querySelector('#cms-ann-acc').value
      };
      this.draft.brand = {
        ...(this.draft.brand || {}),
        name: container.querySelector('#cms-brand-name').value.trim() || 'MEAUX',
        symbol: container.querySelector('#cms-brand-symbol').value.trim()
      };
      this.draft.vault = {
        ...(this.draft.vault || {}),
        enabled: container.querySelector('#cms-vault-enabled').checked,
        kicker: container.querySelector('#cms-vault-kicker').value.trim(),
        enterLabel: container.querySelector('#cms-vault-enter').value.trim(),
        disciplines: container.querySelector('#cms-vault-disciplines').value.split('\n').map(s => s.trim()).filter(Boolean)
      };
      this.runtime.applyContent(this.draft);
      this.markDraftModified();
      this.toast('Brand, Announcement Bar & Vault updated', 'success');
    });

    container.querySelector('#cms-apply-css-btn').addEventListener('click', () => {
      this.pushUndoSnapshot();
      if (!this.draft.theme) this.draft.theme = {};
      this.draft.theme.customCss = container.querySelector('#cms-custom-css').value;
      applyLiveTheme();
      this.toast('Custom CSS injected live', 'success');
    });
  }

  /* -------------------------------------------------------------------
     MODULE 4: BACKGROUNDS & MATERIAL SURFACES STUDIO
     (Initial Page / Vault · Entire Site · Per-Page · Custom Photo)
     ------------------------------------------------------------------- */
  bindVaultDropzone() {
    const vault = document.getElementById('leather-vault');
    if (!vault || vault.__cmsDropBound) return;
    vault.__cmsDropBound = true;

    vault.addEventListener('dragover', (e) => {
      if (vault.hidden) return;
      e.preventDefault();
    });

    vault.addEventListener('drop', async (e) => {
      if (vault.hidden) return;
      e.preventDefault();
      let url = '';
      if (e.dataTransfer.files && e.dataTransfer.files.length) {
        url = await this.uploadMediaFile(e.dataTransfer.files[0], 'blob', { category: 'Photography' });
      } else {
        const raw = e.dataTransfer.getData('application/x-meaux-asset') || e.dataTransfer.getData('text/plain');
        try { url = JSON.parse(raw).url; } catch (err) {}
      }
      if (url) {
        this.surfaceScope = 'vault';
        this.pushUndoSnapshot();
        const def = getSurfaceDef('custom-photo');
        this.updateSurfaceConfig({ surfaceId: 'custom-photo', ...def.defaults, imageUrl: url }, true);
        this.toast('Applied photo as Initial Page background', 'success');
      }
    });

    document.addEventListener('meaux:vault-state', () => {
      if (this.activeDrawerTab === 'backgrounds') {
        const container = document.getElementById('cms-drawer-content');
        if (container) this.renderBackgroundsTab(container);
      }
    });
  }

  getEditableSurfaceConfig(scope, activeTab) {
    const bg = this.draft.backgrounds || {};
    const existing = scope === 'vault'
      ? bg.vault
      : (scope === 'page' ? (bg.pages && bg.pages[activeTab]) : bg.global);
    if (existing && existing.surfaceId) return { ...existing };
    return { surfaceId: 'default', ...getSurfaceDef('default').defaults };
  }

  updateSurfaceConfig(partial, reRender = false) {
    const activeTab = window.MeauxSite ? window.MeauxSite.getActiveTab() : 'atelier';
    if (!this.draft.backgrounds) this.draft.backgrounds = { vault: null, global: null, pages: {} };
    if (!this.draft.backgrounds.pages) this.draft.backgrounds.pages = {};

    const current = this.getEditableSurfaceConfig(this.surfaceScope, activeTab);
    const next = { ...current, ...partial };

    if (this.surfaceScope === 'vault') {
      if (next.surfaceId === 'default') this.draft.backgrounds.vault = null;
      else this.draft.backgrounds.vault = next;
    } else if (this.surfaceScope === 'page') {
      if (next.surfaceId === 'default') delete this.draft.backgrounds.pages[activeTab];
      else this.draft.backgrounds.pages[activeTab] = next;
    } else {
      if (next.surfaceId === 'default') this.draft.backgrounds.global = null;
      else this.draft.backgrounds.global = next;
    }

    applyActiveSurface(this.draft.backgrounds, activeTab);
    this.markDraftModified();
    if (reRender) {
      const container = document.getElementById('cms-drawer-content');
      if (container && this.activeDrawerTab === 'backgrounds') this.renderBackgroundsTab(container);
    }
  }

  openSurfacePhotoPicker(onSelectUrl) {
    const overlay = document.createElement('div');
    overlay.className = 'cms-modal-overlay';
    let search = '';
    let cat = 'all';

    overlay.innerHTML = `
      <div class="cms-modal-card wide">
        <div class="cms-modal-header">
          <div>
            <span class="cms-eyebrow">SURFACE BACKDROP // SELECT PHOTO</span>
            <h3 class="cms-modal-title" style="font-size:20px;">Choose Background Photograph</h3>
          </div>
          <button type="button" class="cms-modal-close" data-close>✕</button>
        </div>
        <div class="cms-inline-row" style="margin-bottom:10px;">
          <input type="search" id="cms-sp-search" class="cms-input" placeholder="Search assets by title, category, #tag..." style="flex:1;">
        </div>
        <div class="cms-filter-strip" style="margin-bottom:10px;">
          <button type="button" class="cms-filter-chip active" data-sp-cat="all">All</button>
          ${this.mediaCategories.map(c => `<button type="button" class="cms-filter-chip" data-sp-cat="${this.escape(c.name)}"><span class="cms-cat-dot" style="background:${this.escape(c.color)};"></span>${this.escape(c.name)}</button>`).join('')}
        </div>
        <div class="cms-modal-scroll">
          <div class="cms-media-grid cols-3" id="cms-sp-grid"></div>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    const renderGrid = () => {
      const grid = overlay.querySelector('#cms-sp-grid');
      const items = this.getFilteredAssets({ search, category: cat, tag: '', source: 'all' });
      grid.innerHTML = items.map(a => this.renderAssetCardHtml(a, { mode: 'picker' })).join('');
      this.bindAssetCardEvents(grid, {
        onPick: (asset) => {
          onSelectUrl(asset.url, asset.focal_point || 'center center');
          overlay.remove();
        }
      });
    };
    renderGrid();

    overlay.querySelector('#cms-sp-search').addEventListener('input', (e) => { search = e.target.value; renderGrid(); });
    overlay.querySelectorAll('[data-sp-cat]').forEach(btn => {
      btn.addEventListener('click', () => {
        cat = btn.dataset.spCat;
        overlay.querySelectorAll('[data-sp-cat]').forEach(b => b.classList.toggle('active', b === btn));
        renderGrid();
      });
    });
    overlay.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', () => overlay.remove()));
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
  }

  renderBackgroundsTab(container) {
    const activeTab = window.MeauxSite ? window.MeauxSite.getActiveTab() : 'atelier';
    const isVaultVisible = window.MeauxSite ? !window.MeauxSite.isVaultOpen() : false;
    const cfg = this.getEditableSurfaceConfig(this.surfaceScope, activeTab);
    const activeDef = getSurfaceDef(cfg.surfaceId);
    const isPattern = activeDef.type === 'image' || activeDef.type === 'pattern';
    const isPhoto = activeDef.type === 'custom-photo';
    const isActive = activeDef.type !== 'default';

    const categories = [
      { id: 'all', label: 'All' },
      { id: 'photo', label: 'Photo' },
      { id: 'leather', label: 'Leather & Silk' },
      { id: 'stone', label: 'Concrete & Stone' },
      { id: 'chrome', label: 'Chrome & Metal' },
      { id: 'solid', label: 'Solid' }
    ];
    const filteredSurfaces = SURFACE_CATALOG.filter(s => this.surfaceCategory === 'all' || s.category === this.surfaceCategory);
    const vaultHasOverride = Boolean(this.draft.backgrounds?.vault?.surfaceId && this.draft.backgrounds.vault.surfaceId !== 'default');
    const globalHasOverride = Boolean(this.draft.backgrounds?.global?.surfaceId && this.draft.backgrounds.global.surfaceId !== 'default');
    const pageHasOverride = Boolean(this.draft.backgrounds?.pages?.[activeTab]);

    container.innerHTML = `
      <div class="cms-section-head">
        <h4>Background Surfaces</h4>
        <span class="cms-badge info">${this.escape(activeDef.name)}</span>
      </div>

      <div class="cms-control-group">
        <label>Target Background Layer</label>
        <div class="cms-scope-toggle">
          <button type="button" class="cms-scope-btn ${this.surfaceScope === 'vault' ? 'active' : ''}" data-surface-scope="vault">Initial Page${vaultHasOverride ? ' •' : ''}</button>
          <button type="button" class="cms-scope-btn ${this.surfaceScope === 'global' ? 'active' : ''}" data-surface-scope="global">Entire Site${globalHasOverride ? ' •' : ''}</button>
          <button type="button" class="cms-scope-btn ${this.surfaceScope === 'page' ? 'active' : ''}" data-surface-scope="page">${this.escape(activeTab)}${pageHasOverride ? ' •' : ''}</button>
        </div>
      </div>

      ${this.surfaceScope === 'vault' ? `
        <div class="cms-glass-card" style="display:flex;align-items:center;justify-content:space-between;gap:10px;">
          <div style="min-width:0;">
            <strong style="display:block;font-size:11px;color:#fff;">Initial Entrance (3D Vault)</strong>
            <span style="font-size:9.5px;color:var(--cms-muted);">Replaces the default black screen behind the chrome ring.</span>
          </div>
          <button type="button" class="cms-btn-subtle ${isVaultVisible ? 'active' : ''}" id="cms-toggle-vault-preview-btn">
            ${isVaultVisible ? 'Exit Preview →' : '👁 Preview Live'}
          </button>
        </div>
      ` : ''}

      <div class="cms-control-group">
        <div class="cms-cat-pills">
          ${categories.map(c => `<button type="button" class="cms-cat-pill ${this.surfaceCategory === c.id ? 'active' : ''}" data-surface-cat="${c.id}">${c.label}</button>`).join('')}
        </div>
        <div class="cms-surface-grid">
          ${filteredSurfaces.map(s => {
            const isSelected = s.id === cfg.surfaceId;
            const previewStyle = buildSurfacePreviewStyle(s.id, isSelected ? { color: cfg.color, finish: cfg.finish, imageUrl: cfg.imageUrl } : {});
            return `
              <button type="button" class="cms-surface-card ${isSelected ? 'active' : ''}" data-select-surface="${s.id}">
                <span class="cms-surface-preview" style="${previewStyle}"></span>
                <span class="cms-surface-info"><strong>${this.escape(s.name)}</strong><span>${this.escape(s.tag)}</span></span>
              </button>
            `;
          }).join('')}
        </div>
      </div>

      ${isActive ? `
        <div class="cms-divider-line"><span>SURFACE CALIBRATION</span></div>
        <div class="cms-glass-card">
          ${isPhoto ? `
            <div class="cms-control-group">
              <label>Background Photograph</label>
              <div class="cms-inline-row" style="margin-bottom:8px;">
                <button type="button" id="cms-surface-pick-photo-btn" class="cms-holo-btn" style="padding:8px 10px;font-size:10px;">⊞ Pick from Media Vault</button>
                <label class="cms-btn-subtle" style="cursor:pointer;padding:8px 10px;">
                  <span>+ Upload</span>
                  <input type="file" id="cms-surface-upload-photo" accept="image/*" hidden>
                </label>
              </div>
              <input type="url" id="cms-surface-photo-url" class="cms-input" placeholder="https://... or local path" value="${this.escape(cfg.imageUrl || activeDef.defaults.imageUrl || '')}">
            </div>

            <div class="cms-control-group">
              <div class="cms-slider-head"><label style="margin:0;">Photo Opacity</label><span id="cms-surface-intensity-val">${Math.round((cfg.intensity ?? activeDef.defaults.intensity) * 100)}%</span></div>
              <input type="range" id="cms-surface-intensity" class="cms-range" min="0.1" max="1" step="0.01" value="${cfg.intensity ?? activeDef.defaults.intensity}">
            </div>

            <div class="cms-control-group">
              <div class="cms-slider-head"><label style="margin:0;">Atmosphere Blur</label><span id="cms-surface-blur-val">${Math.round(cfg.blur || 0)}px</span></div>
              <input type="range" id="cms-surface-blur" class="cms-range" min="0" max="24" step="1" value="${Math.round(cfg.blur || 0)}">
            </div>
          ` : ''}

          <div class="cms-control-group">
            <div class="cms-slider-head"><label style="margin:0;">Base Color / Tint</label><span class="cms-hex-readout" id="cms-surface-hex">${this.escape((cfg.color || '#08080a').toUpperCase())}</span></div>
            <div class="cms-color-row">
              <input type="color" id="cms-surface-color-picker" class="cms-color-native" value="${this.escape(cfg.color || '#08080a')}">
              <div class="cms-color-dots">
                ${LUXURY_SWATCHES.map(sw => `<button type="button" class="cms-color-dot ${(cfg.color || '').toLowerCase() === sw.hex.toLowerCase() ? 'active' : ''}" data-surface-color="${sw.hex}" title="${sw.name}" style="background:${sw.hex};"></button>`).join('')}
              </div>
            </div>
          </div>

          ${isPattern ? `
            <div class="cms-control-group">
              <label>Finish Blend</label>
              <div class="cms-finish-pills">
                ${[['multiply', 'Matte Tint'], ['soft-light', 'Satin'], ['screen', 'Metallic']].map(([id, lbl]) => `
                  <button type="button" class="cms-finish-pill ${(cfg.finish || activeDef.defaults.finish) === id ? 'active' : ''}" data-surface-finish="${id}">${lbl}</button>
                `).join('')}
              </div>
            </div>
            <div class="cms-control-group">
              <div class="cms-slider-head"><label style="margin:0;">Texture Intensity</label><span id="cms-surface-intensity-val">${Math.round((cfg.intensity ?? activeDef.defaults.intensity) * 100)}%</span></div>
              <input type="range" id="cms-surface-intensity" class="cms-range" min="0.05" max="1" step="0.01" value="${cfg.intensity ?? activeDef.defaults.intensity}">
            </div>
            <div class="cms-control-group">
              <div class="cms-slider-head"><label style="margin:0;">Pattern Scale</label><span id="cms-surface-scale-val">${Math.round(cfg.scale ?? activeDef.defaults.scale)}px</span></div>
              <input type="range" id="cms-surface-scale" class="cms-range" min="${activeDef.type === 'pattern' ? 16 : 140}" max="${activeDef.type === 'pattern' ? 180 : 760}" step="4" value="${cfg.scale ?? activeDef.defaults.scale}">
            </div>
          ` : ''}

          <div class="cms-control-group">
            <div class="cms-slider-head"><label style="margin:0;">Readability Veil</label><span id="cms-surface-darkness-val">${Math.round((cfg.darkness ?? activeDef.defaults.darkness) * 100)}%</span></div>
            <input type="range" id="cms-surface-darkness" class="cms-range" min="0" max="0.85" step="0.01" value="${cfg.darkness ?? activeDef.defaults.darkness}">
          </div>
          <button type="button" id="cms-surface-reset-btn" class="cms-btn-subtle" style="width:100%;">Reset ${this.surfaceScope === 'vault' ? 'Initial Page' : this.surfaceScope === 'page' ? `“${this.escape(activeTab)}”` : 'Site'} to Default Obsidian ↺</button>
        </div>
      ` : ''}
    `;

    container.querySelectorAll('[data-surface-scope]').forEach(b => b.addEventListener('click', () => {
      this.surfaceScope = b.dataset.surfaceScope;
      if (this.surfaceScope === 'vault' && window.MeauxSite && window.MeauxSite.isVaultOpen() && window.MeauxSite.replayIntro) {
        window.MeauxSite.replayIntro();
      } else if (this.surfaceScope !== 'vault' && window.MeauxSite && !window.MeauxSite.isVaultOpen()) {
        window.MeauxSite.skipIntro();
      }
      this.renderBackgroundsTab(container);
    }));

    const vaultPreviewBtn = container.querySelector('#cms-toggle-vault-preview-btn');
    if (vaultPreviewBtn) {
      vaultPreviewBtn.addEventListener('click', () => {
        if (!window.MeauxSite) return;
        if (window.MeauxSite.isVaultOpen()) window.MeauxSite.replayIntro?.();
        else window.MeauxSite.skipIntro?.();
        setTimeout(() => this.renderBackgroundsTab(container), 60);
      });
    }

    container.querySelectorAll('[data-surface-cat]').forEach(b => b.addEventListener('click', () => { this.surfaceCategory = b.dataset.surfaceCat; this.renderBackgroundsTab(container); }));
    container.querySelectorAll('[data-select-surface]').forEach(b => b.addEventListener('click', () => {
      const def = getSurfaceDef(b.dataset.selectSurface);
      this.pushUndoSnapshot();
      this.updateSurfaceConfig({ surfaceId: def.id, ...def.defaults }, true);
    }));

    const pickPhotoBtn = container.querySelector('#cms-surface-pick-photo-btn');
    if (pickPhotoBtn) {
      pickPhotoBtn.addEventListener('click', () => {
        this.openSurfacePhotoPicker((url, focalPoint) => {
          this.pushUndoSnapshot();
          this.updateSurfaceConfig({ imageUrl: url, focalPoint }, true);
          this.toast('Background photo applied', 'success');
        });
      });
    }

    const upPhoto = container.querySelector('#cms-surface-upload-photo');
    if (upPhoto) {
      upPhoto.addEventListener('change', async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const url = await this.uploadMediaFile(file, 'blob', { category: 'Photography' });
        if (url) {
          this.pushUndoSnapshot();
          this.updateSurfaceConfig({ imageUrl: url }, true);
          this.toast('Uploaded & applied background photo', 'success');
        }
      });
    }

    const photoUrlInput = container.querySelector('#cms-surface-photo-url');
    if (photoUrlInput) {
      photoUrlInput.addEventListener('change', (e) => {
        const url = e.target.value.trim();
        if (url) this.updateSurfaceConfig({ imageUrl: url }, true);
      });
    }

    const blurS = container.querySelector('#cms-surface-blur');
    if (blurS) blurS.addEventListener('input', (e) => {
      const v = Number(e.target.value);
      container.querySelector('#cms-surface-blur-val').textContent = `${Math.round(v)}px`;
      this.updateSurfaceConfig({ blur: v }, false);
    });

    const picker = container.querySelector('#cms-surface-color-picker');
    if (picker) picker.addEventListener('input', (e) => { container.querySelector('#cms-surface-hex').textContent = e.target.value.toUpperCase(); this.updateSurfaceConfig({ color: e.target.value }, false); });
    container.querySelectorAll('[data-surface-color]').forEach(d => d.addEventListener('click', () => this.updateSurfaceConfig({ color: d.dataset.surfaceColor }, true)));
    container.querySelectorAll('[data-surface-finish]').forEach(p => p.addEventListener('click', () => this.updateSurfaceConfig({ finish: p.dataset.surfaceFinish }, true)));
    const intS = container.querySelector('#cms-surface-intensity');
    if (intS) intS.addEventListener('input', (e) => { container.querySelector('#cms-surface-intensity-val').textContent = `${Math.round(Number(e.target.value) * 100)}%`; this.updateSurfaceConfig({ intensity: Number(e.target.value) }, false); });
    const scS = container.querySelector('#cms-surface-scale');
    if (scS) scS.addEventListener('input', (e) => { container.querySelector('#cms-surface-scale-val').textContent = `${Math.round(Number(e.target.value))}px`; this.updateSurfaceConfig({ scale: Number(e.target.value) }, false); });
    const dkS = container.querySelector('#cms-surface-darkness');
    if (dkS) dkS.addEventListener('input', (e) => { container.querySelector('#cms-surface-darkness-val').textContent = `${Math.round(Number(e.target.value) * 100)}%`; this.updateSurfaceConfig({ darkness: Number(e.target.value) }, false); });
    const rst = container.querySelector('#cms-surface-reset-btn');
    if (rst) rst.addEventListener('click', () => this.updateSurfaceConfig({ surfaceId: 'default' }, true));
  }

  /* -------------------------------------------------------------------
     MODULE 5: PORTFOLIO ARCHIVE MANAGER & BENTO SHOOT STYLES
     ------------------------------------------------------------------- */
  renderPortfolioTab(container) {
    const portfolio = window.MeauxSite ? window.MeauxSite.getPortfolio() : { items: [], selected: [] };
    const curatedIds = new Set(portfolio.selected.map(c => c.id));
    const q = this.portfolioSearch.toLowerCase().trim();
    const styles = window.MeauxSite?.getPhotoStyles ? window.MeauxSite.getPhotoStyles() : {};

    const filtered = portfolio.items.filter(item => {
      if (this.portfolioFilter === 'featured' && !curatedIds.has(item.shortcode)) return false;
      if (this.portfolioFilter === 'hidden' && !item.hidden) return false;
      if (q) {
        const hay = `${item.shortcode} ${item.title || ''} ${item.category || ''} ${item.caption || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    container.innerHTML = `
      <div class="cms-section-head">
        <h4>Portfolio Works (${portfolio.items.length})</h4>
        <button type="button" class="cms-btn-subtle active" id="cms-add-work-btn">+ New Work</button>
      </div>

      <div class="cms-inline-row" style="margin-bottom:10px;">
        <input type="search" id="cms-port-search" class="cms-input" placeholder="Search all ${portfolio.items.length} works..." value="${this.escape(this.portfolioSearch)}" style="flex:1;">
        <select id="cms-port-filter" class="cms-select" style="width:auto;">
          <option value="all" ${this.portfolioFilter === 'all' ? 'selected' : ''}>All (${portfolio.items.length})</option>
          <option value="featured" ${this.portfolioFilter === 'featured' ? 'selected' : ''}>Featured (${portfolio.selected.length})</option>
          <option value="hidden" ${this.portfolioFilter === 'hidden' ? 'selected' : ''}>Hidden</option>
        </select>
      </div>

      <div style="max-height:360px;overflow-y:auto;padding-right:4px;margin-bottom:18px;">
        ${filtered.map(item => `
          <div class="cms-list-item">
            <div style="display:flex;align-items:center;gap:10px;min-width:0;flex:1;">
              <img src="${this.escape(item.image_url || `instagram/meauxsvision/images/${item.image_file}`)}" style="width:42px;height:42px;object-fit:cover;border-radius:6px;flex-shrink:0;">
              <div style="min-width:0;">
                <strong style="font-size:11px;display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${this.escape(item.title || item.shortcode)}</strong>
                <span style="font-size:9px;color:var(--cms-muted);">
                  ${curatedIds.has(item.shortcode) ? '★ Featured' : 'Archive'} · ${this.escape(item.category || 'Photography')} ${item.hidden ? '· HIDDEN' : ''}
                </span>
              </div>
            </div>
            <div class="cms-inline-row" style="gap:4px;">
              <button type="button" class="cms-btn-subtle" data-edit-work="${this.escape(item.shortcode)}" title="Edit Work Details">✎</button>
              <button type="button" class="cms-btn-subtle ${curatedIds.has(item.shortcode) ? 'active' : ''}" data-toggle-curated="${this.escape(item.shortcode)}">${curatedIds.has(item.shortcode) ? '★' : '☆'}</button>
            </div>
          </div>
        `).join('') || '<p class="cms-muted-note">No works matching filter.</p>'}
      </div>

      <div class="cms-divider-line"><span>PHOTOGRAPHY BENTO COLLECTIONS</span></div>
      <p class="cms-muted-note">Manage the filter tabs on the Photography page. Open Asset Gallery to drag &amp; drop photos into any collection.</p>
      <div style="margin-bottom:10px;">
        ${Object.entries(styles).map(([key, cfg]) => `
          <div class="cms-list-item">
            <div style="min-width:0;flex:1;">
              <strong style="font-size:11px;">${this.escape(cfg.label || key)}</strong>
              <span style="display:block;font-size:9.5px;color:var(--cms-muted);">${(cfg.items || []).length} frames · ${this.escape((cfg.summary || '').slice(0, 48))}</span>
            </div>
            <div class="cms-inline-row" style="gap:4px;">
              <button type="button" class="cms-btn-subtle" data-open-bstyle="${this.escape(key)}">View</button>
              <button type="button" class="cms-btn-subtle" data-edit-bstyle="${this.escape(key)}">✎</button>
              ${key !== 'all' ? `<button type="button" class="cms-btn-subtle cms-btn-danger" data-del-bstyle="${this.escape(key)}">✕</button>` : ''}
            </div>
          </div>
        `).join('')}
      </div>
      <div class="cms-inline-row">
        <input type="text" id="cms-new-bstyle-name" class="cms-input" placeholder="New Shoot Style (e.g. Backstage)">
        <button type="button" id="cms-add-bstyle-btn" class="cms-btn-subtle">+ Add Style</button>
      </div>
    `;

    const ps = container.querySelector('#cms-port-search');
    ps.addEventListener('input', (e) => {
      this.portfolioSearch = e.target.value;
      const pos = e.target.selectionStart;
      this.renderPortfolioTab(container);
      const next = container.querySelector('#cms-port-search');
      if (next) { next.focus(); next.setSelectionRange(pos, pos); }
    });
    container.querySelector('#cms-port-filter').addEventListener('change', (e) => {
      this.portfolioFilter = e.target.value;
      this.renderPortfolioTab(container);
    });
    container.querySelector('#cms-add-work-btn').addEventListener('click', () => this.openPortfolioWorkModal(null));
    container.querySelectorAll('[data-edit-work]').forEach(b => b.addEventListener('click', () => this.openPortfolioWorkModal(b.dataset.editWork)));

    container.querySelectorAll('[data-toggle-curated]').forEach(btn => {
      btn.addEventListener('click', () => {
        this.pushUndoSnapshot();
        const id = btn.dataset.toggleCurated;
        const item = portfolio.items.find(i => i.shortcode === id);
        if (curatedIds.has(id)) {
          portfolio.selected = portfolio.selected.filter(c => c.id !== id);
        } else {
          portfolio.selected.push({ id, title: item?.title || id, category: item?.category || 'Photography' });
        }
        this.draft.portfolio = portfolio;
        window.MeauxSite.setPortfolio(portfolio);
        this.markDraftModified();
        this.renderPortfolioTab(container);
      });
    });

    container.querySelectorAll('[data-open-bstyle]').forEach(btn => {
      btn.addEventListener('click', () => {
        window.MeauxSite?.switchTab('photography', true);
        window.MeauxSite?.renderPhotoBento(btn.dataset.openBstyle, true);
      });
    });

    container.querySelectorAll('[data-edit-bstyle]').forEach(btn => {
      btn.addEventListener('click', () => this.openBentoStyleEditModal(btn.dataset.editBstyle));
    });

    container.querySelectorAll('[data-del-bstyle]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const key = btn.dataset.delBstyle;
        const ok = await this.confirmModal('Delete Shoot Style?', `Remove "${key}" filter tab from Photography?`, 'Delete');
        if (!ok) return;
        const nextStyles = window.MeauxSite.getPhotoStyles();
        delete nextStyles[key];
        this.persistPhotoStyles(nextStyles);
        this.renderPortfolioTab(container);
      });
    });

    container.querySelector('#cms-add-bstyle-btn').addEventListener('click', () => {
      const label = container.querySelector('#cms-new-bstyle-name').value.trim();
      if (!label) return this.toast('Enter a style name', 'warn');
      const slug = label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
      const nextStyles = window.MeauxSite.getPhotoStyles();
      if (nextStyles[slug]) return this.toast('Style already exists', 'warn');
      nextStyles[slug] = {
        label,
        summary: `Curated ${label} series directed by Meaux Atelier.`,
        items: [
          { id: 'DW9lQW_DUjv', title: 'Featured Study', subtitle: label, tag: label, pos: '50% 35%' }
        ]
      };
      this.persistPhotoStyles(nextStyles);
      this.renderPortfolioTab(container);
      this.toast(`Added "${label}" Bento collection`, 'success');
    });
  }

  openBentoStyleEditModal(styleKey) {
    const styles = window.MeauxSite.getPhotoStyles();
    const cfg = styles[styleKey];
    if (!cfg) return;
    const overlay = document.createElement('div');
    overlay.className = 'cms-modal-overlay';
    overlay.innerHTML = `
      <div class="cms-modal-card" style="max-width:460px;">
        <div class="cms-modal-header">
          <div><span class="cms-eyebrow">BENTO COLLECTION // ${this.escape(styleKey)}</span><h3 class="cms-modal-title" style="font-size:20px;">Edit Style Filter</h3></div>
          <button type="button" class="cms-modal-close" data-close>✕</button>
        </div>
        <div class="cms-control-group"><label>Tab Label</label><input id="bs-label" class="cms-input" value="${this.escape(cfg.label || styleKey)}"></div>
        <div class="cms-control-group"><label>Summary Description</label><textarea id="bs-summary" class="cms-textarea" rows="3">${this.escape(cfg.summary || '')}</textarea></div>
        <button type="button" id="bs-save" class="cms-luxury-btn">Save Collection ↵</button>
      </div>
    `;
    document.body.appendChild(overlay);
    overlay.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', () => overlay.remove()));
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
    overlay.querySelector('#bs-save').addEventListener('click', () => {
      styles[styleKey].label = overlay.querySelector('#bs-label').value.trim() || styleKey;
      styles[styleKey].summary = overlay.querySelector('#bs-summary').value.trim();
      this.persistPhotoStyles(styles);
      overlay.remove();
      this.renderDrawerContent();
      this.toast('Updated Bento style collection', 'success');
    });
  }

  openPortfolioWorkModal(shortcode) {
    const portfolio = window.MeauxSite.getPortfolio();
    const isNew = !shortcode;
    const existing = isNew ? null : portfolio.items.find(i => i.shortcode === shortcode);
    const curatedEntry = existing ? portfolio.selected.find(c => c.id === shortcode) : null;

    const overlay = document.createElement('div');
    overlay.className = 'cms-modal-overlay';
    overlay.innerHTML = `
      <div class="cms-modal-card" style="max-width:540px;">
        <div class="cms-modal-header">
          <div>
            <span class="cms-eyebrow">PORTFOLIO ARCHIVE</span>
            <h3 class="cms-modal-title" style="font-size:20px;">${isNew ? 'Add New Portfolio Work' : `Edit Work #${this.escape(shortcode)}`}</h3>
          </div>
          <button type="button" class="cms-modal-close" data-close>✕</button>
        </div>
        <div class="cms-modal-scroll">
          <div class="cms-control-group"><label>Title</label><input id="pw-title" class="cms-input" value="${this.escape(curatedEntry?.title || existing?.title || '')}" placeholder="e.g. Atelier Silhouette Study"></div>
          <div class="cms-control-group"><label>Category</label><input id="pw-cat" class="cms-input" value="${this.escape(curatedEntry?.category || existing?.category || 'Photography')}" placeholder="e.g. Portrait & styling"></div>
          <div class="cms-control-group"><label>Image URL (or upload below)</label><input id="pw-url" class="cms-input" value="${this.escape(existing?.image_url || (existing?.image_file ? `instagram/meauxsvision/images/${existing.image_file}` : ''))}" placeholder="https://... or select file"></div>
          <div class="cms-control-group"><label>Upload Image File</label><input type="file" id="pw-file" accept="image/*" class="cms-input" style="padding:7px;"></div>
          <div class="cms-control-group"><label>Caption / Project Credits</label><textarea id="pw-cap" class="cms-textarea" rows="3">${this.escape(existing?.caption || '')}</textarea></div>
          <div class="cms-control-group"><label>Original Post / External Link</label><input type="url" id="pw-link" class="cms-input" value="${this.escape(existing?.permalink || '')}" placeholder="Leave empty to hide link button"></div>
          <div class="cms-inline-row" style="justify-content:space-between;margin-bottom:14px;">
            <label class="cms-switch"><input type="checkbox" id="pw-featured" ${curatedEntry ? 'checked' : ''}><span>Feature in Top Selected Grid ★</span></label>
            <label class="cms-switch"><input type="checkbox" id="pw-hidden" ${existing?.hidden ? 'checked' : ''}><span>Hide from Public</span></label>
          </div>
          <button type="button" id="pw-save" class="cms-luxury-btn">${isNew ? 'Add Work to Portfolio ↵' : 'Save Work Changes ↵'}</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    overlay.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', () => overlay.remove()));
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });

    overlay.querySelector('#pw-file').addEventListener('change', async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const url = await this.uploadMediaFile(file, 'blob', { category: 'Photography' });
      if (url) overlay.querySelector('#pw-url').value = url;
    });

    overlay.querySelector('#pw-save').addEventListener('click', () => {
      const title = overlay.querySelector('#pw-title').value.trim();
      const category = overlay.querySelector('#pw-cat').value.trim() || 'Photography';
      const url = overlay.querySelector('#pw-url').value.trim();
      const caption = overlay.querySelector('#pw-cap').value.trim();
      const permalink = overlay.querySelector('#pw-link').value.trim();
      const isFeat = overlay.querySelector('#pw-featured').checked;
      const isHidden = overlay.querySelector('#pw-hidden').checked;

      if (!url) return this.toast('Provide an image URL or upload a photo', 'warn');
      this.pushUndoSnapshot();

      const id = isNew ? ('work_' + Date.now().toString(36)) : shortcode;
      if (isNew) {
        portfolio.items.unshift({ shortcode: id, title: title || id, category, caption, permalink, image_url: url, hidden: isHidden, media_type: 'image' });
      } else if (existing) {
        existing.title = title;
        existing.category = category;
        existing.caption = caption;
        existing.permalink = permalink;
        existing.image_url = url;
        existing.hidden = isHidden;
      }

      const idxInSel = portfolio.selected.findIndex(c => c.id === id);
      if (isFeat) {
        if (idxInSel >= 0) portfolio.selected[idxInSel] = { id, title: title || id, category };
        else portfolio.selected.unshift({ id, title: title || id, category });
      } else if (idxInSel >= 0) {
        portfolio.selected.splice(idxInSel, 1);
      }

      if (!this.draft.customPostLinks) this.draft.customPostLinks = {};
      this.draft.customPostLinks[id] = permalink;
      this.draft.portfolio = portfolio;
      window.MeauxSite.setPortfolio(portfolio);
      this.markDraftModified();
      overlay.remove();
      this.renderDrawerContent();
      this.toast(isNew ? 'Added new portfolio work' : 'Updated portfolio work', 'success');
    });
  }

  /* -------------------------------------------------------------------
     MODULE 6: MEDIA VAULT, CATEGORIES MANAGER & BATCH UPLOAD
     ------------------------------------------------------------------- */
  renderMediaTab(container) {
    const filtered = this.getFilteredAssets();

    container.innerHTML = `
      <div class="cms-section-head">
        <h4>Media Vault (${this.mediaList.length})</h4>
        <div class="cms-inline-row" style="gap:5px;">
          <button type="button" class="cms-btn-subtle" id="cms-media-fullscreen-btn">⤢ Full Vault</button>
          <button type="button" class="cms-btn-subtle" id="cms-seed-db-btn" title="Sync catalog & categories to Supabase">⚡ Seed DB</button>
        </div>
      </div>

      <!-- Multi-file Upload Dropzone with Default Category & Tags -->
      <div class="cms-glass-card">
        <div class="cms-grid-2" style="margin-bottom:10px;">
          <div>
            <label class="cms-field-label">Upload Category</label>
            <select id="cms-up-cat" class="cms-select">
              ${this.mediaCategories.map(c => `<option value="${this.escape(c.name)}">${this.escape(c.name)}</option>`).join('')}
            </select>
          </div>
          <div>
            <label class="cms-field-label">Auto-Tags (comma separated)</label>
            <input type="text" id="cms-up-tags" class="cms-input" placeholder="campaign, paris, bw">
          </div>
        </div>

        <div class="cms-inline-row" style="justify-content:space-between;margin-bottom:10px;font-size:10.5px;">
          <label style="display:flex;align-items:center;gap:5px;cursor:pointer;"><input type="radio" name="cms-upload-dest" value="blob" checked> Database Blob (Instant)</label>
          <label style="display:flex;align-items:center;gap:5px;cursor:pointer;"><input type="radio" name="cms-upload-dest" value="storage"> Supabase Storage CDN</label>
        </div>

        <label class="cms-upload-dropzone" id="cms-media-dropzone" style="display:block;">
          <strong style="display:block;font-size:12px;color:#fff;margin-bottom:4px;">Drop Photos Here or Click to Browse</strong>
          <span style="font-size:10px;color:var(--cms-muted);">Supports multi-file upload · Automatically applies category &amp; tags above</span>
          <input type="file" id="cms-file-uploader" accept="image/*" multiple hidden>
        </label>

        <div class="cms-inline-row" style="margin-top:10px;">
          <input type="url" id="cms-add-link-input" class="cms-input" placeholder="Or paste external image URL (https://...)" style="flex:1;">
          <button type="button" id="cms-add-link-btn" class="cms-btn-subtle">Add Link ↵</button>
        </div>
      </div>

      <!-- Category Manager -->
      <div class="cms-divider-line"><span>CATEGORIES (${this.mediaCategories.length})</span></div>
      <div class="cms-glass-card">
        <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px;">
          ${this.mediaCategories.map(c => `
            <span class="cms-filter-chip ${this.dockCategory.toLowerCase() === c.name.toLowerCase() ? 'active' : ''}" data-mcat="${this.escape(c.name)}">
              <span class="cms-cat-dot" style="background:${this.escape(c.color)};"></span>
              <span>${this.escape(c.name)}</span>
              ${c.slug !== 'uncategorized' ? `<button type="button" data-del-cat="${this.escape(c.slug)}" style="background:none;border:0;color:var(--cms-rose);cursor:pointer;padding:0 0 0 4px;font-size:11px;" title="Delete category">×</button>` : ''}
            </span>
          `).join('')}
        </div>
        <button type="button" id="cms-media-new-cat-btn" class="cms-btn-subtle" style="width:100%;">+ Create New Picture Category</button>
      </div>

      <!-- Search + Overlap-Proof Grid -->
      <div class="cms-inline-row" style="margin-bottom:8px;">
        <input type="search" id="cms-media-tab-search" class="cms-input" placeholder="Search assets, #tags, categories..." value="${this.escape(this.dockSearch)}" style="flex:1;">
        <button type="button" class="cms-btn-subtle" id="cms-media-reset-btn">Reset</button>
      </div>

      <div class="cms-media-grid" id="cms-media-tab-grid">
        ${filtered.map(a => this.renderAssetCardHtml(a, { mode: 'vault' })).join('') || '<p class="cms-muted-note">No images match your filter.</p>'}
      </div>
    `;

    container.querySelector('#cms-media-fullscreen-btn').addEventListener('click', () => this.openFullVaultModal());
    container.querySelector('#cms-media-new-cat-btn').addEventListener('click', () => this.openNewCategoryModal());

    const getUploadOpts = () => ({
      category: container.querySelector('#cms-up-cat').value || 'Photography',
      tags: container.querySelector('#cms-up-tags').value.split(',').map(s => s.trim().toLowerCase().replace(/^#/, '')).filter(Boolean),
      mode: container.querySelector('input[name="cms-upload-dest"]:checked').value
    });

    const dz = container.querySelector('#cms-media-dropzone');
    dz.addEventListener('dragover', (e) => { e.preventDefault(); dz.classList.add('is-over'); });
    dz.addEventListener('dragleave', () => dz.classList.remove('is-over'));
    dz.addEventListener('drop', async (e) => {
      e.preventDefault(); dz.classList.remove('is-over');
      if (e.dataTransfer.files?.length) await this.handleBatchFileUpload(e.dataTransfer.files, getUploadOpts());
    });

    container.querySelector('#cms-file-uploader').addEventListener('change', async (e) => {
      if (e.target.files?.length) {
        await this.handleBatchFileUpload(e.target.files, getUploadOpts());
        e.target.value = '';
      }
    });

    container.querySelector('#cms-add-link-btn').addEventListener('click', async () => {
      const url = container.querySelector('#cms-add-link-input').value.trim();
      if (!url) return this.toast('Enter a valid image URL', 'warn');
      const opts = getUploadOpts();
      await this.addImageLink(url, '', opts.category, opts.tags);
      container.querySelector('#cms-add-link-input').value = '';
      this.renderMediaTab(container);
    });

    container.querySelectorAll('[data-mcat]').forEach(chip => {
      chip.addEventListener('click', (e) => {
        if (e.target.closest('[data-del-cat]')) return;
        this.dockCategory = this.dockCategory === chip.dataset.mcat ? 'all' : chip.dataset.mcat;
        this.renderMediaTab(container);
        this.renderAssetDock();
      });
    });

    container.querySelectorAll('[data-del-cat]').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        await this.deleteCategory(btn.dataset.delCat);
      });
    });

    const searchEl = container.querySelector('#cms-media-tab-search');
    searchEl.addEventListener('input', (e) => {
      this.dockSearch = e.target.value;
      const pos = e.target.selectionStart;
      this.renderMediaTab(container);
      const next = container.querySelector('#cms-media-tab-search');
      if (next) { next.focus(); next.setSelectionRange(pos, pos); }
    });

    container.querySelector('#cms-media-reset-btn').addEventListener('click', () => {
      this.dockSearch = ''; this.dockCategory = 'all'; this.dockTag = ''; this.dockSource = 'all';
      this.renderMediaTab(container);
      this.renderAssetDock();
    });

    container.querySelector('#cms-seed-db-btn').addEventListener('click', async () => {
      const btn = container.querySelector('#cms-seed-db-btn');
      btn.disabled = true; btn.textContent = 'Seeding...';
      await this.seedMediaToSupabase(true);
      await this.fetchCategories();
      await this.fetchMedia();
      this.renderMediaTab(container);
      this.renderAssetDock();
    });

    this.bindAssetCardEvents(container.querySelector('#cms-media-tab-grid'));
  }

  async handleBatchFileUpload(fileList, { category = 'Photography', tags = [], mode = 'blob' } = {}) {
    const files = Array.from(fileList || []).filter(f => f.type && f.type.startsWith('image/'));
    if (!files.length) return;
    this.toast(`Uploading ${files.length} photo${files.length > 1 ? 's' : ''}...`, 'info');
    let okCount = 0;
    for (const file of files) {
      const url = await this.uploadMediaFile(file, mode, { category, tags });
      if (url) okCount++;
    }
    this.updateHudCounters();
    this.renderAssetDock();
    if (this.activeDrawerTab === 'media') this.renderDrawerContent();
    this.toast(`Uploaded ${okCount} photo${okCount > 1 ? 's' : ''} into "${category}"`, 'success');
  }

  async uploadMediaFile(file, mode = 'blob', { category = 'Photography', tags = [] } = {}) {
    const cleanTitle = file.name.replace(/\.[^/.]+$/, '');
    const id = 'media_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);

    if (mode === 'storage' && this.supabase) {
      try {
        const ext = file.name.split('.').pop();
        const storagePath = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}.${ext}`;
        const { error } = await this.supabase.storage.from('media').upload(storagePath, file, { cacheControl: '3600', upsert: false });
        if (error) throw error;
        const { data: { publicUrl } } = this.supabase.storage.from('media').getPublicUrl(storagePath);

        const row = {
          id, filename: file.name, title: cleanTitle, caption: '', alt_text: cleanTitle,
          category, tags, focal_point: '50% 35%', url: publicUrl, blob_data: null,
          source: 'storage', mime_type: file.type || 'image/jpeg', file_size: file.size,
          created_by: this.user.email || 'admin'
        };
        await this.supabase.from('media_items').insert(row).catch(() => {});
        this.mediaList.unshift({ ...row, name: cleanTitle, isBlob: false });
        return publicUrl;
      } catch (err) {
        console.warn('Storage bucket unavailable, falling back to Database Blob:', err);
      }
    }

    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const base64Data = e.target.result;
        const row = {
          id, filename: file.name, title: cleanTitle, caption: '', alt_text: cleanTitle,
          category, tags, focal_point: '50% 35%', blob_data: base64Data, url: null,
          source: 'blob', mime_type: file.type || 'image/jpeg', file_size: file.size,
          created_by: this.user.email || 'admin'
        };
        if (this.supabase) {
          try { await this.supabase.from('media_items').insert(row); } catch (err) {}
        }
        this.mediaList.unshift({ ...row, name: cleanTitle, url: base64Data, isBlob: true });
        resolve(base64Data);
      };
      reader.readAsDataURL(file);
    });
  }

  async addImageLink(url, title = '', category = 'Photography', tags = []) {
    const id = 'media_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
    const cleanTitle = title || 'External Image';
    const row = {
      id, filename: cleanTitle.replace(/[^a-zA-Z0-9_-]/g, '_') + '.jpg',
      title: cleanTitle, caption: 'Direct URL asset', alt_text: cleanTitle,
      category, tags, focal_point: '50% 35%', url, blob_data: null,
      source: 'link', created_by: this.user.email || 'admin'
    };
    if (this.supabase) {
      try { await this.supabase.from('media_items').insert(row); } catch (e) {}
    }
    this.mediaList.unshift({ ...row, name: cleanTitle, isBlob: false });
    this.updateHudCounters();
    this.renderAssetDock();
    this.toast('Added external image to Media Vault', 'success');
  }

  async deleteMedia(id) {
    const ok = await this.confirmModal('Delete Asset?', 'Permanently remove this media item from the vault?', 'Delete');
    if (!ok) return;
    if (this.supabase) {
      try { await this.supabase.from('media_items').delete().eq('id', id); } catch (e) {}
    }
    this.mediaList = this.mediaList.filter(m => m.id !== id);
    this.selectedAssetIds.delete(id);
    this.updateHudCounters();
    this.renderAssetDock();
    if (this.activeDrawerTab === 'media') this.renderDrawerContent();
    this.toast('Asset removed', 'info');
  }

  async fetchCategories() {
    let loaded = [];
    if (this.supabase) {
      try {
        const { data, error } = await this.supabase.from('media_categories').select('*').order('sort_order', { ascending: true });
        if (data && !error && data.length) loaded = data;
      } catch (e) {}
    }
    if (!loaded.length && Array.isArray(this.draft.mediaCategories) && this.draft.mediaCategories.length) {
      loaded = this.draft.mediaCategories;
    }
    if (!loaded.length) loaded = JSON.parse(JSON.stringify(DEFAULT_MEDIA_CATEGORIES));
    this.mediaCategories = loaded;
  }

  async fetchMedia() {
    const catalog = Array.isArray(window.MEAUX_CATALOG_MEDIA) ? window.MEAUX_CATALOG_MEDIA : [];
    const localMeta = this.draft.mediaMeta || {};
    let dbItems = [];

    if (this.supabase) {
      try {
        const { data, error } = await this.supabase.from('media_items').select('*').order('created_at', { ascending: false });
        if (data && !error && data.length > 0) {
          dbItems = data.map(item => {
            const inferred = inferAssetMetadata(item);
            const meta = localMeta[item.id] || {};
            return {
              id: item.id,
              name: meta.title || item.title || item.filename,
              filename: item.filename,
              title: meta.title || item.title || item.filename,
              caption: meta.caption !== undefined ? meta.caption : (item.caption || ''),
              alt_text: meta.alt_text !== undefined ? meta.alt_text : (item.alt_text || ''),
              category: meta.category || (item.category && item.category !== 'Uncategorized' ? item.category : inferred.category),
              tags: Array.isArray(meta.tags) && meta.tags.length ? meta.tags : (Array.isArray(item.tags) && item.tags.length ? item.tags : inferred.tags),
              focal_point: meta.focal_point || item.focal_point || '50% 35%',
              permalink: meta.permalink !== undefined ? meta.permalink : (item.permalink || ''),
              credit: meta.credit !== undefined ? meta.credit : (item.credit || ''),
              location: meta.location !== undefined ? meta.location : (item.location || ''),
              featured: meta.featured !== undefined ? meta.featured : Boolean(item.featured),
              url: item.blob_data || item.url,
              isBlob: !!item.blob_data,
              source: item.source || (item.blob_data ? 'blob' : 'url')
            };
          });
        }
      } catch (err) {
        console.warn('Could not load from media_items:', err);
      }
    }

    const dbIds = new Set(dbItems.map(d => d.id));
    const dbUrls = new Set(dbItems.map(d => d.url));
    const catalogMapped = catalog
      .filter(c => !dbIds.has(c.id) && !dbUrls.has(c.url))
      .map(c => {
        const inferred = inferAssetMetadata(c);
        const meta = localMeta[c.id] || {};
        return {
          id: c.id,
          shortcode: c.id.replace(/^media_/, ''),
          name: meta.title || c.title || c.filename,
          filename: c.filename,
          title: meta.title || c.title || c.filename,
          caption: meta.caption !== undefined ? meta.caption : (c.caption || ''),
          alt_text: meta.alt_text || '',
          category: meta.category || inferred.category,
          tags: Array.isArray(meta.tags) ? meta.tags : inferred.tags,
          focal_point: meta.focal_point || '50% 35%',
          permalink: meta.permalink !== undefined ? meta.permalink : (c.permalink || ''),
          credit: meta.credit || '',
          location: meta.location || '',
          featured: Boolean(meta.featured),
          url: c.url,
          isBlob: false,
          source: 'catalog'
        };
      });

    this.mediaList = [...dbItems, ...catalogMapped];
  }

  async seedMediaToSupabase(notify = false) {
    if (!this.supabase) {
      if (notify) this.toast('Connect Supabase first in System tab', 'warn');
      return;
    }
    try {
      await this.supabase.from('media_categories').upsert(this.mediaCategories, { onConflict: 'slug' });
      const rows = this.mediaList.map(m => ({
        id: m.id,
        filename: m.filename || 'asset.jpg',
        title: m.title,
        caption: m.caption || '',
        alt_text: m.alt_text || m.title || '',
        category: m.category || 'Photography',
        tags: m.tags || [],
        focal_point: m.focal_point || '50% 35%',
        permalink: m.permalink || '',
        featured: Boolean(m.featured),
        url: m.isBlob ? null : (m.url.startsWith('http') ? m.url : 'https://alexnbucur.space/' + m.url.replace(/^\/?/, '')),
        blob_data: m.isBlob ? m.url : null,
        source: m.source || 'catalog',
        created_by: this.user.email || 'seed'
      }));
      const { error } = await this.supabase.from('media_items').upsert(rows, { onConflict: 'id' });
      if (error) throw error;
      if (notify) this.toast(`Synced ${rows.length} assets & ${this.mediaCategories.length} categories to Supabase!`, 'success');
    } catch (e) {
      if (notify) this.toast('Seed error: ' + e.message + ' — Run supabase/schema.sql first.', 'error');
    }
  }

  /* -------------------------------------------------------------------
     MODULE 7: CLIENT ENQUIRIES INBOX (CRM)
     ------------------------------------------------------------------- */
  async fetchEnquiries() {
    let remote = [];
    if (this.supabase) {
      try {
        const { data, error } = await this.supabase.from('enquiries').select('*').order('created_at', { ascending: false }).limit(100);
        if (data && !error) remote = data;
      } catch (e) {}
    }
    let local = [];
    try { local = JSON.parse(localStorage.getItem(LOCAL_ENQ_KEY) || '[]'); } catch (e) {}
    const seen = new Set(remote.map(r => `${r.client_email}_${r.brief?.slice(0, 30)}`));
    this.enquiries = [...remote, ...local.filter(l => !seen.has(`${l.client_email}_${l.brief?.slice(0, 30)}`))];
  }

  renderEnquiriesTab(container) {
    const filtered = this.enquiries.filter(e => this.enquiryFilter === 'all' || e.status === this.enquiryFilter);
    const counts = {
      all: this.enquiries.length,
      new: this.enquiries.filter(e => e.status === 'new').length,
      reviewed: this.enquiries.filter(e => e.status === 'reviewed').length,
      replied: this.enquiries.filter(e => e.status === 'replied').length
    };

    container.innerHTML = `
      <div class="cms-section-head">
        <h4>Commission Dossiers</h4>
        <button type="button" class="cms-btn-subtle" id="cms-enq-refresh">↻ Sync</button>
      </div>
      <p class="cms-muted-note">Every client enquiry submitted via the Enquiries page is logged here and synced to <code>public.enquiries</code>.</p>

      <div class="cms-filter-strip" style="margin-bottom:14px;">
        ${[['all', `All (${counts.all})`], ['new', `New (${counts.new})`], ['reviewed', `Reviewed (${counts.reviewed})`], ['replied', `Replied (${counts.replied})`], ['archived', 'Archived']].map(([k, lbl]) => `
          <button type="button" class="cms-filter-chip ${this.enquiryFilter === k ? 'active' : ''}" data-efilter="${k}">${lbl}</button>
        `).join('')}
      </div>

      ${filtered.length ? filtered.map(enq => `
        <div class="cms-glass-card">
          <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px;margin-bottom:8px;">
            <div>
              <strong style="font-size:13px;color:#fff;">${this.escape(enq.client_name)}</strong>
              <div style="font-size:10px;color:var(--cms-cyan);">${this.escape(enq.client_email)} ${enq.phone ? `· ${this.escape(enq.phone)}` : ''}</div>
            </div>
            <span class="cms-badge ${enq.status === 'new' ? 'info' : enq.status === 'replied' ? 'ok' : 'warn'}">${this.escape(enq.status || 'new')}</span>
          </div>
          <div style="display:flex;flex-wrap:wrap;gap:5px;margin-bottom:8px;">
            ${(enq.disciplines || []).map(d => `<span class="cms-tag-chip">${this.escape(d)}</span>`).join('')}
            ${enq.timeline ? `<span class="cms-badge">${this.escape(enq.timeline)}</span>` : ''}
          </div>
          <p style="font-size:11px;line-height:1.6;color:#e2e8f0;margin:0 0 10px;white-space:pre-wrap;">${this.escape(enq.brief)}</p>
          <div class="cms-inline-row" style="justify-content:space-between;flex-wrap:wrap;">
            <select class="cms-select" data-enq-status="${this.escape(enq.id)}" style="width:auto;padding:5px 8px;font-size:10px;">
              ${['new', 'reviewed', 'replied', 'archived'].map(s => `<option value="${s}" ${enq.status === s ? 'selected' : ''}>Status: ${s}</option>`).join('')}
            </select>
            <div class="cms-inline-row" style="gap:5px;">
              <a href="mailto:${this.escape(enq.client_email)}?subject=${encodeURIComponent('Re: Atelier Meaux Commission Dossier')}" class="cms-btn-subtle">Reply ↗</a>
              <button type="button" class="cms-btn-subtle cms-btn-danger" data-enq-del="${this.escape(enq.id)}">✕</button>
            </div>
          </div>
        </div>
      `).join('') : '<div class="cms-glass-card" style="text-align:center;padding:30px;"><p class="cms-muted-note" style="margin:0;">No commission dossiers in this view yet.</p></div>'}
    `;

    container.querySelector('#cms-enq-refresh').addEventListener('click', async () => {
      await this.fetchEnquiries();
      this.updateHudCounters();
      this.renderEnquiriesTab(container);
      this.toast('Synced enquiries inbox', 'info');
    });

    container.querySelectorAll('[data-efilter]').forEach(b => b.addEventListener('click', () => {
      this.enquiryFilter = b.dataset.efilter;
      this.renderEnquiriesTab(container);
    }));

    container.querySelectorAll('[data-enq-status]').forEach(sel => {
      sel.addEventListener('change', async () => {
        const id = sel.dataset.enqStatus;
        const status = sel.value;
        const target = this.enquiries.find(e => String(e.id) === String(id));
        if (target) target.status = status;
        try {
          const local = JSON.parse(localStorage.getItem(LOCAL_ENQ_KEY) || '[]');
          const hit = local.find(e => String(e.id) === String(id));
          if (hit) { hit.status = status; localStorage.setItem(LOCAL_ENQ_KEY, JSON.stringify(local)); }
        } catch (e) {}
        if (this.supabase && !String(id).startsWith('enq_')) {
          try { await this.supabase.from('enquiries').update({ status, updated_at: new Date().toISOString() }).eq('id', id); } catch (e) {}
        }
        this.updateHudCounters();
        this.renderEnquiriesTab(container);
        this.toast(`Marked dossier as ${status}`, 'success');
      });
    });

    container.querySelectorAll('[data-enq-del]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const ok = await this.confirmModal('Delete Dossier?', 'Remove this enquiry from the inbox?', 'Delete');
        if (!ok) return;
        const id = btn.dataset.enqDel;
        this.enquiries = this.enquiries.filter(e => String(e.id) !== String(id));
        try {
          const local = JSON.parse(localStorage.getItem(LOCAL_ENQ_KEY) || '[]').filter(e => String(e.id) !== String(id));
          localStorage.setItem(LOCAL_ENQ_KEY, JSON.stringify(local));
        } catch (e) {}
        if (this.supabase && !String(id).startsWith('enq_')) {
          try { await this.supabase.from('enquiries').delete().eq('id', id); } catch (e) {}
        }
        this.updateHudCounters();
        this.renderEnquiriesTab(container);
      });
    });
  }

  /* -------------------------------------------------------------------
     MODULE 8: REVISION HISTORY, 1-CLICK ROLLBACK & JSON BACKUP
     ------------------------------------------------------------------- */
  async fetchRevisions() {
    let remote = [];
    if (this.supabase) {
      try {
        const { data, error } = await this.supabase.from('site_revisions').select('id, note, created_at, created_by, data').order('id', { ascending: false }).limit(25);
        if (data && !error) remote = data.map(r => ({ ...r, origin: 'cloud' }));
      } catch (e) {}
    }
    let local = [];
    try { local = JSON.parse(localStorage.getItem(LOCAL_REV_KEY) || '[]').map(r => ({ ...r, origin: 'local' })); } catch (e) {}
    this.revisions = [...remote, ...local].slice(0, 30);
  }

  renderHistoryTab(container) {
    container.innerHTML = `
      <div class="cms-section-head">
        <h4>Revisions &amp; Snapshots</h4>
        <button type="button" class="cms-btn-subtle" id="cms-rev-refresh">↻ Sync</button>
      </div>
      <p class="cms-muted-note">Every publish records a full snapshot in <code>public.site_revisions</code>. Restore any previous state with one click.</p>

      <div class="cms-glass-card">
        <label class="cms-field-label">Full Site JSON Backup &amp; Restore</label>
        <div class="cms-grid-2">
          <button type="button" class="cms-btn-subtle" id="cms-export-json-btn">↓ Export JSON</button>
          <label class="cms-btn-subtle" style="cursor:pointer;">
            <span>↑ Import JSON</span>
            <input type="file" id="cms-import-json-input" accept="application/json" hidden>
          </label>
        </div>
      </div>

      <div class="cms-divider-line"><span>SAVED SNAPSHOTS (${this.revisions.length})</span></div>
      ${this.revisions.length ? this.revisions.map((r, idx) => `
        <div class="cms-list-item">
          <div style="min-width:0;flex:1;">
            <div style="display:flex;align-items:center;gap:6px;">
              <strong style="font-size:11px;">#${this.escape(r.id || idx + 1)}</strong>
              <span class="cms-badge ${r.origin === 'cloud' ? 'ok' : 'info'}">${this.escape(r.origin)}</span>
            </div>
            <div style="font-size:10px;color:var(--cms-muted);margin-top:2px;">${this.escape(r.note || 'Published snapshot')}</div>
            <div style="font-size:9px;color:var(--cms-dim);">${new Date(r.created_at).toLocaleString()} · ${this.escape(r.created_by || 'admin')}</div>
          </div>
          <button type="button" class="cms-btn-subtle" data-restore-rev="${idx}">Restore ↺</button>
        </div>
      `).join('') : '<p class="cms-muted-note">Publish your site once to create your first snapshot.</p>'}
    `;

    container.querySelector('#cms-rev-refresh').addEventListener('click', async () => {
      await this.fetchRevisions();
      this.renderHistoryTab(container);
      this.toast('Refreshed revision history', 'info');
    });

    container.querySelector('#cms-export-json-btn').addEventListener('click', () => {
      const blob = new Blob([JSON.stringify(this.draft, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `meaux-atelier-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      this.toast('Exported full site JSON backup', 'success');
    });

    container.querySelector('#cms-import-json-input').addEventListener('change', (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const parsed = JSON.parse(reader.result);
          this.pushUndoSnapshot();
          this.draft = this.runtime.mergeWithDefaults(JSON.parse(JSON.stringify(window.MEAUX_DEFAULT_CONTENT || {})), parsed);
          this.runtime.applyContent(this.draft);
          this.markDraftModified();
          this.toast('Imported JSON backup into draft — click Publish when ready', 'success');
        } catch (err) {
          this.toast('Invalid JSON file: ' + err.message, 'error');
        }
      };
      reader.readAsText(file);
    });

    container.querySelectorAll('[data-restore-rev]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const rev = this.revisions[Number(btn.dataset.restoreRev)];
        if (!rev || !rev.data) return;
        const ok = await this.confirmModal('Restore Revision?', `Load snapshot from ${new Date(rev.created_at).toLocaleString()} into your active draft?`, 'Restore Snapshot', false);
        if (!ok) return;
        this.pushUndoSnapshot();
        this.draft = this.runtime.mergeWithDefaults(JSON.parse(JSON.stringify(window.MEAUX_DEFAULT_CONTENT || {})), rev.data);
        this.runtime.applyContent(this.draft);
        this.markDraftModified();
        this.toast('Snapshot restored into draft! Click Publish to push live.', 'success');
      });
    });
  }

  /* -------------------------------------------------------------------
     MODULE 9: ADMINS & CURATOR ROLES
     ------------------------------------------------------------------- */
  async fetchAdmins() {
    if (this.supabase) {
      try {
        const { data, error } = await this.supabase.from('admins').select('email, role, display_name, created_at');
        if (data && !error) this.adminsList = data;
      } catch (e) {}
    }
    if (!this.adminsList.length) {
      this.adminsList = [{ email: this.runtime.config.initialAdmin || 'alexandru.n.bucur@gmail.com', role: 'owner' }];
    }
  }

  renderAdminsTab(container) {
    const currentEmail = (this.user.email || '').toLowerCase();
    container.innerHTML = `
      <div class="cms-section-head">
        <h4>Curator Team (${this.adminsList.length})</h4>
        <span class="cms-badge ok">RLS Protected</span>
      </div>
      <p class="cms-muted-note">Only emails authorized in <code>public.admins</code> can modify database records or publish live.</p>

      <div>
        ${this.adminsList.map(a => {
          const email = (a.email || a).toLowerCase();
          const role = a.role || 'curator';
          const isProtected = email === currentEmail || email === (this.runtime.config.initialAdmin || '').toLowerCase();
          return `
            <div class="cms-list-item">
              <div style="min-width:0;flex:1;">
                <strong style="font-size:11.5px;display:block;overflow:hidden;text-overflow:ellipsis;">${this.escape(email)}</strong>
                <span class="cms-badge info" style="margin-top:4px;">${this.escape(role)}</span>
              </div>
              ${!isProtected
                ? `<button type="button" class="cms-btn-subtle cms-btn-danger" data-remove-admin="${this.escape(email)}">Revoke</button>`
                : '<span class="cms-badge ok">Owner</span>'
              }
            </div>
          `;
        }).join('')}
      </div>

      <div class="cms-divider-line"><span>AUTHORIZE CURATOR</span></div>
      <div class="cms-glass-card">
        <div class="cms-control-group">
          <label>Google Account Email</label>
          <input type="email" id="cms-new-admin-email" class="cms-input" placeholder="curator@gmail.com">
        </div>
        <div class="cms-control-group">
          <label>Role</label>
          <select id="cms-new-admin-role" class="cms-select">
            <option value="curator">Curator (Full Studio Access)</option>
            <option value="editor">Editor (Content &amp; Media)</option>
            <option value="owner">Owner</option>
          </select>
        </div>
        <button type="button" id="cms-add-admin-btn" class="cms-luxury-btn">Authorize Account ↵</button>
      </div>
    `;

    container.querySelector('#cms-add-admin-btn').addEventListener('click', async () => {
      const email = (container.querySelector('#cms-new-admin-email').value || '').trim().toLowerCase();
      const role = container.querySelector('#cms-new-admin-role').value;
      if (!email || !email.includes('@')) return this.toast('Enter a valid email address', 'warn');
      if (this.adminsList.some(a => (a.email || a).toLowerCase() === email)) return this.toast('Already authorized', 'warn');

      if (this.supabase) {
        try {
          const { error } = await this.supabase.from('admins').insert({ email, role, added_by: this.user.email });
          if (error) throw error;
        } catch (err) {
          this.toast('DB notice: ' + err.message, 'warn');
        }
      }
      this.adminsList.push({ email, role });
      this.renderAdminsTab(container);
      this.toast(`Authorized ${email} as ${role}`, 'success');
    });

    container.querySelectorAll('[data-remove-admin]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const email = btn.dataset.removeAdmin;
        const ok = await this.confirmModal('Revoke Access?', `Remove admin access for ${email}?`, 'Revoke');
        if (!ok) return;
        if (this.supabase) {
          try { await this.supabase.from('admins').delete().eq('email', email); } catch (e) {}
        }
        this.adminsList = this.adminsList.filter(a => (a.email || a).toLowerCase() !== email);
        this.renderAdminsTab(container);
        this.toast(`Revoked access for ${email}`, 'info');
      });
    });
  }

  /* -------------------------------------------------------------------
     MODULE 10: SYSTEM SETTINGS & LIVE SUPABASE DATABASE HEALTH MONITOR
     ------------------------------------------------------------------- */
  async runDbHealthCheck() {
    this.dbHealth = {};
    if (!this.supabase) return;
    await Promise.all(REQUIRED_DB_TABLES.map(async (tbl) => {
      try {
        const { error } = await this.supabase.from(tbl.name).select('*', { head: true, count: 'exact' });
        if (!error) {
          this.dbHealth[tbl.name] = { status: 'ok', label: 'Ready' };
        } else if (error.code === '42P01' || /does not exist|schema cache/i.test(error.message)) {
          this.dbHealth[tbl.name] = { status: 'err', label: 'Missing' };
        } else if (error.code === '42501' || /permission|row-level/i.test(error.message)) {
          this.dbHealth[tbl.name] = { status: 'warn', label: 'RLS Protected' };
        } else {
          this.dbHealth[tbl.name] = { status: 'warn', label: error.code || 'Check' };
        }
      } catch (e) {
        this.dbHealth[tbl.name] = { status: 'err', label: 'Offline' };
      }
    }));
  }

  renderSettingsTab(container) {
    const settings = this.draft.settings || {};

    container.innerHTML = `
      <div class="cms-section-head">
        <h4>System, SEO &amp; Database</h4>
        <span class="cms-badge ${this.supabase ? 'ok' : 'warn'}">${this.supabase ? 'Supabase Linked' : 'Local Mode'}</span>
      </div>

      <div class="cms-glass-card">
        <div class="cms-control-group">
          <label>Website Meta Title</label>
          <input type="text" id="cms-site-title" class="cms-input" value="${this.escape(settings.siteTitle || '')}">
        </div>
        <div class="cms-control-group">
          <label>SEO Meta Description</label>
          <textarea id="cms-meta-desc" class="cms-textarea" rows="3">${this.escape(settings.metaDescription || '')}</textarea>
        </div>
        <div class="cms-grid-2">
          <div class="cms-control-group">
            <label>Commission Direct Email</label>
            <input type="email" id="cms-contact-email" class="cms-input" value="${this.escape(settings.contactEmail || '')}">
          </div>
          <div class="cms-control-group">
            <label>Instagram Profile URL</label>
            <input type="url" id="cms-ig-url" class="cms-input" value="${this.escape(settings.instagramUrl || 'https://www.instagram.com/meauxsvision/')}">
          </div>
        </div>
        <button type="button" id="cms-save-settings-btn" class="cms-luxury-btn">Save Site Settings ↵</button>
      </div>

      <!-- Live Database Schema Health Monitor -->
      <div class="cms-divider-line"><span>DATABASE TABLES &amp; SCHEMA HEALTH</span></div>
      <div class="cms-glass-card">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">
          <span class="cms-field-label" style="margin:0;">Required Postgres Tables (${REQUIRED_DB_TABLES.length})</span>
          <button type="button" class="cms-btn-subtle" id="cms-run-health-btn">⚡ Check Tables</button>
        </div>
        <div id="cms-db-health-list">
          ${REQUIRED_DB_TABLES.map(t => {
            const h = this.dbHealth[t.name];
            return `
              <div class="cms-db-table-row">
                <div>
                  <strong style="color:#fff;">public.${t.name}</strong>
                  <span style="display:block;font-size:9px;color:var(--cms-dim);">${this.escape(t.label)}</span>
                </div>
                <span class="cms-badge ${h ? h.status : ''}">${h ? h.label : 'Click Check'}</span>
              </div>
            `;
          }).join('')}
        </div>
        <div class="cms-grid-2" style="margin-top:12px;">
          <button type="button" class="cms-holo-btn" id="cms-copy-schema-btn" style="padding:9px 10px;font-size:10px;">⧉ Copy schema.sql</button>
          <button type="button" class="cms-btn-subtle" id="cms-sys-seed-btn" style="padding:9px 10px;">⚡ Seed Media &amp; Cats</button>
        </div>
        <p class="cms-muted-note" style="margin:10px 0 0;font-size:10px;">
          Paste <code>supabase/schema.sql</code> into Supabase → SQL Editor → Run to create/upgrade all 9 required tables idempotently.
        </p>
      </div>

      <div class="cms-divider-line"><span>SUPABASE CONNECTION</span></div>
      <div class="cms-glass-card">
        <div class="cms-control-group"><label>Project URL</label><input type="url" id="cms-sys-url" class="cms-input" value="${this.escape(this.runtime.config.supabaseUrl || '')}"></div>
        <div class="cms-control-group"><label>Anon Public Key</label><input type="password" id="cms-sys-key" class="cms-input" value="${this.escape(this.runtime.config.supabaseAnonKey || '')}"></div>
        <button type="button" id="cms-sys-save-creds" class="cms-btn-subtle" style="width:100%;">Update Credentials &amp; Reload</button>
      </div>
    `;

    container.querySelector('#cms-save-settings-btn').addEventListener('click', () => {
      this.pushUndoSnapshot();
      if (!this.draft.settings) this.draft.settings = {};
      this.draft.settings.siteTitle = container.querySelector('#cms-site-title').value.trim();
      this.draft.settings.metaDescription = container.querySelector('#cms-meta-desc').value.trim();
      this.draft.settings.contactEmail = container.querySelector('#cms-contact-email').value.trim();
      this.draft.settings.instagramUrl = container.querySelector('#cms-ig-url').value.trim();
      if (!this.draft.footer) this.draft.footer = {};
      this.draft.footer.instagramUrl = this.draft.settings.instagramUrl;
      this.runtime.applyContent(this.draft);
      this.markDraftModified();
      this.toast('Site settings saved', 'success');
    });

    container.querySelector('#cms-run-health-btn').addEventListener('click', async () => {
      const btn = container.querySelector('#cms-run-health-btn');
      btn.textContent = 'Checking...'; btn.disabled = true;
      await this.runDbHealthCheck();
      this.renderSettingsTab(container);
      this.toast('Database table check complete', 'info');
    });

    container.querySelector('#cms-copy-schema-btn').addEventListener('click', async () => {
      try {
        const resp = await fetch('supabase/schema.sql');
        if (!resp.ok) throw new Error('Could not fetch supabase/schema.sql');
        const sql = await resp.text();
        await navigator.clipboard.writeText(sql);
        this.toast('Copied full supabase/schema.sql to clipboard!', 'success');
      } catch (e) {
        this.toast('Open supabase/schema.sql from your repository to copy.', 'warn');
      }
    });

    container.querySelector('#cms-sys-seed-btn').addEventListener('click', async () => {
      await this.seedMediaToSupabase(true);
    });

    container.querySelector('#cms-sys-save-creds').addEventListener('click', () => {
      this.runtime.config.saveCredentials(
        container.querySelector('#cms-sys-url').value,
        container.querySelector('#cms-sys-key').value
      );
      window.location.reload();
    });
  }

  /* ===================================================================
     6. INLINE EDITING LISTENERS, DRAFT PERSISTENCE & PUBLISH
     =================================================================== */
  bindInlineEditing() {
    document.addEventListener('input', (e) => {
      if (!this.isEditMode) return;
      const el = e.target.closest('[data-cms-key], [data-cms]');
      if (!el) return;
      if (el.closest('#cms-admin-bar, #cms-admin-drawer, #cms-asset-dock, .cms-modal-overlay, dialog')) return;

      // Also sync edits inside custom dynamic blocks directly back to block JSON
      const blockWrapper = el.closest('.cms-dynamic-block');
      const blockField = el.getAttribute('data-block-field');
      if (blockWrapper && blockField) {
        const { pageId, blockId } = blockWrapper.dataset;
        const blk = this.draft.customBlocks?.[pageId]?.find(b => b.id === blockId);
        if (blk) blk[blockField] = el.textContent;
      }

      const key = el.getAttribute('data-cms-key') || el.getAttribute('data-cms');
      if (!this.draft.customContent) this.draft.customContent = {};
      this.draft.customContent[key] = el.innerHTML;

      const dotPath = el.getAttribute('data-cms');
      if (dotPath && dotPath.includes('.')) {
        const path = dotPath.split('.');
        let target = this.draft;
        for (let i = 0; i < path.length - 1; i++) {
          if (!target[path[i]]) target[path[i]] = {};
          target = target[path[i]];
        }
        target[path[path.length - 1]] = el.textContent.trim();
      }

      this.markDraftModified();
    });

    document.addEventListener('click', (e) => {
      if (!this.isEditMode) return;
      const editable = e.target.closest('.cms-editable-text, [contenteditable="true"]');
      if (editable) {
        const link = e.target.closest('a');
        if (link) e.preventDefault();
      }
    }, true);

    document.addEventListener('meaux:tab', () => {
      setTimeout(() => {
        if (this.isEditMode) this.toggleEditMode(true);
        if (['pages', 'blocks', 'backgrounds'].includes(this.activeDrawerTab)) {
          this.renderDrawerContent();
        }
      }, 80);
    });
  }

  updateAddBlockZones() {
    document.querySelectorAll('[data-cms-container]').forEach(container => {
      let zone = container.querySelector('.cms-add-block-zone');
      if (!zone && this.isEditMode) {
        zone = document.createElement('div');
        zone.className = 'cms-add-block-zone';
        zone.innerHTML = `<button type="button" class="cms-add-block-btn">+ Add Section Block to Page</button>`;
        zone.querySelector('button').addEventListener('click', () => this.openDrawerTab('blocks'));
        container.appendChild(zone);
      }
    });
  }

  markDraftModified() {
    this.dirtyCount++;
    const indicator = document.getElementById('cms-bar-indicator');
    if (indicator) indicator.className = 'cms-status-indicator draft';
    this.updateHudCounters();
    this.saveDraft();
  }

  saveDraft() {
    try { localStorage.setItem(LOCAL_DRAFT_KEY, JSON.stringify(this.draft)); } catch (e) {}
  }

  async publish() {
    const btn = document.getElementById('cms-publish-btn');
    if (btn) btn.disabled = true;

    const note = `Published by ${this.user.email} at ${new Date().toLocaleTimeString()}`;
    let cloudSaved = false;

    if (this.supabase) {
      try {
        const { error } = await this.supabase.rpc('publish_site', { doc: this.draft, note });
        if (error) throw error;
        cloudSaved = true;
      } catch (err) {
        try {
          const { error: directError } = await this.supabase
            .from('site_content')
            .upsert({ key: 'published', data: this.draft, updated_at: new Date().toISOString(), updated_by: this.user.email });
          if (!directError) cloudSaved = true;
          else throw directError;
        } catch (tableErr) {
          console.warn('Supabase publish fallback notice:', err.message);
        }
      }
    }

    // Always persist published snapshot & local revision history
    try {
      localStorage.setItem(LOCAL_PUB_KEY, JSON.stringify(this.draft));
      const localRevs = JSON.parse(localStorage.getItem(LOCAL_REV_KEY) || '[]');
      localRevs.unshift({
        id: 'L' + Date.now().toString(36),
        note,
        created_at: new Date().toISOString(),
        created_by: this.user.email || 'admin',
        data: JSON.parse(JSON.stringify(this.draft))
      });
      localStorage.setItem(LOCAL_REV_KEY, JSON.stringify(localRevs.slice(0, 20)));
    } catch (e) {}

    this.dirtyCount = 0;
    const indicator = document.getElementById('cms-bar-indicator');
    if (indicator) indicator.className = 'cms-status-indicator';
    if (btn) btn.disabled = false;
    this.updateHudCounters();
    await this.fetchRevisions();
    if (this.activeDrawerTab === 'history') this.renderDrawerContent();

    this.toast(
      cloudSaved
        ? 'Published live to Supabase production database!'
        : 'Published live to local cache (Sign in via Google/Magic Link for cloud sync)',
      'success'
    );
  }

  escape(str) {
    return String(str || '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }
}
