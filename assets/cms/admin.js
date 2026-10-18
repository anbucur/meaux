/* =====================================================================
   MEAUX CMS — ADMIN CONTROLLER & INLINE EDITING SUITE
   ===================================================================== */

const GOOGLE_FONTS = [
  { name: 'Syne', family: "'Syne', sans-serif" },
  { name: 'Cormorant Garamond', family: "'Cormorant Garamond', serif" },
  { name: 'Space Mono', family: "'Space Mono', monospace" },
  { name: 'Playfair Display', family: "'Playfair Display', serif" },
  { name: 'Cinzel', family: "'Cinzel', serif" },
  { name: 'Italiana', family: "'Italiana', serif" },
  { name: 'Bodoni Moda', family: "'Bodoni Moda', serif" },
  { name: 'Outfit', family: "'Outfit', sans-serif" },
  { name: 'Inter', family: "'Inter', sans-serif" },
  { name: 'JetBrains Mono', family: "'JetBrains Mono', monospace" }
];

export async function initAdmin(runtime) {
  // 1. Inject Admin CSS
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = 'assets/cms/admin.css';
  document.head.appendChild(link);

  const admin = new AdminManager(runtime);
  await admin.mount();
  return admin;
}

class AdminManager {
  constructor(runtime) {
    this.runtime = runtime;
    this.supabase = runtime.supabase;
    this.user = runtime.user;
    this.draft = JSON.parse(JSON.stringify(runtime.content || {}));
    this.isEditMode = false;
    this.drawerOpen = false;
    this.activeDrawerTab = 'pages';
    this.adminsList = [];
    this.mediaList = [];
    this.revisions = [];
  }

  async mount() {
    // Check if unpublished draft exists in localStorage
    try {
      const localDraft = localStorage.getItem('meaux_content_draft');
      if (localDraft) {
        this.draft = JSON.parse(localDraft);
        this.runtime.applyContent(this.draft);
      }
    } catch (e) {}

    this.buildAdminBar();
    this.buildDrawer();
    this.bindInlineEditing();
    await this.fetchAdmins();
    await this.fetchMedia();
    this.renderDrawerContent();
  }

  buildAdminBar() {
    let bar = document.getElementById('cms-admin-bar');
    if (bar) bar.remove();

    bar = document.createElement('div');
    bar.id = 'cms-admin-bar';
    bar.innerHTML = `
      <div class="cms-admin-badge">
        <span class="cms-status-indicator" id="cms-bar-indicator"></span>
        <span>${this.user.email ? this.user.email.split('@')[0] : 'Admin'}</span>
      </div>
      <button type="button" class="cms-bar-btn" id="cms-toggle-edit-btn">
        <span id="cms-edit-btn-label">Edit Mode: Off</span>
      </button>
      <button type="button" class="cms-bar-btn" id="cms-open-drawer-btn">
        <span>Studio Panel ☰</span>
      </button>
      <button type="button" class="cms-bar-btn primary" id="cms-publish-btn">
        <span>Publish Live ↵</span>
      </button>
      <button type="button" class="cms-bar-btn" id="cms-signout-btn" title="Sign out of Admin session">
        <span>Sign Out ✕</span>
      </button>
    `;
    document.body.appendChild(bar);

    document.getElementById('cms-toggle-edit-btn').addEventListener('click', () => {
      this.toggleEditMode();
    });

    document.getElementById('cms-open-drawer-btn').addEventListener('click', () => {
      this.toggleSidebar();
    });

    document.getElementById('cms-publish-btn').addEventListener('click', () => {
      this.publish();
    });

    document.getElementById('cms-signout-btn').addEventListener('click', async () => {
      if (this.supabase) {
        await this.supabase.auth.signOut();
      }
      sessionStorage.removeItem('meaux_mock_admin_session');
      window.location.reload();
    });
  }

