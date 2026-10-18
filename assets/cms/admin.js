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

    // Toggle contenteditable on text elements
    document.querySelectorAll('[data-cms]').forEach(el => {
      if (this.isEditMode) {
        if (el.tagName !== 'INPUT' && el.tagName !== 'TEXTAREA') {
          el.setAttribute('contenteditable', 'true');
        }
      } else {
        el.removeAttribute('contenteditable');
      }
    });

    // Toggle add block zones
    this.updateAddBlockZones();
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
    const imagesHtml = this.mediaList.map(m => `
      <div class="cms-media-thumb" data-media-url="${m.url}" title="${m.name}">
        <img src="${m.url}" loading="lazy">
      </div>
    `).join('');

    container.innerHTML = `
      <div class="cms-control-group">
        <label>Direct Asset Upload</label>
        <p style="font-size: 11px; color: #a1a1aa; margin-bottom: 14px;">
          Upload high-res imagery to the Supabase Media storage bucket or preview library.
        </p>
        <input type="file" id="cms-file-uploader" accept="image/*" class="cms-input" style="padding: 8px;">
        <div id="cms-upload-progress" style="font-size: 11px; color: #22c55e; margin-top: 6px;"></div>
      </div>

      <div class="cms-divider-line"><span>MEDIA ASSET VAULT</span></div>

      <div class="cms-media-grid">
        ${imagesHtml || '<p style="font-size: 11px; color: #71717a; grid-column: span 3;">No custom uploads yet. Upload an image above.</p>'}
      </div>
    `;

    document.getElementById('cms-file-uploader').addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      await this.uploadMedia(file);
    });

    container.querySelectorAll('.cms-media-thumb').forEach(thumb => {
      thumb.addEventListener('click', () => {
        const url = thumb.dataset.mediaUrl;
        navigator.clipboard.writeText(url);
        alert(`Copied image URL to clipboard:\n${url}`);
      });
    });
  }

  async uploadMedia(file) {
    const progressEl = document.getElementById('cms-upload-progress');
    progressEl.textContent = 'Uploading asset...';

    // 1. Supabase Storage Upload if connected
    if (this.supabase) {
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

        this.mediaList.unshift({ name: file.name, url: publicUrl });
        progressEl.textContent = 'Uploaded successfully!';
        this.renderMediaTab(document.getElementById('cms-drawer-content'));
        return;
      } catch (err) {
        console.warn('Storage upload failed, falling back to local base64:', err);
      }
    }

    // 2. Fallback: Base64 data URL
    const reader = new FileReader();
    reader.onload = (e) => {
      const url = e.target.result;
      this.mediaList.unshift({ name: file.name, url });
      progressEl.textContent = 'Image loaded locally.';
      this.renderMediaTab(document.getElementById('cms-drawer-content'));
    };
    reader.readAsDataURL(file);
  }

  async fetchMedia() {
    if (this.supabase) {
      try {
        const { data, error } = await this.supabase.storage.from('media').list();
        if (data && !error) {
          this.mediaList = data.map(item => ({
            name: item.name,
            url: this.supabase.storage.from('media').getPublicUrl(item.name).data.publicUrl
          }));
        }
      } catch (e) {}
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
    document.addEventListener('input', (e) => {
      const el = e.target.closest('[data-cms]');
      if (!el || !this.isEditMode) return;
      const path = el.getAttribute('data-cms').split('.');
      let target = this.draft;
      for (let i = 0; i < path.length - 1; i++) {
        if (!target[path[i]]) target[path[i]] = {};
        target = target[path[i]];
      }
      target[path[path.length - 1]] = el.textContent.trim();
      this.markDraftModified();
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

    // 1. Supabase Postgres Publish RPC
    if (this.supabase) {
      try {
        const { data, error } = await this.supabase.rpc('publish_site', {
          doc: this.draft,
          note: `Published by ${this.user.email} at ${new Date().toISOString()}`
        });
        if (error) throw error;
        alert('Site published live to Supabase production database!');
      } catch (err) {
        console.warn('Remote publish failed:', err);
        alert('Note: Published locally (Supabase returned: ' + err.message + ')');
      }
    } else {
      alert('Published to local storage! (Connect Supabase in settings for remote database deployment)');
    }

    // 2. Local published cache update
    localStorage.setItem('meaux_content_published', JSON.stringify(this.draft));
    if (indicator) indicator.className = 'cms-status-indicator';
  }

  escape(str) {
    return String(str || '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }
}
