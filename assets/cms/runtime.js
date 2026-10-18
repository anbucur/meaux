/* =====================================================================
   MEAUX CMS — RUNTIME LOADER & AUTHENTICATION
   ===================================================================== */
import './default-content.js';

const SUPABASE_CDN = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
const LOCAL_STORAGE_KEY = 'meaux_content_draft';
const PUBLISHED_STORAGE_KEY = 'meaux_content_published';
const MOCK_AUTH_KEY = 'meaux_mock_admin_session';

class CmsRuntime {
  constructor() {
    this.config = window.MEAUX_CONFIG || {};
    this.supabase = null;
    this.session = null;
    this.user = null;
    this.isAdmin = false;
    this.content = null;
    this.adminModule = null;
  }

  async init() {
    // 1. Initialize Supabase client if configured
    if (this.config.isConfigured()) {
      try {
        const { createClient } = await import(SUPABASE_CDN);
        this.supabase = createClient(this.config.supabaseUrl, this.config.supabaseAnonKey, {
          auth: {
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: true
          }
        });
      } catch (err) {
        console.warn('Could not load Supabase client:', err);
      }
    }

    // 2. Fetch and apply public site content
    await this.loadContent();
    this.applyContent(this.content);

    // 3. Check authentication status
    await this.checkAuth();

    // 4. Attach admin footer link trigger
    this.initAdminTrigger();

    // 5. Expose runtime instance globally
    window.MeauxCMS = this;
  }

  async loadContent() {
    // Try Supabase first if available
    if (this.supabase) {
      try {
        const { data, error } = await this.supabase
          .from('site_content')
          .select('data')
          .eq('key', 'published')
          .maybeSingle();

        if (data && data.data) {
          this.content = data.data;
          return;
        }
      } catch (e) {
        console.warn('Failed to load from Supabase, using local cache:', e);
      }
    }

    // Fallback to local storage (for offline or local editing)
    try {
      const localPub = localStorage.getItem(PUBLISHED_STORAGE_KEY);
      if (localPub) {
        this.content = JSON.parse(localPub);
        return;
      }
    } catch (e) {}

    // Default snapshot
    this.content = JSON.parse(JSON.stringify(window.MEAUX_DEFAULT_CONTENT || {}));
  }

  applyContent(doc) {
    if (!doc) return;

    // Apply Theme
    if (doc.theme) {
      const root = document.documentElement;
      if (doc.theme.fontDisplay) root.style.setProperty('--font-display', doc.theme.fontDisplay);
      if (doc.theme.fontSerif) root.style.setProperty('--font-serif', doc.theme.fontSerif);
      if (doc.theme.fontMono) root.style.setProperty('--font-mono', doc.theme.fontMono);
      if (doc.theme.colors) {
        if (doc.theme.colors.obsidian) root.style.setProperty('--obsidian', doc.theme.colors.obsidian);
        if (doc.theme.colors.paper) root.style.setProperty('--paper', doc.theme.colors.paper);
      }
    }

    // Apply Site Settings
    if (doc.settings) {
      if (doc.settings.siteTitle) document.title = doc.settings.siteTitle;
      const metaDesc = document.getElementById('meta-description');
      if (metaDesc && doc.settings.metaDescription) {
        metaDesc.setAttribute('content', doc.settings.metaDescription);
      }
      window.MEAUX_SETTINGS = doc.settings;
    }

    // Apply simple [data-cms] mapped fields
    document.querySelectorAll('[data-cms]').forEach(el => {
      const path = el.getAttribute('data-cms').split('.');
      let val = doc;
      for (const k of path) {
        val = val ? val[k] : undefined;
      }
      if (val !== undefined && val !== null) {
        if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
          el.value = val;
        } else if (el.tagName === 'A' && typeof val === 'object') {
          if (val.text) el.textContent = val.text;
          if (val.href) el.href = val.href;
        } else {
          el.textContent = val;
        }
      }
    });

    // Apply portfolio updates if present
    if (doc.portfolio && window.MeauxSite) {
      window.MeauxSite.setPortfolio(doc.portfolio);
    }

