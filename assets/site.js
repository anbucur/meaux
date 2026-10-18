const archive = window.MEAUX_ARCHIVE;
const curated = [
  ['DW9lQW_DUjv', 'Anouk', 'Portrait & styling'],
  ['DTpuNcKjeUN', 'Unidentified', 'Photography & styling'],
  ['DL-e-W1N1w-', 'Fetus', 'Photographic study'],
  ['DEXuQ0gNbcp', 'Tenebris Papilionem', 'Photographic study'],
  ['DTPohhYjdPI', 'Powerwoman', 'Portrait photography'],
  ['CqOSc5kN3gA', 'Vanderwilt', 'Photography & creative direction'],
  ['DALs3rUt3RC', 'Vigil', 'Photography, styling & direction'],
  ['CbI4R9FMcTQ', 'Gucci Beauty', 'Photography']
];
const titles = new Map(curated.map(([id,title,category]) => [id,{title,category}]));
let view = 'selected';
let currentItems = [];
let activeProject = null;
let returnFocus = null;
const dialog = document.getElementById('project-dialog');
const grid = document.getElementById('portfolio-grid');
const searchInput = document.getElementById('archive-search');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const imagePath = p => `instagram/meauxsvision/images/${p.image_file}`;

function projectInfo(post) {
  if (titles.has(post.shortcode)) return titles.get(post.shortcode);
  const first = post.caption.split('\n').find(s => /[a-zA-Z]/.test(s)) || 'From the archive';
  const title = first.replace(/📸|🖤|🤍|❤️|🦋|🩶|🕷️|🕸️|⚪️/gu, '').trim();
  return {title: title.length > 62 ? title.slice(0,59) + '…' : title, category:'Photography'};
}

function renderPortfolio() {
  if (!grid) return;
  const query = searchInput ? searchInput.value.toLocaleLowerCase().trim() : '';
  currentItems = view === 'selected'
    ? curated.map(([id]) => archive.find(p => p.shortcode === id)).filter(Boolean)
    : archive.filter(p => `${p.caption} ${projectInfo(p).title}`.toLocaleLowerCase().includes(query));
  grid.classList.toggle('archive', view === 'archive');
  grid.replaceChildren();
  for (const [index, post] of currentItems.entries()) {
    const info = projectInfo(post);
    const article = document.createElement('article');
    article.className = 'work-card';
    const button = document.createElement('button');
    button.type = 'button'; button.className = 'work-image';
    button.setAttribute('aria-label', `View ${info.title}`);
    const img = document.createElement('img');
    img.src = imagePath(post); img.alt = info.title;
    img.loading = 'lazy'; img.decoding = 'async';
    const arrow = document.createElement('span');
    arrow.className = 'image-corner'; arrow.textContent = '↗'; arrow.setAttribute('aria-hidden','true');
    button.append(img,arrow);
    button.addEventListener('click', () => openProject(post.shortcode, button));
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
    statusEl.textContent = view === 'archive' ? `${currentItems.length} of ${archive.length} works${query && !currentItems.length ? '. Try another name or project.' : ''}` : '';
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
  if (scroll && document.querySelector('.work-toolbar')) {
    document.querySelector('.work-toolbar').scrollIntoView({behavior:reducedMotion.matches?'instant':'smooth',block:'start'});
  }
}

function openProject(id, trigger) {
  const post = archive.find(p => p.shortcode === id);
  if (!post) return;
  activeProject = id;
  if (!dialog.open) returnFocus = trigger || document.activeElement;
  const info = projectInfo(post);
  document.getElementById('project-title').textContent = info.title;
  document.getElementById('project-caption').textContent = post.caption;
  const img = document.getElementById('project-image'); img.src = imagePath(post); img.alt = info.title;
  document.getElementById('project-source').href = post.permalink;
  document.getElementById('project-cover-note').textContent = post.media_type === 'carousel' ? 'Cover image from the series. View the original post for the complete carousel.' : '';
  const items = currentItems.some(p => p.shortcode === id) ? currentItems : archive;
  const index = items.findIndex(p => p.shortcode === id);
  document.getElementById('project-position').textContent = `${String(index+1).padStart(2,'0')} / ${String(items.length).padStart(2,'0')}`;
  document.getElementById('previous-project').disabled = index === 0;
  document.getElementById('next-project').disabled = index === items.length - 1;
  if (!dialog.open) { dialog.showModal(); document.body.classList.add('dialog-open'); }
}

function stepProject(direction) {
  const items = currentItems.some(p => p.shortcode === activeProject) ? currentItems : archive;
  const target = items[items.findIndex(p => p.shortcode === activeProject) + direction];
  if (target) openProject(target.shortcode);
}

/* ==========================================
   TAB NAVIGATION SYSTEM
   ========================================== */
const VALID_TABS = ['atelier', 'photography', 'styling', 'social-media', 'interior-design', 'about', 'enquiries'];
let activeTab = 'atelier';

function switchTab(tabId, shouldScroll = true, preselectedDiscipline = null) {
  if (!VALID_TABS.includes(tabId)) {
    tabId = 'atelier';
  }
  activeTab = tabId;

  // Update tab buttons
  document.querySelectorAll('.tab-btn').forEach(btn => {
    const isTarget = btn.dataset.tab === tabId;
    btn.classList.toggle('active', isTarget);
    btn.setAttribute('aria-selected', isTarget ? 'true' : 'false');
  });

  // Update tab panels
  document.querySelectorAll('.tab-view').forEach(viewEl => {
    const matches = viewEl.id === `view-${tabId}`;
    if (matches) {
      viewEl.hidden = false;
      viewEl.classList.add('active');
    } else {
      viewEl.hidden = true;
      viewEl.classList.remove('active');
    }
  });

  // Update hash without jumping
  if (window.location.hash !== `#${tabId}`) {
    history.replaceState(null, '', `#${tabId}`);
  }

  // Handle preselecting a discipline in the enquiry form if passed
  if (preselectedDiscipline) {
    const chipInput = document.querySelector(`.chip-label input[value="${preselectedDiscipline}"]`);
    if (chipInput) {
      chipInput.checked = true;
    }
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
}

// Deep link handling on initial load or hash change
function handleHashRoute() {
  const hash = window.location.hash.replace('#', '').trim();
  if (VALID_TABS.includes(hash)) {
    switchTab(hash, false);
  }
}

/* ==========================================
   BESPOKE ENQUIRY FORM LOGIC
   ========================================== */
function initEnquiryForm() {
  const form = document.getElementById('atelier-enquiry-form');
  if (!form) return;

  form.addEventListener('submit', function(event) {
    event.preventDefault();

    const name = document.getElementById('client-name').value.trim();
    const email = document.getElementById('client-email').value.trim();
    const phone = document.getElementById('client-phone').value.trim();
    const timeline = document.getElementById('client-timeline').value;
    const brief = document.getElementById('client-brief').value.trim();

    // Collect disciplines
    const selectedDisciplines = Array.from(document.querySelectorAll('.chip-label input:checked')).map(cb => cb.value);
    
    // Collect budget
    const budgetSelected = document.querySelector('.budget-label input:checked');
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
    const mailtoUrl = `mailto:bucuralexandrunicolae@gmail.com?subject=${subject}&body=${emailBody}`;

    // Render receipt confirmation card
    const card = document.getElementById('enquiry-form-container');
    if (card) {
      card.innerHTML = `
        <div class="enquiry-confirmation">
          <div class="w-12 h-12 rounded-full border border-white/40 flex items-center justify-center text-white text-xl">✓</div>
          <span class="text-xs uppercase tracking-[0.25em] text-zinc-400">DOSSIER REGISTERED // ATELIER MEAUX</span>
          <h3>Thank you, ${name}.</h3>
          <p>
            Your commission brief has been recorded. Dahman reviews all proposals personally to ensure alignment with the atelier's seasonal calendar. You will receive an initial appraisal within 24 to 48 hours.
          </p>
          <div class="mt-4 flex flex-col sm:flex-row gap-4">
            <a href="${mailtoUrl}" class="luxury-btn">
              <span>Open in Mail App ↗</span>
            </a>
            <button type="button" onclick="location.reload()" class="tab-btn border border-white/20 text-white px-6 py-4 uppercase tracking-[0.16em] text-xs">
              <span>Submit Another Brief</span>
            </button>
          </div>
        </div>
      `;
    }
  });
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
   EVENT LISTENERS & INITIALIZATION
   ========================================== */
// Tab buttons click
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    switchTab(btn.dataset.tab, true);
  });
});

