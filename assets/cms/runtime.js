/* =====================================================================
   MEAUX CMS — RUNTIME LOADER, DYNAMIC ENGINE & AUTHENTICATION (v2.0)
   ===================================================================== */
import './default-content.js';
import { applyActiveSurface } from './surfaces.js';

const SUPABASE_CDN = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
const PUBLISHED_STORAGE_KEY = 'meaux_content_published';
const MOCK_AUTH_KEY = 'meaux_mock_admin_session';

const LOADED_GOOGLE_FONTS = new Set(['Syne', 'Cormorant Garamond', 'Space Mono']);

export function loadGoogleFont(fontFamilyStr) {
  if (!fontFamilyStr) return;
  const match = String(fontFamilyStr).match(/['"]?([^'",]+)['"]?/);
  if (!match) return;
  const fontName = match[1].trim();
  if (!fontName || LOADED_GOOGLE_FONTS.has(fontName)) return;
  if (['sans-serif', 'serif', 'monospace', 'system-ui', 'inherit'].includes(fontName.toLowerCase())) return;
  LOADED_GOOGLE_FONTS.add(fontName);
  const encoded = encodeURIComponent(fontName).replace(/%20/g, '+');
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = `https://fonts.googleapis.com/css2?family=${encoded}:ital,wght@0,400;0,500;0,600;0,700;0,800;1,400&display=swap`;
  document.head.appendChild(link);
}

export const EDITABLE_TEXT_SELECTORS = [
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p',
  '.small-label', '.about-statement', '.about-moniker', '.card-num', '.value-num',
  '.discipline-title', '.discipline-subtitle', '.discipline-tagline span',
  '.hero-topline span', '.hero-baseline span', '.hero-signature span', '.hero-image-caption',
  '.interlude-caption span',
  '.story-chapter h3', '.story-chapter p',
  '.value-card h3', '.value-card p',
  '.client-item', '.meta-title', '.meta-content',
  '.photo-essential-num', '.photo-archive-bar > span', '.photo-style-hint',
  '.tier-badge', '.tier-deliverables-title', '.tier-deliverables li',
  '.gallery-overlay h5', '.gallery-overlay span',
  '.narrative-image-caption span', '.about-portrait-caption span',
  '.content-pack-kicker', '.content-pack-list strong',
  '.session-step-badge', '.session-step-tags span',
  '.ig-handle', '.ig-topbar-meta', '.ig-bio-name', '.ig-bio-text',
  '.ig-profile-stats strong', '.ig-profile-stats span',
  '.ig-highlight > span', '.ig-tile-hover',
  '.discipline-card-tags span', '.about-fact-label', '.about-fact-value',
  '.services summary > span:first-child', '.services details > div > span',
  '.site-footer > span', '.site-footer small > span',
  '[data-cms]', '[data-cms-key]'
];

export const EDITABLE_IMAGE_SELECTORS = [
  'main img',
  '.hero-image img',
  '.gallery-item img',
  '.about-portrait-wrap img',
  '.discipline-narrative-split img',
  '.work-image img',
  '.image-interlude img',
  '.ig-avatar-ring img',
  '.ig-highlight-ring img',
  '.ig-tile img',
  '.session-step-media img',
  '.discipline-card-media img',
  '.value-card-media img',
  '.cms-dynamic-block img'
];

class CmsRuntime {
  constructor() {
    this.config = window.MEAUX_CONFIG || {};
    this.supabase = null;
    this.session = null;
    this.user = null;
    this.isAdmin = false;
    this.content = null;
    this.adminModule = null;
    this.vaultAutoSkipped = false;
  }