    // Render custom blocks for current tabs
    this.renderCustomBlocks(doc);
  }

  renderCustomBlocks(doc) {
    if (!doc.customBlocks) return;
    for (const [pageId, blocks] of Object.entries(doc.customBlocks)) {
      const view = document.getElementById(`view-${pageId}`);
      if (!view) continue;
      const container = view.querySelector('[data-cms-container]') || view;
      
      // Remove any previously rendered dynamic blocks
      container.querySelectorAll('.cms-dynamic-block').forEach(b => b.remove());

      if (Array.isArray(blocks)) {
        blocks.forEach(block => {
          const blockEl = this.createBlockElement(block);
          if (blockEl) {
            container.appendChild(blockEl);
          }
        });
      }
    }
  }

  createBlockElement(block) {
    const wrapper = document.createElement('div');
    wrapper.className = 'cms-dynamic-block cms-block-wrapper';
    wrapper.dataset.blockId = block.id;
    wrapper.dataset.blockType = block.type;

    if (block.type === 'heading-text') {
      wrapper.innerHTML = `
        <div class="discipline-header">
          <div class="discipline-tagline">
            <span>${this.escape(block.tagline || 'ATELIER SECTION')}</span>
          </div>
          <h2 class="discipline-title">${this.escape(block.title || 'Untitled Section')}</h2>
          <p class="discipline-subtitle">${this.escape(block.subtitle || '')}</p>
        </div>
      `;
    } else if (block.type === 'narrative') {
      wrapper.innerHTML = `
        <div class="discipline-narrative-split">
          <div class="narrative-image-wrap">
            <img src="${this.escape(block.imageUrl || 'instagram/meauxsvision/images/DW9lQW_DUjv.jpg')}" alt="${this.escape(block.imageCaption || '')}" loading="lazy">
            <div class="narrative-image-caption">
              <span>${this.escape(block.imageCaption || '')}</span>
            </div>
          </div>
          <div class="narrative-text-wrap">
            <div class="story-chapter">
              <h3>${this.escape(block.heading || '')}</h3>
              <p>${this.escape(block.body || '')}</p>
            </div>
          </div>
        </div>
      `;
    } else if (block.type === 'quote') {
      wrapper.innerHTML = `
        <div class="image-interlude" style="margin: 60px 0;">
          <p style="font-size: clamp(32px, 5vw, 64px); line-height: 1.1; font-family: var(--font-display);">${this.escape(block.quote || '')}</p>
          <div class="interlude-caption">
            <span>${this.escape(block.author || 'Meaux')}</span>
          </div>
        </div>
      `;
    } else if (block.type === 'gallery') {
      const itemsHtml = (block.images || []).map(img => `
        <div class="gallery-item">
          <img src="${this.escape(img.url)}" alt="${this.escape(img.title || '')}" loading="lazy">
          <div class="gallery-overlay">
            <h5>${this.escape(img.title || '')}</h5>
            <span>${this.escape(img.subtitle || '')}</span>
          </div>
        </div>
      `).join('');

      wrapper.innerHTML = `
        <div class="discipline-gallery" style="margin: 60px 0;">
          <h3 class="discipline-section-title">${this.escape(block.title || 'Curated Gallery')}</h3>
          <div class="gallery-grid">${itemsHtml}</div>
        </div>
      `;
    } else {
      wrapper.innerHTML = `<div style="padding: 20px; border: 1px solid rgba(255,255,255,0.1);">${block.html || ''}</div>`;
    }

    return wrapper;
  }

  escape(str) {
    return String(str || '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }

  async checkAuth() {
    // 1. Check live Supabase session
    if (this.supabase) {
      try {
        const { data: { session } } = await this.supabase.auth.getSession();
        if (session && session.user) {
          const email = (session.user.email || '').toLowerCase();
          // Check if admin in DB
          const { data: adminRow } = await this.supabase
            .from('admins')
            .select('email')
            .eq('email', email)
            .maybeSingle();

          const isAllowListed = Boolean(adminRow) || (email === this.config.initialAdmin.toLowerCase());
          if (isAllowListed) {
            this.session = session;
            this.user = session.user;
            this.isAdmin = true;
            this.loadAdminInterface();
            return;
          } else {
            console.warn(`User ${email} is signed in but not an authorized admin.`);
          }
        }
      } catch (e) {
        console.warn('Auth check error:', e);
      }
    }

    // 2. Check local mock admin session (convenient testing / demo mode)
    try {
      const mock = JSON.parse(sessionStorage.getItem(MOCK_AUTH_KEY) || 'null');
      if (mock && mock.email) {
        this.user = { email: mock.email, isMock: true };
        this.isAdmin = true;
        this.loadAdminInterface();
      }
    } catch (e) {}
  }

  async loadAdminInterface() {
    if (this.adminModule) return;
    try {
      const { initAdmin } = await import('./admin.js');
      this.adminModule = await initAdmin(this);
    } catch (err) {
      console.error('Failed to load admin editor:', err);
    }
  }

  initAdminTrigger() {
    const adminBtn = document.getElementById('cms-admin-link');
    if (!adminBtn) return;

    adminBtn.addEventListener('click', (e) => {
      e.preventDefault();
      if (this.isAdmin && this.adminModule) {
        this.adminModule.toggleSidebar();
      } else {
        this.showLoginModal();
      }
    });
  }

  showLoginModal() {
    let modal = document.getElementById('cms-login-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'cms-login-modal';
      modal.className = 'cms-modal-overlay';
      modal.innerHTML = `
        <div class="cms-modal-card">
          <div class="cms-modal-header">
            <span class="small-label">Atelier Administration</span>
            <button type="button" class="cms-modal-close" id="cms-login-close">✕</button>
          </div>
          <h3 class="cms-modal-title">Sign In</h3>
          <p class="cms-modal-desc">
            Restricted to authorized atelier curators. Direct Google authentication with Supabase backend.
          </p>

          <div id="cms-login-actions">
            <button type="button" id="cms-google-login-btn" class="cms-luxury-btn full-width">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335"/></svg>
              <span>Continue with Google</span>
            </button>

            <div class="cms-divider-line"><span>OR CONFIGURE</span></div>

            <div class="cms-config-accordion">
              <button type="button" id="cms-toggle-config-btn" class="cms-accordion-toggle">
                Supabase Credentials / Local Mode ▾
              </button>
              <div id="cms-config-fields" class="cms-config-fields" style="display:none;">
                <label>
                  <span>Project URL</span>
                  <input type="url" id="cms-input-url" placeholder="https://xyz.supabase.co" value="${this.config.supabaseUrl || ''}">
                </label>
                <label>
                  <span>Anon Key</span>
                  <input type="password" id="cms-input-key" placeholder="eyJhbG..." value="${this.config.supabaseAnonKey || ''}">
                </label>
                <div class="flex gap-2 mt-2">
                  <button type="button" id="cms-save-creds-btn" class="cms-btn-subtle">Save Credentials</button>
                  <button type="button" id="cms-mock-login-btn" class="cms-btn-subtle" title="Sign in locally as alexandru.n.bucur@gmail.com without remote server">Local Demo Mode</button>
                </div>
              </div>
            </div>
          </div>
          <div id="cms-login-status" class="cms-login-status" aria-live="polite"></div>
        </div>
      `;
      document.body.appendChild(modal);

      // Bind events
      document.getElementById('cms-login-close').addEventListener('click', () => modal.remove());
      modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });

      document.getElementById('cms-toggle-config-btn').addEventListener('click', () => {
        const fields = document.getElementById('cms-config-fields');
        fields.style.display = fields.style.display === 'none' ? 'block' : 'none';
      });

      document.getElementById('cms-save-creds-btn').addEventListener('click', () => {
        const url = document.getElementById('cms-input-url').value;
        const key = document.getElementById('cms-input-key').value;
        this.config.saveCredentials(url, key);
        alert('Supabase credentials saved. Reloading...');
        window.location.reload();
      });

      document.getElementById('cms-mock-login-btn').addEventListener('click', () => {
        sessionStorage.setItem(MOCK_AUTH_KEY, JSON.stringify({ email: this.config.initialAdmin }));
        modal.remove();
        this.checkAuth();
      });

      document.getElementById('cms-google-login-btn').addEventListener('click', async () => {
        if (!this.supabase) {
          alert('Please enter your Supabase Project URL and Anon Key in the config section below first.');
          return;
        }
        const statusEl = document.getElementById('cms-login-status');
        statusEl.textContent = 'Redirecting to Google authentication...';
        try {
          const { error } = await this.supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
              redirectTo: window.location.origin + window.location.pathname
            }
          });
          if (error) throw error;
        } catch (err) {
          statusEl.textContent = 'Error: ' + err.message;
        }
      });
    }
  }
}

// Start runtime as soon as DOM is ready
const runtime = new CmsRuntime();
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => runtime.init());
} else {
  runtime.init();
}
