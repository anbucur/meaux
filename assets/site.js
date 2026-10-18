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
  const post = archive.find(p => p.shortcode === id);
  if (!post || !dialog) return;
  activeProject = id;
  if (!dialog.open) returnFocus = trigger || document.activeElement;
  const info = projectInfo(post);
  document.getElementById('project-title').textContent = info.title;
  document.getElementById('project-caption').textContent = post.caption || '';
  const img = document.getElementById('project-image'); img.src = imagePath(post); img.alt = info.title;
  const source = document.getElementById('project-source');
  source.hidden = !post.permalink;
  if (post.permalink) source.href = post.permalink;
  const commission = dialog.querySelector('.project-commission');
  if (commission) commission.href = `mailto:${contactEmail()}`;
  document.getElementById('project-cover-note').textContent = post.media_type === 'carousel' ? 'Cover image from the series. View the original post for the complete carousel.' : '';
  const items = currentItems.some(p => p.shortcode === id) ? currentItems : visibleArchive();
  const index = items.findIndex(p => p.shortcode === id);
  document.getElementById('project-position').textContent = `${String(index+1).padStart(2,'0')} / ${String(items.length).padStart(2,'0')}`;
  document.getElementById('previous-project').disabled = index <= 0;
  document.getElementById('next-project').disabled = index === items.length - 1;
  if (!dialog.open) { dialog.showModal(); document.body.classList.add('dialog-open'); }
}

function stepProject(direction) {
  const items = currentItems.some(p => p.shortcode === activeProject) ? currentItems : visibleArchive();
  const target = items[items.findIndex(p => p.shortcode === activeProject) + direction];
  if (target) openProject(target.shortcode);
}

/* ==========================================
   TAB NAVIGATION SYSTEM (pages are discovered from the DOM)
   ========================================== */
let activeTab = 'atelier';
const getTabs = () => Array.from(document.querySelectorAll('.tab-view')).map(v => v.id.replace(/^view-/, ''));

function switchTab(tabId, shouldScroll = true, preselectedDiscipline = null) {
  const tabs = getTabs();
  if (!tabs.includes(tabId)) {
    tabId = tabs.includes(activeTab) ? activeTab : (tabs[0] || 'atelier');
  }
  activeTab = tabId;

  // Update tab buttons
  document.querySelectorAll('.tab-btn[data-tab]').forEach(btn => {
    const isTarget = btn.dataset.tab === tabId;
    btn.classList.toggle('active', isTarget);
    btn.setAttribute('aria-selected', isTarget ? 'true' : 'false');
  });

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
    if (mainContent) {
      const topOffset = mainContent.getBoundingClientRect().top + window.scrollY - 90;
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
function handleEnquirySubmit(form) {
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
          Your commission brief has been recorded. Mohammed reviews all proposals personally to ensure alignment with the atelier's seasonal calendar. You will receive an initial appraisal within 24 to 48 hours.
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
  const postEl = event.target.closest('[data-post]');
  if (postEl && !postEl.closest('dialog')) {
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

/* Public API used by the CMS (assets/cms/*) */
window.MeauxSite = {
  getPortfolio: () => ({items: archive.map(p => ({...p})), selected: curated.map(c => ({...c}))}),
  setPortfolio(portfolio) {
    if (!portfolio) return;
    if (Array.isArray(portfolio.items)) archive = portfolio.items.map(p => ({...p}));
    if (Array.isArray(portfolio.selected)) curated = portfolio.selected.map(c => ({...c}));
    renderPortfolio();
  },
  refresh() {
    setCurrentYear();
    renderPortfolio();
    handleHashRoute();
    switchTab(activeTab, false);
  },
  getActiveTab: () => activeTab,
  switchTab,
  skipIntro,
  openProject,
  isVaultOpen: () => vaultIsOpen
};

// Initialize components
renderPortfolio();
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