  async init() {
    // 0. Check for OAuth error in URL
    const urlParams = new URLSearchParams(window.location.search);
    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const authErrorDesc = urlParams.get('error_description') || hashParams.get('error_description') || urlParams.get('error');
    if (authErrorDesc) {
      const decoded = decodeURIComponent(authErrorDesc).replace(/\+/g, ' ');
      console.error('OAuth Redirect Error:', decoded);
      this.showSystemBanner(`Google Login Error: "${decoded}". Verify your Google Client Secret in Supabase → Auth → Providers → Google.`, 'error');
      window.history.replaceState({}, document.title, window.location.pathname);
    }

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

        // Handle PKCE code exchange if present in URL
        const code = urlParams.get('code');
        if (code) {
          try {
            await this.supabase.auth.exchangeCodeForSession(code);
            window.history.replaceState({}, document.title, window.location.pathname);
          } catch (e) {
            console.warn('PKCE exchange error:', e);
          }
        }

        // Listen for OAuth sign-in redirect and session events
        this.supabase.auth.onAuthStateChange(async (event, session) => {
          if (session && session.user) {
            await this.checkAuth();
          }
        });
      } catch (err) {
        console.warn('Could not load Supabase client:', err);
      }
    }

    // 2. Assign deterministic keys to all text & media elements
    this.assignContentAndImageKeys();

    // 3. Fetch and apply public site content
    await this.loadContent();
    this.applyContent(this.content);

    // 4. Check authentication status
    await this.checkAuth();

    // 5. Attach admin footer link trigger
    this.initAdminTrigger();

    // 6. Expose runtime instance globally & keep per-page backgrounds/SEO synced on tab switch
    window.MeauxCMS = this;
    document.addEventListener('meaux:tab', (e) => {
      const tab = (e.detail && e.detail.tab) || (window.MeauxSite ? window.MeauxSite.getActiveTab() : 'atelier');
      const activeDoc = (this.adminModule && this.adminModule.draft) || this.content;
      applyActiveSurface(activeDoc && activeDoc.backgrounds, tab);
      this.applyPerPageSeo(activeDoc, tab);
    });
  }

  showSystemBanner(msg, type = 'info') {
    const existing = document.getElementById('cms-system-banner');
    if (existing) existing.remove();
    const banner = document.createElement('div');
    banner.id = 'cms-system-banner';
    banner.style.cssText = `
      position: fixed; top: 18px; right: 18px; z-index: 11000; max-width: 440px;
      padding: 14px 18px; border-radius: 12px; font-family: var(--font-mono, monospace);
      font-size: 11px; line-height: 1.6; color: #f8fafc;
      background: ${type === 'error' ? 'rgba(127, 29, 29, 0.94)' : 'rgba(15, 23, 42, 0.94)'};
      border: 1px solid ${type === 'error' ? 'rgba(248, 113, 113, 0.55)' : 'rgba(56, 189, 248, 0.45)'};
      backdrop-filter: blur(18px); box-shadow: 0 20px 50px rgba(0,0,0,0.7);
      display: flex; align-items: flex-start; gap: 12px;
    `;
    banner.innerHTML = `<span style="flex:1;">${this.escape(msg)}</span><button type="button" style="background:none;border:0;color:#fff;cursor:pointer;font-size:14px;">✕</button>`;
    banner.querySelector('button').addEventListener('click', () => banner.remove());
    document.body.appendChild(banner);
    setTimeout(() => banner.remove(), 9000);
  }

  assignContentAndImageKeys() {
    // 1. Deterministic keys for all editable text elements
    document.querySelectorAll(EDITABLE_TEXT_SELECTORS.join(', ')).forEach((el, index) => {
      if (el.closest('#cms-admin-bar, #cms-admin-drawer, #cms-asset-dock, #cms-login-modal, #cms-image-picker-modal, #cms-asset-inspector-modal, #cms-command-palette, #cms-block-editor-modal, .cms-modal-overlay, .cms-block-actions, dialog')) return;
      if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'BUTTON' || el.closest('button.tab-btn, .cms-block-actions, .cms-bento-controls')) return;
      // Avoid marking container elements that wrap other block children unless explicitly tagged
      if (!el.getAttribute('data-cms') && el.children.length > 0 && !['P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'LI', 'SPAN', 'A'].includes(el.tagName)) return;

      if (!el.getAttribute('data-cms-key')) {
        const explicit = el.getAttribute('data-cms');
        if (explicit) {
          el.setAttribute('data-cms-key', explicit);
        } else {
          const parentView = el.closest('[id^="view-"], .site-footer, .site-header, .about-section, .contact-section') || el.parentElement;
          const parentPrefix = parentView && parentView.id ? parentView.id : (parentView && parentView.className ? String(parentView.className).split(' ')[0] : 'sec');
          const cleanClass = el.className ? '_' + String(el.className).split(' ')[0].replace(/[^a-zA-Z0-9_-]/g, '') : '';
          el.setAttribute('data-cms-key', `txt_${parentPrefix}_${el.tagName.toLowerCase()}${cleanClass}_${index}`);
        }
      }
    });

    // 2. Deterministic keys for all replaceable images
    document.querySelectorAll(EDITABLE_IMAGE_SELECTORS.join(', ')).forEach((img, index) => {
      if (img.closest('#cms-admin-bar, #cms-admin-drawer, #cms-asset-dock, #cms-login-modal, #cms-image-picker-modal, .cms-modal-overlay, dialog')) return;
      if (!img.getAttribute('data-cms-img')) {
        const parentView = img.closest('[id^="view-"], .discipline-page, .ig-device-frame') || img.parentElement;
        const parentPrefix = parentView && parentView.id ? parentView.id : 'img';
        img.setAttribute('data-cms-img', `img_${parentPrefix}_${index}`);
      }
    });
  }

  async loadContent() {
    const defaults = JSON.parse(JSON.stringify(window.MEAUX_DEFAULT_CONTENT || {}));

    // Try Supabase first with a 2.5s fast-boot timeout so offline/paused DBs never stall UX
    if (this.supabase) {
      try {
        const res = await Promise.race([
          this.supabase.from('site_content').select('data').eq('key', 'published').maybeSingle(),
          new Promise((_, rej) => setTimeout(() => rej(new Error('Supabase boot timeout')), 2500))
        ]);
        if (res && res.data && res.data.data) {
          this.content = this.mergeWithDefaults(defaults, res.data.data);
          return;
        }
      } catch (e) {
        console.warn('Supabase fast-boot fallback to local cache:', e.message || e);
      }
    }

    // Fallback to local storage
    try {
      const localPub = localStorage.getItem(PUBLISHED_STORAGE_KEY);
      if (localPub) {
        this.content = this.mergeWithDefaults(defaults, JSON.parse(localPub));
        return;
      }
    } catch (e) {}

    this.content = defaults;
  }

  mergeWithDefaults(defaults, incoming) {
    if (!incoming || typeof incoming !== 'object') return defaults;
    return {
      ...defaults,
      ...incoming,
      brand: { ...(defaults.brand || {}), ...(incoming.brand || {}) },
      announcementBar: { ...(defaults.announcementBar || {}), ...(incoming.announcementBar || {}) },
      theme: {
        ...(defaults.theme || {}),
        ...(incoming.theme || {}),
        colors: { ...(defaults.theme?.colors || {}), ...(incoming.theme?.colors || {}) }
      },
      settings: { ...(defaults.settings || {}), ...(incoming.settings || {}) },
      vault: { ...(defaults.vault || {}), ...(incoming.vault || {}) },
      footer: { ...(defaults.footer || {}), ...(incoming.footer || {}) },
      pages: Array.isArray(incoming.pages) && incoming.pages.length ? incoming.pages : defaults.pages,
      mediaCategories: Array.isArray(incoming.mediaCategories) && incoming.mediaCategories.length ? incoming.mediaCategories : defaults.mediaCategories,
      mediaMeta: incoming.mediaMeta || {},
      sectionVisibility: incoming.sectionVisibility || {},
      customBlocks: incoming.customBlocks || {}
    };
  }

  applyContent(doc) {
    if (!doc) return;

    // 1. Sync custom pages, nav order, labels & visibility
    this.syncPagesAndNav(doc);

    // 2. Apply Theme, Google Fonts, Palette, Radius, Scale & Custom CSS
    this.applyTheme(doc.theme);

    // 3. Apply Brand Identity & Vault Entrance settings
    this.applyBrandAndVault(doc);

    // 4. Apply Announcement Bar
    this.renderAnnouncementBar(doc.announcementBar);

    // 5. Apply Site Settings & SEO
    if (doc.settings) {
      if (doc.settings.siteTitle) document.title = doc.settings.siteTitle;
      const metaDesc = document.getElementById('meta-description');
      if (metaDesc && doc.settings.metaDescription) {
        metaDesc.setAttribute('content', doc.settings.metaDescription);
      }
      window.MEAUX_SETTINGS = doc.settings;

      // Sync direct email links
      if (doc.settings.contactEmail) {
        document.querySelectorAll('a[href^="mailto:"]').forEach(a => {
          a.href = `mailto:${doc.settings.contactEmail}`;
          if (a.classList.contains('meta-content') && a.textContent.includes('@')) {
            a.textContent = doc.settings.contactEmail;
          }
        });
      }
      if (doc.settings.instagramUrl || doc.footer?.instagramUrl) {
        const igUrl = doc.settings.instagramUrl || doc.footer.instagramUrl;
        document.querySelectorAll('a[href*="instagram.com"]').forEach(a => {
          if (!a.closest('#project-dialog')) a.href = igUrl;
        });
      }
    }

    // 6. Apply simple [data-cms] mapped fields
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
        } else if (typeof val !== 'object') {
          el.textContent = val;
        }
      }
    });

    // 7. Apply custom inline-edited content dictionary
    if (doc.customContent) {
      for (const [key, html] of Object.entries(doc.customContent)) {
        const el = document.querySelector(`[data-cms-key="${key}"], [data-cms="${key}"]`);
        if (el && html !== undefined && html !== null) {
          el.innerHTML = html;
        }
      }
    }

    // 8. Apply custom images dictionary & focal points
    if (doc.customImages) {
      for (const [key, src] of Object.entries(doc.customImages)) {
        if (!src) continue;
        let img = document.querySelector(`[data-cms-img="${key}"]`);
        if (!img) {
          try { img = document.querySelector(key); } catch (e) {}
        }
        if (img) {
          if (img.tagName === 'IMG') img.src = src;
          else {
            const innerImg = img.querySelector('img');
            if (innerImg) innerImg.src = src;
          }
        }
      }
    }

    if (doc.customImageFocalPoints) {
      for (const [key, pos] of Object.entries(doc.customImageFocalPoints)) {
        const img = document.querySelector(`[data-cms-img="${key}"]`);
        if (img && img.tagName === 'IMG' && pos) {
          img.style.objectPosition = pos;
        }
      }
    }

    // 9. Apply portfolio & Photography Bento updates
    if (doc.portfolio && window.MeauxSite) {
      window.MeauxSite.setPortfolio(doc.portfolio);
    }

    if (doc.photoStyles && window.MeauxSite && window.MeauxSite.setPhotoStyles) {
      window.MeauxSite.setPhotoStyles(doc.photoStyles);
    }

    if (doc.customPostLinks && window.MeauxSite) {
      const p = window.MeauxSite.getPortfolio();
      let changed = false;
      for (const [sc, link] of Object.entries(doc.customPostLinks)) {
        const item = p.items.find(i => i.shortcode === sc);
        if (item) {
          item.permalink = link || '';
          changed = true;
        }
      }
      if (changed) window.MeauxSite.setPortfolio(p);
    }

    // 10. Apply custom background surfaces (global or per-page)
    const activeTab = window.MeauxSite && window.MeauxSite.getActiveTab ? window.MeauxSite.getActiveTab() : 'atelier';
    applyActiveSurface(doc.backgrounds, activeTab);
    this.applyPerPageSeo(doc, activeTab);

    // 11. Apply built-in section visibility
    this.applySectionVisibility(doc.sectionVisibility);

    // 12. Render custom Squarespace-style blocks across pages
    this.renderCustomBlocks(doc);

    // Ensure any newly created elements have deterministic keys
    this.assignContentAndImageKeys();
  }

  applyTheme(theme) {
    if (!theme) return;
    const root = document.documentElement;
    if (theme.fontDisplay) {
      loadGoogleFont(theme.fontDisplay);
      root.style.setProperty('--font-display', theme.fontDisplay);
    }
    if (theme.fontSerif) {
      loadGoogleFont(theme.fontSerif);
      root.style.setProperty('--font-serif', theme.fontSerif);
    }
    if (theme.fontMono) {
      loadGoogleFont(theme.fontMono);
      root.style.setProperty('--font-mono', theme.fontMono);
    }
    if (theme.colors) {
      if (theme.colors.obsidian) {
        root.style.setProperty('--obsidian', theme.colors.obsidian);
        root.style.setProperty('--ink', theme.colors.obsidian);
      }
      if (theme.colors.paper) {
        root.style.setProperty('--paper', theme.colors.paper);
        root.style.setProperty('--page-text', theme.colors.paper);
      }
      if (theme.colors.panelBg) root.style.setProperty('--panel-bg', theme.colors.panelBg);
      if (theme.colors.accent) root.style.setProperty('--accent-gold', theme.colors.accent);
      if (theme.colors.line) root.style.setProperty('--line', theme.colors.line);
      if (theme.colors.muted) root.style.setProperty('--muted', theme.colors.muted);
    }

    if (theme.typeScale && Number(theme.typeScale) > 0) {
      root.style.fontSize = `${Math.round(Number(theme.typeScale) * 100)}%`;
    } else {
      root.style.fontSize = '';
    }

    document.body.classList.toggle('cms-grayscale-media', Boolean(theme.imageGrayscale));

    // Inject radius + custom CSS cleanly
    let styleTag = document.getElementById('cms-custom-css-tag');
    if (!styleTag) {
      styleTag = document.createElement('style');
      styleTag.id = 'cms-custom-css-tag';
      document.head.appendChild(styleTag);
    }
    const radiusPx = Number(theme.borderRadius || 0);
    const radiusCss = radiusPx > 0
      ? `.discipline-card, .work-image, .bento-tile, .gallery-item, .service-tier-card, .session-step-card, .value-card, .enquiry-form-card, .content-pack-card, .discipline-cta-banner, .luxury-btn { border-radius: ${radiusPx}px !important; }\n`
      : '';
    styleTag.textContent = radiusCss + (theme.customCss || '');
  }

  applyBrandAndVault(doc) {
    // Brand logo wordmark & star emblem
    if (doc.brand && (doc.brand.name || doc.brand.symbol)) {
      const name = this.escape(doc.brand.name || 'MEAUX');
      const symbol = this.escape(doc.brand.symbol ?? '✳');
      document.querySelectorAll('.wordmark.brand-logo').forEach(el => {
        el.innerHTML = `${name}<span class="brand-star" aria-hidden="true">${symbol}</span>`;
      });
      const vaultLogo = document.querySelector('.vault-logo');
      if (vaultLogo) {
        vaultLogo.innerHTML = `${name}<span class="brand-star" aria-hidden="true">${symbol}</span>`;
      }
      const heroTitle = document.getElementById('hero-title');
      if (heroTitle && !doc.customContent?.['txt_view-atelier_h1_hero-word_0']) {
        heroTitle.innerHTML = `${name}<span class="hero-asterisk brand-star" aria-hidden="true">${symbol}</span>`;
      }
    }

    // Vault entrance configuration
    if (doc.vault) {
      const enterText = document.getElementById('enter-btn-text');
      if (enterText && doc.vault.enterLabel) enterText.textContent = doc.vault.enterLabel;
      const statusText = document.getElementById('vault-status-readout');
      if (statusText && doc.vault.statusLabel) statusText.textContent = doc.vault.statusLabel;

      if (Array.isArray(doc.vault.disciplines) && doc.vault.disciplines.length && window.MeauxVault) {
        window.MeauxVault.setDisciplines(doc.vault.disciplines);
      }

      if (doc.vault.enabled === false && !this.vaultAutoSkipped && window.MeauxSite && !window.MeauxSite.isVaultOpen()) {
        this.vaultAutoSkipped = true;
        window.MeauxSite.skipIntro();
      }
    }
  }

  renderAnnouncementBar(cfg) {
    const existing = document.getElementById('cms-announcement-bar');
    if (existing) existing.remove();
    if (!cfg || !cfg.enabled || !cfg.text) return;

    const header = document.querySelector('#atelier-world .site-header');
    if (!header) return;

    const bar = document.createElement('div');
    bar.id = 'cms-announcement-bar';
    bar.className = 'cms-announcement-bar';
    bar.style.backgroundColor = cfg.bgColor || '#0e1118';
    bar.style.color = cfg.textColor || '#f4f4f0';

    const linkHref = (cfg.linkHref || '').trim();
    const linkLabel = (cfg.linkLabel || '').trim();
    const isHashTab = linkHref.startsWith('#');
    const linkHtml = linkHref && linkLabel
      ? `<a class="cms-announcement-link" href="${this.escape(linkHref)}" ${isHashTab ? `data-tab-target="${this.escape(linkHref.slice(1))}"` : 'target="_blank" rel="noopener noreferrer"'} style="color:${this.escape(cfg.accentColor || '#38bdf8')}">${this.escape(linkLabel)}</a>`
      : '';

    bar.innerHTML = `
      <span>${this.escape(cfg.text)}</span>
      ${linkHtml}
      <button type="button" class="cms-announcement-close" aria-label="Dismiss announcement">✕</button>
    `;
    bar.querySelector('.cms-announcement-close').addEventListener('click', () => bar.remove());
    header.parentNode.insertBefore(bar, header);
  }

  syncPagesAndNav(doc) {
    if (!Array.isArray(doc.pages) || !doc.pages.length) return;
    const nav = document.querySelector('.atelier-tabs');
    const main = document.getElementById('main-content');
    if (!nav || !main) return;

    const desiredIds = new Set(doc.pages.map(p => p.id));

    // Remove deleted non-system pages from DOM
    nav.querySelectorAll('.tab-btn[data-tab]').forEach(btn => {
      const id = btn.dataset.tab;
      const isSystemDefault = ['atelier', 'photography', 'styling', 'social-media', 'about', 'enquiries'].includes(id);
      if (!desiredIds.has(id) && !isSystemDefault) {
        btn.remove();
        const view = document.getElementById(`view-${id}`);
        if (view) view.remove();
      }
    });

    // Create missing pages & sync labels, visibility, and order
    doc.pages.forEach(page => {
      let btn = nav.querySelector(`.tab-btn[data-tab="${page.id}"]`);
      if (!btn) {
        btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'tab-btn';
        btn.dataset.tab = page.id;
        btn.setAttribute('aria-controls', `view-${page.id}`);
        btn.setAttribute('aria-selected', 'false');
        nav.appendChild(btn);
      }

      const label = page.navLabel || page.title || page.id;
      if (page.id === 'enquiries') {
        btn.innerHTML = `<span>${this.escape(label)} <span class="tab-arrow" aria-hidden="true">↗</span></span>`;
      } else {
        btn.innerHTML = `<span>${this.escape(label)}</span>`;
      }

      btn.style.display = page.showInNav === false ? 'none' : '';
      // Reorder nav button according to doc.pages order
      nav.appendChild(btn);

      // Ensure view panel exists for custom pages
      let view = document.getElementById(`view-${page.id}`);
      if (!view) {
        view = document.createElement('div');
        view.id = `view-${page.id}`;
        view.className = 'tab-view';
        view.setAttribute('role', 'tabpanel');
        view.hidden = true;
        view.innerHTML = `
          <section class="discipline-page" data-cms-container>
            <div class="discipline-header">
              <div class="discipline-tagline">
                <span>ATELIER MEAUX // BESPOKE</span>
              </div>
              <h2 class="discipline-title">${this.escape(page.title || label)}</h2>
              <p class="discipline-subtitle">${this.escape(page.subtitle || 'Curated atelier space.')}</p>
            </div>
          </section>
        `;
        main.appendChild(view);
      }
    });

    document.dispatchEvent(new CustomEvent('meaux:nav-synced'));
  }

  applyPerPageSeo(doc, activeTab) {
    if (!doc) return;
    const baseTitle = doc.settings?.siteTitle || 'MEAUX — Visual, Styling & Brand Atelier';
    const baseDesc = doc.settings?.metaDescription || '';
    const page = (doc.pages || []).find(p => p.id === activeTab);
    document.title = (page && page.seoTitle) ? page.seoTitle : baseTitle;
    const metaDesc = document.getElementById('meta-description');
    if (metaDesc) {
      metaDesc.setAttribute('content', (page && page.seoDescription) ? page.seoDescription : baseDesc);
    }
  }

  applySectionVisibility(visibilityMap) {
    const map = visibilityMap || {};
    document.querySelectorAll('[data-cms-section-id]').forEach(el => {
      const id = el.getAttribute('data-cms-section-id');
      el.classList.toggle('cms-section-hidden', map[id] === false);
    });

    // Map known built-in sections deterministically
    const knownSections = [
      ['atelier-hero', '#view-atelier #hero'],
      ['atelier-disciplines', '#view-atelier .home-disciplines-section'],
      ['atelier-works', '#view-atelier #works'],
      ['atelier-interlude', '#view-atelier .image-interlude'],
      ['atelier-studio', '#view-atelier #studio'],
      ['photo-style-bar', '#view-photography .photo-style-bar'],
      ['photo-bento', '#view-photography #photo-bento-grid'],
      ['photo-essentials', '#view-photography .photo-essentials-strip'],
      ['photo-archive-bar', '#view-photography .photo-archive-bar'],
      ['photo-cta', '#view-photography .discipline-cta-banner'],
      ['styling-narrative', '#view-styling .discipline-narrative-split'],
      ['styling-services', '#view-styling .discipline-services'],
      ['styling-gallery', '#view-styling .discipline-gallery'],
      ['styling-cta', '#view-styling .discipline-cta-banner'],
      ['social-ig', '#view-social-media .ig-curation-showcase'],
      ['social-walkthrough', '#view-social-media .session-walkthrough-section'],
      ['social-cta', '#view-social-media .discipline-cta-banner'],
      ['about-hero', '#view-about .about-hero-grid'],
      ['about-values', '#view-about .about-values-section'],
      ['about-clients', '#view-about .about-clients-section']
    ];

    knownSections.forEach(([secId, selector]) => {
      const el = document.querySelector(selector);
      if (el) {
        el.setAttribute('data-cms-section-id', secId);
        el.classList.toggle('cms-section-hidden', map[secId] === false);
      }
    });
  }

  renderCustomBlocks(doc) {
    // Clear existing dynamic blocks across all views first
    document.querySelectorAll('.cms-dynamic-block').forEach(b => b.remove());
    if (!doc.customBlocks) return;

    for (const [pageId, blocks] of Object.entries(doc.customBlocks)) {
      const view = document.getElementById(`view-${pageId}`);
      if (!view) continue;
      const container = view.querySelector('[data-cms-container]') || view;
      const addZone = container.querySelector('.cms-add-block-zone');

      if (Array.isArray(blocks)) {
        blocks.forEach((block, idx) => {
          const blockEl = this.createBlockElement(block, pageId, idx, blocks.length);
          if (blockEl) {
            if (addZone) container.insertBefore(blockEl, addZone);
            else container.appendChild(blockEl);
          }
        });
      }
    }
  }

  formatVideoEmbed(url) {
    const raw = (url || '').trim();
    if (!raw) return '<div style="display:grid;place-items:center;height:100%;color:#71717a;font-size:12px;">Paste a YouTube, Vimeo, or MP4 URL in Block Settings</div>';
    if (/\.(mp4|webm|mov)(\?.*)?$/i.test(raw)) {
      return `<video src="${this.escape(raw)}" controls playsinline muted loop></video>`;
    }
    const yt = raw.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([A-Za-z0-9_-]{6,})/);
    if (yt) {
      return `<iframe src="https://www.youtube.com/embed/${yt[1]}?rel=0" allowfullscreen loading="lazy" title="Embedded video"></iframe>`;
    }
    const vimeo = raw.match(/vimeo\.com\/(?:video\/)?(\d+)/);
    if (vimeo) {
      return `<iframe src="https://player.vimeo.com/video/${vimeo[1]}" allowfullscreen loading="lazy" title="Embedded Vimeo video"></iframe>`;
    }
    return `<iframe src="${this.escape(raw)}" allowfullscreen loading="lazy" title="Embedded media"></iframe>`;
  }

  createBlockElement(block, pageId = '', idx = 0, total = 1) {
    const wrapper = document.createElement('div');
    wrapper.className = 'cms-dynamic-block cms-block-wrapper';
    wrapper.dataset.blockId = block.id;
    wrapper.dataset.blockType = block.type;
    wrapper.dataset.pageId = pageId;

    const align = block.align || 'left';
    let innerHtml = '';

    if (block.type === 'heading-text') {
      innerHtml = `
        <div class="discipline-header" style="text-align:${align};">
          <div class="discipline-tagline" style="${align === 'center' ? 'justify-content:center;' : ''}">
            <span data-block-field="tagline">${this.escape(block.tagline || 'ATELIER SECTION')}</span>
          </div>
          <h2 class="discipline-title" data-block-field="title">${this.escape(block.title || 'Untitled Section')}</h2>
          <p class="discipline-subtitle" data-block-field="subtitle">${this.escape(block.subtitle || '')}</p>
        </div>
      `;
    } else if (block.type === 'narrative') {
      innerHtml = `
        <div class="discipline-narrative-split ${block.reversed ? 'is-reversed' : ''}">
          <div class="narrative-image-wrap">
            <img src="${this.escape(block.imageUrl || 'instagram/meauxsvision/images/DW9lQW_DUjv.jpg')}" data-cms-img="blk_${this.escape(block.id)}_img" alt="${this.escape(block.imageCaption || '')}" loading="lazy">
            <div class="narrative-image-caption">
              <span data-block-field="imageCaption">${this.escape(block.imageCaption || '')}</span>
            </div>
          </div>
          <div class="narrative-text-wrap">
            <div class="story-chapter">
              <h3 data-block-field="heading">${this.escape(block.heading || '')}</h3>
              <p data-block-field="body">${this.escape(block.body || '')}</p>
            </div>
          </div>
        </div>
      `;
    } else if (block.type === 'quote') {
      innerHtml = `
        <div class="image-interlude" style="margin: 56px 0; text-align:${align};">
          <p data-block-field="quote" style="font-size: clamp(32px, 5vw, 64px); line-height: 1.1; font-family: var(--font-display);">${this.escape(block.quote || '')}</p>
          <div class="interlude-caption">
            <span data-block-field="author">${this.escape(block.author || 'Meaux')}</span>
          </div>
        </div>
      `;
    } else if (block.type === 'gallery') {
      const cols = Number(block.columns) || 3;
      const colClass = cols === 2 ? 'cms-block-gallery-2' : (cols === 4 ? 'cms-block-gallery-4' : '');
      const itemsHtml = (block.images || []).map((img, i) => `
        <div class="gallery-item">
          <img src="${this.escape(img.url)}" data-cms-img="blk_${this.escape(block.id)}_gal_${i}" alt="${this.escape(img.title || '')}" loading="lazy">
          <div class="gallery-overlay">
            <h5>${this.escape(img.title || '')}</h5>
            <span>${this.escape(img.subtitle || '')}</span>
          </div>
        </div>
      `).join('');

      innerHtml = `
        <div class="discipline-gallery" style="margin: 56px 0;">
          <h3 class="discipline-section-title" data-block-field="title">${this.escape(block.title || 'Curated Gallery')}</h3>
          <div class="gallery-grid ${colClass}">${itemsHtml}</div>
        </div>
      `;
    } else if (block.type === 'cta-banner') {
      const targetHref = (block.buttonTarget || '#enquiries').trim();
      const isHash = targetHref.startsWith('#');
      innerHtml = `
        <div class="discipline-cta-banner">
          <div class="discipline-cta-text">
            <h3 data-block-field="title">${this.escape(block.title || 'Commission a Project')}</h3>
            <p data-block-field="body">${this.escape(block.body || 'Available for editorial campaigns, sculptural portraits, and creative direction.')}</p>
          </div>
          ${isHash
            ? `<button type="button" data-tab-target="${this.escape(targetHref.slice(1))}" class="luxury-btn"><span>${this.escape(block.buttonLabel || 'Initiate Dossier ↗')}</span></button>`
            : `<a href="${this.escape(targetHref)}" target="_blank" rel="noopener noreferrer" class="luxury-btn"><span>${this.escape(block.buttonLabel || 'Explore ↗')}</span></a>`
          }
        </div>
      `;
    } else if (block.type === 'metrics-strip') {
      const items = Array.isArray(block.items) ? block.items : [];
      innerHtml = `
        <div class="photo-essentials-strip">
          ${items.map(it => `
            <div class="photo-essential-item">
              <span class="photo-essential-num">${this.escape(it.kicker || '')}</span>
              <h3>${this.escape(it.title || '')}</h3>
              <p>${this.escape(it.body || '')}</p>
            </div>
          `).join('')}
        </div>
      `;
    } else if (block.type === 'video-embed') {
      innerHtml = `
        <div class="cms-block-video-wrap">
          ${block.title ? `<h3 class="discipline-section-title" style="margin-bottom:20px;">${this.escape(block.title)}</h3>` : ''}
          <div class="cms-video-frame">${this.formatVideoEmbed(block.videoUrl)}</div>
          ${block.caption ? `<p style="margin-top:12px;font-size:11px;letter-spacing:0.12em;text-transform:uppercase;color:var(--muted,#8e8e8a);">${this.escape(block.caption)}</p>` : ''}
        </div>
      `;
    } else if (block.type === 'spacer-divider') {
      const height = Math.max(16, Math.min(240, Number(block.height) || 64));
      innerHtml = `
        <div class="cms-block-divider" style="height:${height}px;">
          ${block.showLine !== false ? '<div class="cms-block-divider-line"></div>' : ''}
        </div>
      `;
    } else if (block.type === 'accordion') {
      const items = Array.isArray(block.items) ? block.items : [];
      innerHtml = `
        <div class="cms-block-accordion">
          ${block.title ? `<h3 class="discipline-section-title" style="margin-bottom:24px;">${this.escape(block.title)}</h3>` : ''}
          <div class="services">
            ${items.map((it, i) => `
              <details ${i === 0 ? 'open' : ''}>
                <summary><span>${this.escape(it.question || 'Item')}</span><span class="service-plus" aria-hidden="true">+</span></summary>
                <div><p>${this.escape(it.answer || '')}</p></div>
              </details>
            `).join('')}
          </div>
        </div>
      `;
    } else {
      innerHtml = `<div class="cms-custom-html-block" style="padding: 16px 0;">${block.html || ''}</div>`;
    }

    // Floating Squarespace-style Block Toolbar (visible only in Edit Mode)
    const actionsHtml = `
      <div class="cms-block-actions" contenteditable="false">
        <span class="cms-block-type-pill">${this.escape(block.type)}</span>
        <button type="button" class="cms-block-btn" data-block-action="up" data-page-id="${this.escape(pageId)}" data-block-id="${this.escape(block.id)}" title="Move Up" ${idx === 0 ? 'disabled' : ''}>↑</button>
        <button type="button" class="cms-block-btn" data-block-action="down" data-page-id="${this.escape(pageId)}" data-block-id="${this.escape(block.id)}" title="Move Down" ${idx >= total - 1 ? 'disabled' : ''}>↓</button>
        <button type="button" class="cms-block-btn" data-block-action="edit" data-page-id="${this.escape(pageId)}" data-block-id="${this.escape(block.id)}" title="Edit Block Properties">✎ Edit</button>
        <button type="button" class="cms-block-btn" data-block-action="duplicate" data-page-id="${this.escape(pageId)}" data-block-id="${this.escape(block.id)}" title="Duplicate Block">⧉</button>
        <button type="button" class="cms-block-btn delete" data-block-action="delete" data-page-id="${this.escape(pageId)}" data-block-id="${this.escape(block.id)}" title="Delete Block">✕</button>
      </div>
    `;

    wrapper.innerHTML = actionsHtml + innerHtml;
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
          let hasAdminRecord = false;
          try {
            const { data: adminRow } = await this.supabase
              .from('admins')
              .select('email')
              .eq('email', email)
              .maybeSingle();
            if (adminRow) hasAdminRecord = true;
          } catch (e) {}

          const knownAdmins = [
            'alexandru.n.bucur@gmail.com',
            'bucuralexandrunicolae@gmail.com',
            (this.config.initialAdmin || '').toLowerCase()
          ];

          const isAllowListed = hasAdminRecord || knownAdmins.includes(email);
          if (isAllowListed) {
            this.session = session;
            this.user = session.user;
            this.isAdmin = true;
            // Record last_login_at silently
            try {
              this.supabase.from('admins').update({ last_login_at: new Date().toISOString() }).eq('email', email).then(() => {});
            } catch (e) {}
            await this.loadAdminInterface();
            return;
          } else {
            this.showSystemBanner(`Signed in as ${email}, but this account is not in the authorized 'admins' table.`, 'error');
          }
        }
      } catch (e) {
        console.warn('Auth check error:', e);
      }
    }

    // 2. Check local curator session
    try {
      const mock = JSON.parse(localStorage.getItem(MOCK_AUTH_KEY) || sessionStorage.getItem(MOCK_AUTH_KEY) || 'null');
      if (mock && mock.email) {
        this.user = { email: mock.email, isMock: true };
        this.isAdmin = true;
        await this.loadAdminInterface();
      }
    } catch (e) {}
  }

  async loadAdminInterface() {
    if (this.adminModule) return;
    try {
      const { initAdmin } = await import('./admin.js?v=11');
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
    if (!document.querySelector('link[href*="assets/cms/admin.css"]')) {
      const link = document.createElement('link');
      link.id = 'cms-admin-css-link';
      link.rel = 'stylesheet';
      link.href = 'assets/cms/admin.css?v=10';
      document.head.appendChild(link);
    }

    const existing = document.getElementById('cms-login-modal');
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.id = 'cms-login-modal';
    modal.className = 'cms-modal-overlay';
    modal.innerHTML = `
      <div class="cms-modal-card cms-futuristic-card" style="max-width: 470px;">
        <div class="cms-modal-header">
          <span class="cms-eyebrow">ATELIER OS // ACCESS PORTAL</span>
          <button type="button" class="cms-modal-close" id="cms-login-close">✕</button>
        </div>
        <h3 class="cms-modal-title">Curator Sign In</h3>
        <p class="cms-modal-desc">
          Authenticate to unlock visual editing, asset vault tagging, database sync, and live deployment.
        </p>

        <div id="cms-login-actions">
          <button type="button" id="cms-google-login-btn" class="cms-luxury-btn" style="margin-bottom: 14px;">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335"/></svg>
            <span>Continue with Google</span>
          </button>

          <form id="cms-email-login-form" style="margin-bottom: 16px;">
            <label class="cms-field-label">Sign in via Magic Link</label>
            <div class="cms-inline-row">
              <input type="email" id="cms-email-input" class="cms-input" value="alexandru.n.bucur@gmail.com" required>
              <button type="submit" id="cms-email-submit-btn" class="cms-btn-subtle">Send Link ↵</button>
            </div>
          </form>

          <div class="cms-divider-line"><span>OR INSTANT STUDIO LAUNCH</span></div>

          <button type="button" id="cms-instant-admin-btn" class="cms-holo-btn">
            ✦ Launch Atelier OS (Immediate)
          </button>

          <div class="cms-config-accordion">
            <button type="button" id="cms-toggle-config-btn" class="cms-accordion-toggle">
              Supabase Credentials / Connection ▾
            </button>
            <div id="cms-config-fields" class="cms-config-fields" style="display:none;">
              <label>
                <span>Project URL</span>
                <input type="url" id="cms-input-url" class="cms-input" placeholder="https://xyz.supabase.co" value="${this.config.supabaseUrl || ''}">
              </label>
              <label>
                <span>Anon Key</span>
                <input type="password" id="cms-input-key" class="cms-input" placeholder="eyJhbG..." value="${this.config.supabaseAnonKey || ''}">
              </label>
              <div class="cms-inline-row" style="margin-top:10px;">
                <button type="button" id="cms-save-creds-btn" class="cms-btn-subtle">Save Credentials</button>
                <button type="button" id="cms-mock-login-btn" class="cms-btn-subtle">Session Demo Mode</button>
              </div>
            </div>
          </div>
        </div>
        <div id="cms-login-status" class="cms-login-status" aria-live="polite"></div>
      </div>
    `;
    document.body.appendChild(modal);

    document.getElementById('cms-login-close').addEventListener('click', () => modal.remove());
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });

    document.getElementById('cms-instant-admin-btn').addEventListener('click', async () => {
      localStorage.setItem(MOCK_AUTH_KEY, JSON.stringify({ email: this.config.initialAdmin || 'alexandru.n.bucur@gmail.com' }));
      modal.remove();
      await this.checkAuth();
    });

    document.getElementById('cms-toggle-config-btn').addEventListener('click', () => {
      const fields = document.getElementById('cms-config-fields');
      fields.style.display = fields.style.display === 'none' ? 'block' : 'none';
    });

    document.getElementById('cms-save-creds-btn').addEventListener('click', () => {
      const url = document.getElementById('cms-input-url').value;
      const key = document.getElementById('cms-input-key').value;
      this.config.saveCredentials(url, key);
      window.location.reload();
    });

    document.getElementById('cms-mock-login-btn').addEventListener('click', () => {
      sessionStorage.setItem(MOCK_AUTH_KEY, JSON.stringify({ email: this.config.initialAdmin || 'alexandru.n.bucur@gmail.com' }));
      modal.remove();
      this.checkAuth();
    });

    document.getElementById('cms-email-login-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('cms-email-input').value.trim();
      const statusEl = document.getElementById('cms-login-status');
      if (!this.supabase) {
        statusEl.textContent = 'Supabase client is not initialized.';
        return;
      }
      statusEl.style.color = '#38bdf8';
      statusEl.textContent = 'Sending magic link to ' + email + '...';
      try {
        const { error } = await this.supabase.auth.signInWithOtp({
          email,
          options: { emailRedirectTo: window.location.origin + window.location.pathname }
        });
        if (error) throw error;
        statusEl.style.color = '#34d399';
        statusEl.textContent = '✓ Magic link sent! Check your inbox to sign in.';
      } catch (err) {
        statusEl.style.color = '#f87171';
        statusEl.textContent = 'Error: ' + err.message;
      }
    });

    document.getElementById('cms-google-login-btn').addEventListener('click', async () => {
      const statusEl = document.getElementById('cms-login-status');
      if (!this.supabase) {
        statusEl.textContent = 'Enter your Supabase Project URL and Anon Key in the config section below first.';
        return;
      }
      statusEl.style.color = '#38bdf8';
      statusEl.textContent = 'Redirecting to Google authentication...';
      try {
        const { error } = await this.supabase.auth.signInWithOAuth({
          provider: 'google',
          options: { redirectTo: window.location.origin + window.location.pathname }
        });
        if (error) throw error;
      } catch (err) {
        statusEl.style.color = '#f87171';
        statusEl.textContent = 'Error: ' + err.message;
      }
    });
  }
}

if (!window.__MEAUX_CMS_BOOTED__) {
  window.__MEAUX_CMS_BOOTED__ = true;
  const runtime = new CmsRuntime();
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => runtime.init());
  } else {
    runtime.init();
  }
}