  toggleEditMode(forceState = null) {
    this.isEditMode = forceState !== null ? forceState : !this.isEditMode;
    document.body.classList.toggle('cms-editing', this.isEditMode);

    const btn = document.getElementById('cms-toggle-edit-btn');
    const label = document.getElementById('cms-edit-btn-label');
    if (btn && label) {
      btn.classList.toggle('active', this.isEditMode);
      label.textContent = this.isEditMode ? 'Edit Mode: ON' : 'Edit Mode: OFF';
    }

    // Ensure all elements have deterministic keys
    if (this.runtime && this.runtime.assignContentAndImageKeys) {
      this.runtime.assignContentAndImageKeys();
    }

    // Select all site textual content across the entire page
    const textSelectors = [
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p',
      '.small-label', '.about-statement', '.card-num', '.value-num',
      '.discipline-title', '.discipline-subtitle', '.discipline-tagline span',
      '.hero-signature span', '.hero-image-caption',
      '.story-chapter h3', '.story-chapter p',
      '.value-card h3', '.value-card p',
      '.client-item', '.meta-content', '[data-cms]', '[data-cms-key]'
    ];

    document.querySelectorAll(textSelectors.join(', ')).forEach((el, index) => {
      // Never make admin UI elements editable
      if (el.closest('#cms-admin-bar, #cms-admin-drawer, #cms-login-modal, #cms-image-picker-modal, dialog')) {
        return;
      }
      if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'BUTTON' || el.closest('button.tab-btn')) {
        return;
      }

      if (!el.getAttribute('data-cms-key')) {
        const explicit = el.getAttribute('data-cms');
        const fallbackKey = 'text_' + (el.id || (el.className.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 20) + '_' + index));
        el.setAttribute('data-cms-key', explicit || fallbackKey);
      }

      if (this.isEditMode) {
        el.setAttribute('contenteditable', 'true');
        el.classList.add('cms-editable-text');
      } else {
        el.removeAttribute('contenteditable');
        el.classList.remove('cms-editable-text');
      }
    });

    // Toggle image swap overlays
    this.bindImageEditing();

    // Toggle add block zones
    this.updateAddBlockZones();
  }

  bindImageEditing() {
    const images = document.querySelectorAll('main img, .hero-image, .about-portrait-wrap img, .discipline-narrative-split img, .project-image-wrap img');
    images.forEach(img => {
      if (img.closest('#cms-admin-bar, #cms-admin-drawer, #cms-login-modal, #cms-image-picker-modal, dialog')) return;
      const container = img.closest('.image-link') || img.closest('.narrative-image-wrap') || img.closest('.about-portrait-wrap') || img.parentElement || img;
      if (this.isEditMode) {
        container.classList.add('cms-image-editable');
        if (!container.__cmsClickHandler) {
          container.__cmsClickHandler = (e) => {
            if (!this.isEditMode) return;
            e.preventDefault();
            e.stopPropagation();
            this.openImagePickerModal(img);
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

  openImagePickerModal(targetImg) {
    let modal = document.getElementById('cms-image-picker-modal');
    if (modal) modal.remove();

    const currentImgSrc = targetImg.src || '';
    const imgKey = targetImg.getAttribute('data-cms-img') || this.getElementSelector(targetImg);

    modal = document.createElement('div');
    modal.id = 'cms-image-picker-modal';
    modal.className = 'cms-modal-overlay';
    modal.innerHTML = `
      <div class="cms-modal-card" style="max-width: 720px; max-height: 88vh; display: flex; flex-direction: column;">
        <div class="cms-modal-header">
          <div>
            <span class="small-label">Atelier Asset Vault</span>
            <h3 class="cms-modal-title" style="font-size: 20px; margin: 4px 0;">Swap Image</h3>
            <span style="font-size: 10px; color: #71717a; font-family: monospace;">Key: ${this.escape(imgKey)}</span>
          </div>
          <button type="button" class="cms-modal-close" id="cms-img-picker-close">✕</button>
        </div>

        <!-- Quick Upload / URL Controls -->
        <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.1); padding: 14px; margin-bottom: 16px; border-radius: 4px;">
          <div style="display: flex; gap: 12px; align-items: center; margin-bottom: 10px; flex-wrap: wrap;">
            <span style="font-size: 10px; text-transform: uppercase; letter-spacing: 0.1em; color: #a1a1aa;">Upload & Swap:</span>
            <label style="font-size: 11px; display: flex; align-items: center; gap: 4px; cursor: pointer;">
              <input type="radio" name="modal-upload-mode" value="blob" checked>
              <span>Database Blob (Postgres Base64)</span>
            </label>
            <label style="font-size: 11px; display: flex; align-items: center; gap: 4px; cursor: pointer;">
              <input type="radio" name="modal-upload-mode" value="storage">
              <span>Storage Bucket</span>
            </label>
          </div>
          <div style="display: flex; gap: 8px;">
            <input type="file" id="cms-modal-file-upload" accept="image/*" class="cms-input" style="flex: 1; padding: 6px;">
            <div id="cms-modal-upload-status" style="font-size: 11px; color: #22c55e; align-self: center;"></div>
          </div>

          <div class="cms-divider-line" style="margin: 12px 0;"><span>OR ENTER URL</span></div>

          <div style="display: flex; gap: 8px;">
            <input type="text" id="cms-img-url-input" class="cms-input" placeholder="Paste image link (https://...)" value="${currentImgSrc}" style="flex: 1;">
            <button type="button" id="cms-apply-img-url-btn" class="cms-btn-subtle" style="white-space: nowrap;">Apply Link ↵</button>
          </div>
        </div>

        <!-- Library Filter & Grid -->
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
          <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 0.1em; color: #a1a1aa;">
            Media Library (<span id="cms-picker-count">${this.mediaList.length}</span> items):
          </div>
          <input type="search" id="cms-picker-search" placeholder="Filter images..." style="background: #18181b; border: 1px solid rgba(255,255,255,0.2); color: #fff; padding: 4px 8px; font-size: 11px; width: 160px;">
        </div>

        <div class="cms-media-grid" id="cms-picker-grid" style="overflow-y: auto; max-height: 320px; padding-right: 4px;">
          <!-- Thumbs rendered dynamically -->
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    const renderThumbs = (query = '') => {
      const grid = document.getElementById('cms-picker-grid');
      if (!grid) return;
      const lower = query.toLowerCase();
      const filtered = this.mediaList.filter(m => 
        !lower || (m.name && m.name.toLowerCase().includes(lower)) || (m.title && m.title.toLowerCase().includes(lower)) || (m.filename && m.filename.toLowerCase().includes(lower))
      );
      document.getElementById('cms-picker-count').textContent = filtered.length;

      grid.innerHTML = filtered.map(m => `
        <div class="cms-media-thumb" data-url="${m.url}" title="${this.escape(m.title || m.name || m.filename)}">
          <img src="${m.url}" loading="lazy">
          <span style="position: absolute; bottom: 2px; left: 2px; font-size: 8px; background: rgba(0,0,0,0.75); color: #fff; padding: 1px 4px; border-radius: 2px; text-transform: uppercase;">
            ${m.source || (m.isBlob ? 'blob' : 'catalog')}
          </span>
        </div>
      `).join('');

      grid.querySelectorAll('.cms-media-thumb').forEach(thumb => {
        thumb.addEventListener('click', () => {
          applyImage(thumb.dataset.url);
        });
      });
    };

    renderThumbs();

    document.getElementById('cms-picker-search').addEventListener('input', (e) => {
      renderThumbs(e.target.value.trim());
    });

    document.getElementById('cms-img-picker-close').addEventListener('click', () => modal.remove());
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });

    const applyImage = (url) => {
      targetImg.src = url;
      if (!this.draft.customImages) this.draft.customImages = {};
      this.draft.customImages[imgKey] = url;
      this.markDraftModified();
      modal.remove();
    };

    document.getElementById('cms-apply-img-url-btn').addEventListener('click', () => {
      const url = document.getElementById('cms-img-url-input').value.trim();
      if (url) applyImage(url);
    });

    // Handle instant file upload directly inside picker modal
    document.getElementById('cms-modal-file-upload').addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const statusEl = document.getElementById('cms-modal-upload-status');
      statusEl.textContent = 'Uploading...';
      const mode = modal.querySelector('input[name="modal-upload-mode"]:checked').value;
      
      const newUrl = await this.uploadMediaFile(file, mode);
      if (newUrl) {
        statusEl.textContent = '✓ Uploaded!';
        renderThumbs();
        applyImage(newUrl);
      }
    });
  }

  getElementSelector(el) {
    if (el.getAttribute('data-cms-img')) return `[data-cms-img="${el.getAttribute('data-cms-img')}"]`;
    if (el.id) return '#' + el.id;
    if (el.dataset.post) return `[data-post="${el.dataset.post}"] img`;
    const parent = el.closest('[data-tab-target]') || el.parentElement;
    if (parent && parent.className) {
      return '.' + parent.className.split(' ')[0] + ' img';
    }
    return el.tagName.toLowerCase();
  }

  toggleSidebar(forceState = null) {
    this.drawerOpen = forceState !== null ? forceState : !this.drawerOpen;
    const drawer = document.getElementById('cms-admin-drawer');
    if (drawer) {
      drawer.classList.toggle('open', this.drawerOpen);
    }
  }

  buildDrawer() {
    let drawer = document.getElementById('cms-admin-drawer');
    if (drawer) drawer.remove();

    drawer = document.createElement('div');
    drawer.id = 'cms-admin-drawer';
    drawer.innerHTML = `
      <div class="cms-drawer-header">
        <div>
          <span class="small-label">Atelier Architecture</span>
          <h3>Studio Control</h3>
        </div>
        <button type="button" class="cms-drawer-close" id="cms-drawer-close-btn">✕</button>
      </div>

      <nav class="cms-drawer-tabs">
        <button type="button" class="cms-drawer-tab active" data-tab="pages">Pages</button>
        <button type="button" class="cms-drawer-tab" data-tab="sections">Add Section</button>
        <button type="button" class="cms-drawer-tab" data-tab="theme">Typography</button>
        <button type="button" class="cms-drawer-tab" data-tab="portfolio">Portfolio</button>
        <button type="button" class="cms-drawer-tab" data-tab="media">Media</button>
        <button type="button" class="cms-drawer-tab" data-tab="admins">Admins</button>
        <button type="button" class="cms-drawer-tab" data-tab="settings">Settings</button>
      </nav>

      <div class="cms-drawer-body" id="cms-drawer-content">
        <!-- Injected dynamically -->
      </div>
    `;
    document.body.appendChild(drawer);

    document.getElementById('cms-drawer-close-btn').addEventListener('click', () => {
      this.toggleSidebar(false);
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

    if (this.activeDrawerTab === 'pages') {
      this.renderPagesTab(container);
    } else if (this.activeDrawerTab === 'sections') {
      this.renderSectionsTab(container);
    } else if (this.activeDrawerTab === 'theme') {
      this.renderThemeTab(container);
    } else if (this.activeDrawerTab === 'portfolio') {
      this.renderPortfolioTab(container);
    } else if (this.activeDrawerTab === 'media') {
      this.renderMediaTab(container);
    } else if (this.activeDrawerTab === 'admins') {
      this.renderAdminsTab(container);
    } else if (this.activeDrawerTab === 'settings') {
      this.renderSettingsTab(container);
    }
  }

  /* -------------------------------------------------------------------
     TAB: PAGES & NAVIGATION
     ------------------------------------------------------------------- */
  renderPagesTab(container) {
    const pages = this.draft.pages || [];
    const itemsHtml = pages.map(p => `
      <div class="cms-list-item">
        <div>
          <strong>${this.escape(p.title)}</strong>
          <span style="color: #71717a; font-size: 10px; margin-left: 8px;">#${this.escape(p.id)}</span>
        </div>
        <div class="flex gap-2">
          <button type="button" class="cms-btn-subtle" onclick="window.MeauxSite.switchTab('${p.id}')">View</button>
          ${!p.isSystem ? `<button type="button" class="cms-btn-subtle cms-btn-danger" data-delete-page="${p.id}">Delete</button>` : ''}
        </div>
      </div>
    `).join('');

    container.innerHTML = `
      <div class="cms-control-group">
        <label>Atelier Navigation Pages</label>
        <p style="font-size: 11px; color: #a1a1aa; margin-bottom: 16px;">
          Manage navigation tabs and dedicated discipline spaces.
        </p>
        <div id="cms-pages-list">${itemsHtml}</div>
      </div>

      <div class="cms-divider-line"><span>ADD NEW PAGE</span></div>

      <div class="cms-control-group">
        <label>Page Title</label>
        <input type="text" id="cms-new-page-title" class="cms-input" placeholder="e.g. Exhibitions, Editorial Archive">
      </div>
      <div class="cms-control-group">
        <label>URL Slug / ID</label>
        <input type="text" id="cms-new-page-id" class="cms-input" placeholder="e.g. exhibitions">
      </div>
      <button type="button" id="cms-add-page-btn" class="cms-luxury-btn">
        Create New Page ↵
      </button>
    `;

    document.getElementById('cms-new-page-title').addEventListener('input', (e) => {
      const slugInput = document.getElementById('cms-new-page-id');
      slugInput.value = e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    });

    document.getElementById('cms-add-page-btn').addEventListener('click', () => {
      const title = document.getElementById('cms-new-page-title').value.trim();
      const id = document.getElementById('cms-new-page-id').value.trim();
      if (!title || !id) return alert('Please enter both title and slug.');
      this.addPage(id, title);
    });

    container.querySelectorAll('[data-delete-page]').forEach(btn => {
      btn.addEventListener('click', () => {
        this.deletePage(btn.dataset.deletePage);
      });
    });
  }

  addPage(id, title) {
    if (this.draft.pages.some(p => p.id === id)) {
      return alert('A page with this ID already exists.');
    }
    this.draft.pages.push({ id, title, isSystem: false });
    this.createPageViewInDOM(id, title);
    this.saveDraft();
    this.renderPagesTab(document.getElementById('cms-drawer-content'));
    window.MeauxSite.switchTab(id);
  }

  deletePage(id) {
    if (!confirm(`Are you sure you want to remove page "${id}"?`)) return;
    this.draft.pages = this.draft.pages.filter(p => p.id !== id);
    if (this.draft.customBlocks) delete this.draft.customBlocks[id];
    
    // Remove from DOM
    const view = document.getElementById(`view-${id}`);
    if (view) view.remove();
    const btn = document.querySelector(`.atelier-tabs button[data-tab="${id}"]`);
    if (btn) btn.remove();

    this.saveDraft();
    this.renderPagesTab(document.getElementById('cms-drawer-content'));
    window.MeauxSite.switchTab('atelier');
  }

  createPageViewInDOM(id, title) {
    // 1. Add tab button
    const nav = document.querySelector('.atelier-tabs');
    const enquireBtn = nav.querySelector('.tab-enquire');
    const newBtn = document.createElement('button');
    newBtn.type = 'button';
    newBtn.className = 'tab-btn';
    newBtn.dataset.tab = id;
    newBtn.innerHTML = `<span>${this.escape(title)}</span>`;
    nav.insertBefore(newBtn, enquireBtn);

    // 2. Add page section view
    const main = document.getElementById('main-content');
    const view = document.createElement('div');
    view.id = `view-${id}`;
    view.className = 'tab-view';
    view.setAttribute('role', 'tabpanel');
    view.hidden = true;
    view.innerHTML = `
      <section class="discipline-page" data-cms-container>
        <div class="discipline-header">
          <div class="discipline-tagline">
            <span>ATELIER MEAUX // BESPOKE</span>
          </div>
          <h2 class="discipline-title">${this.escape(title)}</h2>
          <p class="discipline-subtitle">Custom space conceived by Mohammed.</p>
        </div>
      </section>
    `;
    main.appendChild(view);
  }

  /* -------------------------------------------------------------------
     TAB: SECTIONS / BLOCKS
     ------------------------------------------------------------------- */
  renderSectionsTab(container) {
    const currentTab = window.MeauxSite ? window.MeauxSite.getActiveTab() : 'atelier';

    container.innerHTML = `
      <div class="cms-control-group">
        <label>Target Page</label>
        <div style="font-size: 13px; font-weight: 700; color: #fff; margin-bottom: 12px;">
          Currently editing: <span style="text-transform: uppercase;">[ ${currentTab} ]</span>
        </div>
        <p style="font-size: 11px; color: #a1a1aa; margin-bottom: 20px;">
          Choose a section type to insert into the currently active tab.
        </p>
      </div>

      <div class="flex flex-col gap-3">
        <button type="button" class="cms-list-item" style="cursor: pointer; text-align: left;" data-add-block="heading-text">
          <div>
            <strong>Heading & Editorial Subtitle</strong>
            <p style="font-size: 10px; color: #71717a; margin-top: 4px;">Grand architectural title with italic quote and tagline</p>
          </div>
          <span style="font-size: 16px;">+</span>
        </button>

        <button type="button" class="cms-list-item" style="cursor: pointer; text-align: left;" data-add-block="narrative">
          <div>
            <strong>Narrative Image & Chapter Split</strong>
            <p style="font-size: 10px; color: #71717a; margin-top: 4px;">Sculptural left portrait paired with editorial narrative body</p>
          </div>
          <span style="font-size: 16px;">+</span>
        </button>

        <button type="button" class="cms-list-item" style="cursor: pointer; text-align: left;" data-add-block="quote">
          <div>
            <strong>Monumental Interlude Quote</strong>
            <p style="font-size: 10px; color: #71717a; margin-top: 4px;">Full-bleed typographic statement on obsidian backdrop</p>
          </div>
          <span style="font-size: 16px;">+</span>
        </button>

        <button type="button" class="cms-list-item" style="cursor: pointer; text-align: left;" data-add-block="gallery">
          <div>
            <strong>Curated Photographic Grid</strong>
            <p style="font-size: 10px; color: #71717a; margin-top: 4px;">Three-column gallery with floating hover metadata overlays</p>
          </div>
          <span style="font-size: 16px;">+</span>
        </button>
      </div>
    `;

    container.querySelectorAll('[data-add-block]').forEach(btn => {
      btn.addEventListener('click', () => {
        this.addSectionBlock(currentTab, btn.dataset.addBlock);
      });
    });
  }

  addSectionBlock(pageId, type) {
    if (!this.draft.customBlocks) this.draft.customBlocks = {};
    if (!this.draft.customBlocks[pageId]) this.draft.customBlocks[pageId] = [];

    const id = 'blk_' + Math.random().toString(36).substr(2, 9);
    let newBlock = { id, type };

    if (type === 'heading-text') {
      newBlock.tagline = 'NEW CHAPTER // ARCHITECTURE';
      newBlock.title = 'The Form of Presence';
      newBlock.subtitle = '“Light does not define space; shadow isolates its sovereign truth.”';
    } else if (type === 'narrative') {
      newBlock.imageUrl = 'instagram/meauxsvision/images/DZ5dX4SjAXv.jpg';
      newBlock.imageCaption = 'Portrait Study · Amsterdam';
      newBlock.heading = 'Tactile Rigor';
      newBlock.body = 'Every material carries memory. From cold machined steel to hand-tanned obsidian leathers, our practice orchestrates visceral tension.';
    } else if (type === 'quote') {
      newBlock.quote = 'Form follows feeling.';
      newBlock.author = 'Mohammed / Meaux';
    } else if (type === 'gallery') {
      newBlock.title = 'Atmospheric Studies';
      newBlock.images = [
        { url: 'instagram/meauxsvision/images/DEXuQ0gNbcp.jpg', title: 'Study 01', subtitle: 'Chiaroscuro' },
        { url: 'instagram/meauxsvision/images/CbI4R9FMcTQ.jpg', title: 'Study 02', subtitle: 'Campaign' },
        { url: 'instagram/meauxsvision/images/CqOSc5kN3gA.jpg', title: 'Study 03', subtitle: 'Movement' }
      ];
    }

    this.draft.customBlocks[pageId].push(newBlock);
    this.runtime.applyContent(this.draft);
    this.saveDraft();
    this.toggleEditMode(true);
    alert(`Added new ${type} section to page [${pageId}].`);
  }

  /* -------------------------------------------------------------------
     TAB: THEME & TYPOGRAPHY
     ------------------------------------------------------------------- */
  renderThemeTab(container) {
    const theme = this.draft.theme || {};
    const fontsHtml = GOOGLE_FONTS.map(f => `
      <option value="${f.family}">${f.name}</option>
    `).join('');

    container.innerHTML = `
      <div class="cms-control-group">
        <label>Architectural Display Font (Headings)</label>
        <select id="cms-font-display" class="cms-select">${fontsHtml}</select>
      </div>

      <div class="cms-control-group">
        <label>High-Contrast Editorial Serif (Subtitles & Statements)</label>
        <select id="cms-font-serif" class="cms-select">${fontsHtml}</select>
      </div>

      <div class="cms-control-group">
        <label>Technical Monospace (Body, Metadata & Specs)</label>
        <select id="cms-font-mono" class="cms-select">${fontsHtml}</select>
      </div>

      <div class="cms-divider-line"><span>ATMOSPHERE PALETTE</span></div>

      <div class="cms-control-group">
        <label>Obsidian Background Color</label>
        <input type="color" id="cms-color-obsidian" class="cms-input" value="${(theme.colors && theme.colors.obsidian) || '#050506'}" style="height: 42px; padding: 4px;">
      </div>

      <div class="cms-control-group">
        <label>Paper White Accent Color</label>
        <input type="color" id="cms-color-paper" class="cms-input" value="${(theme.colors && theme.colors.paper) || '#f4f4f0'}" style="height: 42px; padding: 4px;">
      </div>

      <button type="button" id="cms-apply-theme-btn" class="cms-luxury-btn">
        Apply Typography & Colors ↵
      </button>
    `;

    // Set initial values
    if (theme.fontDisplay) document.getElementById('cms-font-display').value = theme.fontDisplay;
    if (theme.fontSerif) document.getElementById('cms-font-serif').value = theme.fontSerif;
    if (theme.fontMono) document.getElementById('cms-font-mono').value = theme.fontMono;

    document.getElementById('cms-apply-theme-btn').addEventListener('click', () => {
      if (!this.draft.theme) this.draft.theme = {};
      this.draft.theme.fontDisplay = document.getElementById('cms-font-display').value;
      this.draft.theme.fontSerif = document.getElementById('cms-font-serif').value;
      this.draft.theme.fontMono = document.getElementById('cms-font-mono').value;
      this.draft.theme.colors = {
        obsidian: document.getElementById('cms-color-obsidian').value,
        paper: document.getElementById('cms-color-paper').value
      };

      this.runtime.applyContent(this.draft);
      this.saveDraft();
      alert('Theme typography and colors applied.');
    });
  }

  /* -------------------------------------------------------------------
     TAB: PORTFOLIO & ARCHIVE CURATION
     ------------------------------------------------------------------- */
  renderPortfolioTab(container) {
    const portfolio = window.MeauxSite.getPortfolio();
    const curatedIds = new Set(portfolio.selected.map(c => c.id));

    const itemsHtml = portfolio.items.slice(0, 20).map(item => `
      <div class="cms-list-item">
        <div style="display: flex; align-items: center; gap: 10px;">
          <img src="${item.image_url || `instagram/meauxsvision/images/${item.image_file}`}" style="width: 40px; height: 40px; object-fit: cover;">
          <div>
            <strong style="font-size: 11px;">${this.escape(item.shortcode)}</strong>
            <p style="font-size: 9px; color: #71717a; margin: 0;">${curatedIds.has(item.shortcode) ? '★ Curated in Top 8' : 'Archive'}</p>
          </div>
        </div>
        <button type="button" class="cms-btn-subtle ${curatedIds.has(item.shortcode) ? 'active' : ''}" data-toggle-curated="${item.shortcode}">
          ${curatedIds.has(item.shortcode) ? 'Remove' : 'Feature'}
        </button>
      </div>
    `).join('');

    container.innerHTML = `
      <div class="cms-control-group">
        <label>Selected Portfolio Works (${portfolio.selected.length})</label>
        <p style="font-size: 11px; color: #a1a1aa; margin-bottom: 16px;">
          Toggle works featured in the main Atelier landing grid.
        </p>
        <div style="max-height: 450px; overflow-y: auto;">${itemsHtml}</div>
      </div>
    `;

    container.querySelectorAll('[data-toggle-curated]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.toggleCurated;
        if (curatedIds.has(id)) {
          portfolio.selected = portfolio.selected.filter(c => c.id !== id);
        } else {
          portfolio.selected.push({ id, title: id, category: 'Photography' });
        }
        this.draft.portfolio = portfolio;
        window.MeauxSite.setPortfolio(portfolio);
        this.saveDraft();
        this.renderPortfolioTab(container);
      });
    });
  }

  /* -------------------------------------------------------------------
     TAB: MEDIA LIBRARY & UPLOADS
     ------------------------------------------------------------------- */
  renderMediaTab(container) {
    const isSupabaseConnected = !!this.supabase;

    container.innerHTML = `
      <div class="cms-control-group">
        <label>Media Asset Ingestion</label>
        <p style="font-size: 11px; color: #a1a1aa; margin-bottom: 12px;">
          Upload imagery as direct Database Blobs (Base64 in PostgreSQL) or Storage Bucket public URLs.
        </p>

        <!-- Mode selector -->
        <div style="display: flex; gap: 14px; margin-bottom: 12px; background: rgba(255,255,255,0.04); padding: 10px; border: 1px solid rgba(255,255,255,0.1); border-radius: 4px;">
          <label style="font-size: 11px; display: flex; align-items: center; gap: 6px; cursor: pointer;">
            <input type="radio" name="cms-upload-dest" value="blob" checked>
            <span><strong>Database Blob</strong> (Base64 in DB)</span>
          </label>
          <label style="font-size: 11px; display: flex; align-items: center; gap: 6px; cursor: pointer;">
            <input type="radio" name="cms-upload-dest" value="storage">
            <span><strong>Storage Bucket</strong> (CDN URL)</span>
          </label>
        </div>

        <input type="file" id="cms-file-uploader" accept="image/*" class="cms-input" style="padding: 8px;">
        <div id="cms-upload-progress" style="font-size: 11px; color: #22c55e; margin-top: 6px;"></div>
      </div>

      <div class="cms-control-group" style="margin-top: 14px;">
        <label>Add Image by Web Link</label>
        <div style="display: flex; gap: 8px;">
          <input type="text" id="cms-add-link-input" class="cms-input" placeholder="https://images.unsplash.com/..." style="flex: 1;">
          <button type="button" id="cms-add-link-btn" class="cms-btn-subtle" style="white-space: nowrap;">Add Link ↵</button>
        </div>
      </div>

      <div class="cms-divider-line"><span>ATELIER MEDIA VAULT</span></div>

      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
        <span style="font-size: 11px; text-transform: uppercase; letter-spacing: 0.1em; color: #a1a1aa;">
          All Assets (<span id="cms-media-tab-count">${this.mediaList.length}</span>)
        </span>
        <button type="button" id="cms-seed-db-btn" class="cms-btn-subtle" title="Sync all 61 portfolio pictures into the Supabase database table">
          ⚡ Seed 61 Pictures to DB
        </button>
      </div>

      <input type="search" id="cms-media-tab-search" placeholder="Search archive by keyword..." class="cms-input" style="margin-bottom: 12px; font-size: 11px;">

      <div class="cms-media-grid" id="cms-media-tab-grid" style="max-height: 400px; overflow-y: auto; padding-right: 4px;">
        <!-- Injected via renderMediaList() -->
      </div>
    `;

    const renderMediaList = (query = '') => {
      const grid = document.getElementById('cms-media-tab-grid');
      if (!grid) return;
      const lower = query.toLowerCase();
      const filtered = this.mediaList.filter(m => 
        !lower || (m.name && m.name.toLowerCase().includes(lower)) || (m.title && m.title.toLowerCase().includes(lower)) || (m.filename && m.filename.toLowerCase().includes(lower))
      );
      document.getElementById('cms-media-tab-count').textContent = filtered.length;

      if (!filtered.length) {
        grid.innerHTML = '<p style="font-size: 11px; color: #71717a; grid-column: span 3;">No images matching filter.</p>';
        return;
      }

      grid.innerHTML = filtered.map(m => `
        <div class="cms-media-thumb" data-media-url="${m.url}" data-media-id="${m.id || ''}" title="${this.escape(m.title || m.name || m.filename)}">
          <img src="${m.url}" loading="lazy">
          <span style="position: absolute; bottom: 2px; left: 2px; font-size: 8px; background: rgba(0,0,0,0.8); color: #fff; padding: 1px 4px; border-radius: 2px; text-transform: uppercase;">
            ${m.source || (m.isBlob ? 'blob' : 'catalog')}
          </span>
          ${m.source === 'upload' || m.source === 'blob' || m.source === 'storage' || m.source === 'link' ? `
            <button type="button" class="cms-media-del-btn" data-del-id="${m.id || ''}" style="position: absolute; top: 2px; right: 2px; background: rgba(220,38,38,0.85); color: #fff; border: none; border-radius: 50%; width: 18px; height: 18px; font-size: 10px; cursor: pointer; display: flex; align-items: center; justify-content: center;" title="Delete this upload">✕</button>
          ` : ''}
        </div>
      `).join('');

      grid.querySelectorAll('.cms-media-thumb').forEach(thumb => {
        thumb.addEventListener('click', (e) => {
          if (e.target.closest('.cms-media-del-btn')) return;
          const url = thumb.dataset.mediaUrl;
          if (url.startsWith('data:')) {
            alert('Copied Database Blob (Base64) to clipboard!');
            navigator.clipboard.writeText(url);
          } else {
            navigator.clipboard.writeText(url);
            alert(`Copied image URL to clipboard:\n${url}`);
          }
        });
      });

      grid.querySelectorAll('.cms-media-del-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          e.stopPropagation();
          const id = btn.dataset.delId;
          if (id) await this.deleteMedia(id);
        });
      });
    };

    renderMediaList();

    document.getElementById('cms-media-tab-search').addEventListener('input', (e) => {
      renderMediaList(e.target.value.trim());
    });

    document.getElementById('cms-file-uploader').addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const mode = container.querySelector('input[name="cms-upload-dest"]:checked').value;
      await this.uploadMediaFile(file, mode);
      renderMediaList(document.getElementById('cms-media-tab-search').value.trim());
    });

    document.getElementById('cms-add-link-btn').addEventListener('click', async () => {
      const url = document.getElementById('cms-add-link-input').value.trim();
      if (!url) return alert('Please enter a valid image URL.');
      await this.addImageLink(url);
      document.getElementById('cms-add-link-input').value = '';
      renderMediaList();
    });

    document.getElementById('cms-seed-db-btn').addEventListener('click', async () => {
      const btn = document.getElementById('cms-seed-db-btn');
      btn.textContent = 'Seeding...';
      btn.disabled = true;
      await this.seedMediaToSupabase(true);
      btn.textContent = '✓ Seeded!';
      await this.fetchMedia();
      renderMediaList();
      setTimeout(() => { btn.textContent = '⚡ Seed 61 Pictures to DB'; btn.disabled = false; }, 2000);
    });
  }

  async uploadMediaFile(file, mode = 'blob') {
    const progressEl = document.getElementById('cms-upload-progress');
    if (progressEl) progressEl.textContent = 'Processing asset...';

    if (mode === 'blob') {
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = async (e) => {
          const base64Data = e.target.result;
          const newMediaItem = {
            id: 'media_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
            filename: file.name,
            title: file.name.replace(/\.[^/.]+$/, ''),
            caption: 'Direct manual upload (Blob)',
            blob_data: base64Data,
            url: null,
            source: 'blob',
            mime_type: file.type || 'image/jpeg',
            created_by: this.user.email || 'admin'
          };

          if (this.supabase) {
            try {
              const { error } = await this.supabase
                .from('media_items')
                .insert(newMediaItem);
              if (error) {
                console.warn('DB blob insert error:', error);
                alert('Note: Could not insert into media_items table in Supabase (' + error.message + '). Saved in active session.');
              }
            } catch (err) {
              console.warn('DB blob error:', err);
            }
          }

          const localItem = {
            id: newMediaItem.id,
            name: newMediaItem.title,
            filename: newMediaItem.filename,
            title: newMediaItem.title,
            caption: newMediaItem.caption,
            url: base64Data,
            isBlob: true,
            source: 'blob'
          };

          this.mediaList.unshift(localItem);
          if (progressEl) progressEl.textContent = '✓ Saved as Database Blob!';
          resolve(base64Data);
        };
        reader.readAsDataURL(file);
      });
    }

    if (mode === 'storage') {
      if (!this.supabase) {
        alert('Supabase client not initialized. Storing as Database Blob.');
        return this.uploadMediaFile(file, 'blob');
      }

      try {
        const ext = file.name.split('.').pop();
        const filename = `${Date.now()}_${Math.random().toString(36).substr(2, 6)}.${ext}`;
        const { data, error } = await this.supabase.storage
          .from('media')
          .upload(filename, file, { cacheControl: '3600', upsert: false });

        if (error) throw error;

        const { data: { publicUrl } } = this.supabase.storage
          .from('media')
          .getPublicUrl(filename);

        const newMediaItem = {
          id: 'media_' + Date.now(),
          filename: file.name,
          title: file.name.replace(/\.[^/.]+$/, ''),
          caption: 'Storage bucket upload',
          url: publicUrl,
          blob_data: null,
          source: 'storage',
          mime_type: file.type || 'image/jpeg',
          created_by: this.user.email || 'admin'
        };

        await this.supabase.from('media_items').insert(newMediaItem).catch(() => {});

        this.mediaList.unshift({
          id: newMediaItem.id,
          name: newMediaItem.title,
          filename: newMediaItem.filename,
          title: newMediaItem.title,
          url: publicUrl,
          isBlob: false,
          source: 'storage'
        });

        if (progressEl) progressEl.textContent = '✓ Uploaded to Storage bucket!';
        return publicUrl;
      } catch (err) {
        console.warn('Storage bucket failed, falling back to Database Blob:', err);
        if (progressEl) progressEl.textContent = 'Storage bucket unavailable, storing as Database Blob...';
        return this.uploadMediaFile(file, 'blob');
      }
    }
  }

  async addImageLink(url, title = '') {
    if (!url) return;
    const newMediaItem = {
      id: 'media_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
      filename: (title || 'External Image').replace(/[^a-zA-Z0-9_-]/g, '_') + '.jpg',
      title: title || 'External Image',
      caption: 'Direct URL reference',
      url: url,
      blob_data: null,
      source: 'link',
      created_by: this.user.email || 'admin'
    };

    if (this.supabase) {
      try {
        const { error } = await this.supabase
          .from('media_items')
          .insert(newMediaItem);
        if (error) console.warn('Could not insert link into DB:', error);
      } catch (err) {
        console.warn('DB link error:', err);
      }
    }

    this.mediaList.unshift({
      id: newMediaItem.id,
      name: newMediaItem.title,
      filename: newMediaItem.filename,
      title: newMediaItem.title,
      url: url,
      isBlob: false,
      source: 'link'
    });
  }

  async deleteMedia(id) {
    if (!confirm('Remove this media asset?')) return;
    if (this.supabase) {
      try {
        await this.supabase.from('media_items').delete().eq('id', id);
      } catch (e) {}
    }
    this.mediaList = this.mediaList.filter(m => m.id !== id);
    this.renderMediaTab(document.getElementById('cms-drawer-content'));
  }

  async fetchMedia() {
    const catalog = Array.isArray(window.MEAUX_CATALOG_MEDIA) ? window.MEAUX_CATALOG_MEDIA : [];

    let dbItems = [];
    if (this.supabase) {
      try {
        const { data, error } = await this.supabase
          .from('media_items')
          .select('*')
          .order('created_at', { ascending: false });

        if (data && !error && data.length > 0) {
          dbItems = data.map(item => ({
            id: item.id,
            name: item.title || item.filename,
            filename: item.filename,
            title: item.title,
            caption: item.caption,
            url: item.blob_data || item.url,
            isBlob: !!item.blob_data,
            source: item.source || (item.blob_data ? 'blob' : 'url')
          }));
        } else if (data && data.length === 0 && catalog.length > 0) {
          // Table exists but has 0 records: auto-seed catalog in background!
          this.seedMediaToSupabase(false);
        }
      } catch (err) {
        console.warn('Could not load from media_items table:', err);
      }
    }

    if (dbItems.length > 0) {
      const dbFilenames = new Set(dbItems.map(d => d.filename));
      const dbUrls = new Set(dbItems.map(d => d.url));
      const remainingCatalog = catalog.filter(c => !dbFilenames.has(c.filename) && !dbUrls.has(c.url));
      this.mediaList = [...dbItems, ...remainingCatalog];
    } else {
      this.mediaList = catalog.map(c => ({
        id: c.id,
        name: c.title || c.filename,
        filename: c.filename,
        title: c.title,
        caption: c.caption,
        url: c.url,
        isBlob: false,
        source: 'catalog'
      }));
    }
  }

  async seedMediaToSupabase(alertOnComplete = false) {
    if (!this.supabase) {
      if (alertOnComplete) alert('Supabase client not initialized.');
      return;
    }
    const catalog = window.MEAUX_CATALOG_MEDIA || [];
    if (!catalog.length) return;

    try {
      const rows = catalog.map(c => ({
        id: c.id,
        filename: c.filename,
        title: c.title,
        caption: c.caption,
        url: 'https://alexnbucur.space/' + c.url.replace(/^\/?/, ''),
        source: 'catalog',
        created_by: this.user.email || 'seed'
      }));

      const { error } = await this.supabase
        .from('media_items')
        .upsert(rows, { onConflict: 'id' });

      if (error) {
        console.warn('Seed media_items error:', error);
        if (alertOnComplete) alert('Seeding failed: ' + error.message + '\n\nPlease ensure you have run the supabase/seed_media.sql in your Supabase SQL editor.');
      } else {
        console.log(`Successfully seeded ${rows.length} media items into Supabase!`);
        if (alertOnComplete) alert(`Successfully seeded ${rows.length} portfolio pictures into Supabase!`);
      }
    } catch (e) {
      console.warn('Seed media_items exception:', e);
      if (alertOnComplete) alert('Seed error: ' + e.message);
    }
  }

  /* -------------------------------------------------------------------
     TAB: ADMINS & ACCESS CONTROL
     ------------------------------------------------------------------- */
  renderAdminsTab(container) {
    const admins = this.adminsList.length ? this.adminsList : [this.runtime.config.initialAdmin];
    const currentEmail = (this.user.email || '').toLowerCase();

    const listHtml = admins.map(email => `
      <div class="cms-list-item">
        <span>${this.escape(email)}</span>
        ${email !== currentEmail && email !== this.runtime.config.initialAdmin ? `
          <button type="button" class="cms-btn-subtle cms-btn-danger" data-remove-admin="${email}">Revoke</button>
        ` : '<span style="font-size: 10px; color: #71717a;">Owner / Active</span>'}
      </div>
    `).join('');

    container.innerHTML = `
      <div class="cms-control-group">
        <label>Authorized Atelier Curators</label>
        <p style="font-size: 11px; color: #a1a1aa; margin-bottom: 16px;">
          Only accounts listed here can sign in with Google to edit the atelier.
        </p>
        <div>${listHtml}</div>
      </div>

      <div class="cms-divider-line"><span>INVITE CURATOR</span></div>

      <div class="cms-control-group">
        <label>Google Account Email</label>
        <input type="email" id="cms-new-admin-email" class="cms-input" placeholder="curator@gmail.com">
      </div>
      <button type="button" id="cms-add-admin-btn" class="cms-luxury-btn">
        Authorize Curator ↵
      </button>
    `;

    document.getElementById('cms-add-admin-btn').addEventListener('click', async () => {
      const email = (document.getElementById('cms-new-admin-email').value || '').trim().toLowerCase();
      if (!email || !email.includes('@')) return alert('Please enter a valid Google email.');
      await this.addAdmin(email);
    });

    container.querySelectorAll('[data-remove-admin]').forEach(btn => {
      btn.addEventListener('click', async () => {
        await this.removeAdmin(btn.dataset.removeAdmin);
      });
    });
  }

  async fetchAdmins() {
    if (this.supabase) {
      try {
        const { data, error } = await this.supabase.from('admins').select('email');
        if (data && !error) {
          this.adminsList = data.map(r => r.email);
        }
      } catch (e) {}
    }
  }

  async addAdmin(email) {
    if (this.adminsList.includes(email)) return alert('This email is already an admin.');
    if (this.supabase) {
      try {
        const { error } = await this.supabase.from('admins').insert({ email, added_by: this.user.email });
        if (error) throw error;
      } catch (err) {
        alert('Could not save to database: ' + err.message);
      }
    }
    this.adminsList.push(email);
    this.renderAdminsTab(document.getElementById('cms-drawer-content'));
    alert(`Authorized ${email} to access atelier admin.`);
  }

  async removeAdmin(email) {
    if (!confirm(`Revoke admin privileges for ${email}?`)) return;
    if (this.supabase) {
      try {
        const { error } = await this.supabase.from('admins').delete().eq('email', email);
        if (error) throw error;
      } catch (err) {
        alert('Could not delete from database: ' + err.message);
      }
    }
    this.adminsList = this.adminsList.filter(e => e !== email);
    this.renderAdminsTab(document.getElementById('cms-drawer-content'));
  }

  /* -------------------------------------------------------------------
     TAB: SETTINGS & LOGOUT
     ------------------------------------------------------------------- */
  renderSettingsTab(container) {
    const settings = this.draft.settings || {};

    container.innerHTML = `
      <div class="cms-control-group">
        <label>Website Meta Title</label>
        <input type="text" id="cms-site-title" class="cms-input" value="${this.escape(settings.siteTitle || '')}">
      </div>

      <div class="cms-control-group">
        <label>SEO Meta Description</label>
        <textarea id="cms-meta-desc" class="cms-textarea" rows="3">${this.escape(settings.metaDescription || '')}</textarea>
      </div>

      <div class="cms-control-group">
        <label>Commission Direct Email</label>
        <input type="email" id="cms-contact-email" class="cms-input" value="${this.escape(settings.contactEmail || '')}">
      </div>

      <button type="button" id="cms-save-settings-btn" class="cms-luxury-btn" style="margin-bottom: 30px;">
        Save Site Settings ↵
      </button>

      <div class="cms-divider-line"><span>SESSION</span></div>

      <button type="button" id="cms-signout-btn" class="cms-btn-subtle cms-btn-danger full-width" style="padding: 12px; width: 100%;">
        Sign Out (${this.user.email || 'Admin'})
      </button>
    `;

    document.getElementById('cms-save-settings-btn').addEventListener('click', () => {
      if (!this.draft.settings) this.draft.settings = {};
      this.draft.settings.siteTitle = document.getElementById('cms-site-title').value.trim();
      this.draft.settings.metaDescription = document.getElementById('cms-meta-desc').value.trim();
      this.draft.settings.contactEmail = document.getElementById('cms-contact-email').value.trim();

      this.runtime.applyContent(this.draft);
      this.saveDraft();
      alert('Site settings updated.');
    });

    document.getElementById('cms-signout-btn').addEventListener('click', async () => {
      sessionStorage.removeItem('meaux_mock_admin_session');
      if (this.supabase) {
        await this.supabase.auth.signOut();
      }
      window.location.reload();
    });
  }

  /* -------------------------------------------------------------------
     INLINE EDITING & ATTACHMENT
     ------------------------------------------------------------------- */
  bindInlineEditing() {
    // 1. Text input listener for inline edits
    document.addEventListener('input', (e) => {
      if (!this.isEditMode) return;
      const el = e.target.closest('[data-cms-key], [data-cms]');
      if (!el) return;
      if (el.closest('#cms-admin-bar, #cms-admin-drawer, #cms-login-modal, #cms-image-picker-modal, dialog')) return;

      const key = el.getAttribute('data-cms-key') || el.getAttribute('data-cms');
      if (!this.draft.customContent) this.draft.customContent = {};
      this.draft.customContent[key] = el.innerHTML;

      // Handle dot-path if present (e.g. footer.tagline)
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

    // 2. Prevent link navigation when clicking inside editable text in edit mode
    document.addEventListener('click', (e) => {
      if (!this.isEditMode) return;
      const editable = e.target.closest('.cms-editable-text, [contenteditable="true"]');
      if (editable) {
        const link = e.target.closest('a');
        if (link) {
          e.preventDefault();
        }
      }
    }, true);

    // 3. Tab switching listener to preserve edit mode across pages
    document.querySelectorAll('.atelier-tabs button, [data-tab-target]').forEach(btn => {
      btn.addEventListener('click', () => {
        setTimeout(() => {
          if (this.isEditMode) {
            this.toggleEditMode(true);
          }
        }, 80);
      });
    });
  }

  updateAddBlockZones() {
    // Inject dynamic add block buttons between sections when in edit mode
    document.querySelectorAll('[data-cms-container]').forEach(container => {
      let zone = container.querySelector('.cms-add-block-zone');
      if (!zone && this.isEditMode) {
        zone = document.createElement('div');
        zone.className = 'cms-add-block-zone';
        zone.innerHTML = `
          <button type="button" class="cms-add-block-btn">+ Add Section Block</button>
        `;
        zone.querySelector('button').addEventListener('click', () => {
          this.activeDrawerTab = 'sections';
          this.toggleSidebar(true);
          this.renderDrawerContent();
        });
        container.appendChild(zone);
      }
    });
  }

  markDraftModified() {
    const indicator = document.getElementById('cms-bar-indicator');
    if (indicator) indicator.className = 'cms-status-indicator draft';
    this.saveDraft();
  }

  saveDraft() {
    try {
      localStorage.setItem('meaux_content_draft', JSON.stringify(this.draft));
    } catch (e) {}
  }

  async publish() {
    const indicator = document.getElementById('cms-bar-indicator');
    if (indicator) indicator.className = 'cms-status-indicator draft';

    let publishedSuccessfully = false;

    // 1. Supabase Postgres Publish RPC
    if (this.supabase) {
      try {
        const { data, error } = await this.supabase.rpc('publish_site', {
          doc: this.draft,
          note: `Published by ${this.user.email} at ${new Date().toISOString()}`
        });
        if (error) throw error;
        publishedSuccessfully = true;
        alert('✓ Site published live to Supabase production database!');
      } catch (err) {
        console.warn('publish_site RPC error, falling back to direct table update:', err);
        // Fallback: direct table update
        try {
          const { error: directError } = await this.supabase
            .from('site_content')
            .upsert({
              key: 'published',
              data: this.draft,
              updated_at: new Date().toISOString(),
              updated_by: this.user.email
            });
          if (!directError) {
            publishedSuccessfully = true;
            alert('✓ Site published live to Supabase production database (via direct table update)!');
          } else {
            throw directError;
          }
        } catch (tableErr) {
          console.warn('Direct publish failed:', tableErr);
          alert('Note: Published locally (Supabase returned: ' + err.message + ')');
        }
      }
    } else {
      alert('Published to local storage cache! (Connect Supabase in settings for remote database deployment)');
    }

    // 2. Local published cache update
    localStorage.setItem('meaux_content_published', JSON.stringify(this.draft));
    if (indicator) indicator.className = 'cms-status-indicator';
  }

  escape(str) {
    return String(str || '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }
}