// Any CTA button that targets a tab
document.addEventListener('click', (event) => {
  const target = event.target.closest('[data-tab-target]');
  if (target) {
    event.preventDefault();
    const tabName = target.dataset.tabTarget;
    const discipline = target.dataset.preselectDiscipline || null;
    switchTab(tabName, true, discipline);
  }
});

// View switch buttons for portfolio (Selected vs Full Archive)
document.querySelectorAll('[data-view]').forEach(b => b.addEventListener('click', () => setView(b.dataset.view)));
const showArchiveBtn = document.getElementById('show-archive');
if (showArchiveBtn) {
  showArchiveBtn.addEventListener('click', () => setView(view === 'archive' ? 'selected' : 'archive', true));
}

if (searchInput) {
  searchInput.addEventListener('input', renderPortfolio);
}

document.querySelectorAll('[data-post]').forEach(b => b.addEventListener('click', () => openProject(b.dataset.post, b)));
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
  if (!vaultIsOpen && !vaultUnlocking && event.key === 'Enter' && !event.target.closest('button,[role="button"],input,textarea,select')) {
    triggerVaultSequence();
  }
  if (!vaultIsOpen && event.key === 'Escape') skipIntro();
});

// Accordions in The Practice
document.querySelectorAll('.services details').forEach(detail => {
  detail.addEventListener('toggle', () => {
    if (detail.open) {
      document.querySelectorAll('.services details').forEach(other => {
        if (other !== detail) other.open = false;
      });
    }
  });
});

const currentYearEl = document.getElementById('current-year');
if (currentYearEl) currentYearEl.textContent = new Date().getFullYear();

// Window hash routing listener
window.addEventListener('hashchange', handleHashRoute);

// Initialize components
renderPortfolio();
initScrewCanvases();
initFluidLandingCanvas();
initEnquiryForm();
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
