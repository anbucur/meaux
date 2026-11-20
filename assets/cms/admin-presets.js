/* =====================================================================
   MEAUX ATELIER OS — PRESETS, BLOCK DEFINITIONS & METADATA CATALOG
   ===================================================================== */

export const GOOGLE_FONTS = [
  { name: 'Syne', family: "'Syne', sans-serif" },
  { name: 'Cormorant Garamond', family: "'Cormorant Garamond', serif" },
  { name: 'Space Mono', family: "'Space Mono', monospace" },
  { name: 'Playfair Display', family: "'Playfair Display', serif" },
  { name: 'Cinzel', family: "'Cinzel', serif" },
  { name: 'Italiana', family: "'Italiana', serif" },
  { name: 'Bodoni Moda', family: "'Bodoni Moda', serif" },
  { name: 'Outfit', family: "'Outfit', sans-serif" },
  { name: 'Inter', family: "'Inter', sans-serif" },
  { name: 'JetBrains Mono', family: "'JetBrains Mono', monospace" },
  { name: 'Space Grotesk', family: "'Space Grotesk', sans-serif" },
  { name: 'Instrument Serif', family: "'Instrument Serif', serif" }
];

export const THEME_PRESETS = [
  {
    id: 'obsidian-chrome',
    name: 'Obsidian Chrome',
    tag: 'Signature Atelier',
    fontDisplay: "'Syne', sans-serif",
    fontSerif: "'Cormorant Garamond', serif",
    fontMono: "'Space Mono', monospace",
    borderRadius: 0,
    colors: { obsidian: '#050506', paper: '#f4f4f0', panelBg: '#0e0e10', accent: '#c5a880', line: '#27272a', muted: '#8e8e8a' }
  },
  {
    id: 'cyber-silver',
    name: 'Cyber Silver',
    tag: 'Futuristic Holo',
    fontDisplay: "'Space Grotesk', sans-serif",
    fontSerif: "'Instrument Serif', serif",
    fontMono: "'JetBrains Mono', monospace",
    borderRadius: 10,
    colors: { obsidian: '#06080f', paper: '#f1f5f9', panelBg: '#0f1422', accent: '#38bdf8', line: '#1e293b', muted: '#94a3b8' }
  },
  {
    id: 'oxblood-couture',
    name: 'Oxblood Couture',
    tag: 'Runway Velvet',
    fontDisplay: "'Cinzel', serif",
    fontSerif: "'Cormorant Garamond', serif",
    fontMono: "'Space Mono', monospace",
    borderRadius: 2,
    colors: { obsidian: '#120508', paper: '#f7f1ee', panelBg: '#1c0a0f', accent: '#e11d48', line: '#3b151e', muted: '#a88a90' }
  },
  {
    id: 'paris-editorial',
    name: 'Paris Editorial',
    tag: 'Vogue Archive',
    fontDisplay: "'Bodoni Moda', serif",
    fontSerif: "'Playfair Display', serif",
    fontMono: "'Inter', sans-serif",
    borderRadius: 0,
    colors: { obsidian: '#090909', paper: '#faf8f4', panelBg: '#141414', accent: '#d4af37', line: '#2a2a28', muted: '#9a968c' }
  }
];

export const DEFAULT_MEDIA_CATEGORIES = [
  { id: 'cat_photography', slug: 'photography', name: 'Photography', color: '#38bdf8' },
  { id: 'cat_avant_garde', slug: 'avant-garde', name: 'Avant-Garde', color: '#a78bfa' },
  { id: 'cat_campaigns', slug: 'campaigns', name: 'Campaigns', color: '#f472b6' },
  { id: 'cat_portraits', slug: 'portraits', name: 'Portraits', color: '#fbbf24' },
  { id: 'cat_location', slug: 'location', name: 'Location & Bridal', color: '#34d399' },
  { id: 'cat_styling', slug: 'styling', name: 'Styling', color: '#fb923c' },
  { id: 'cat_social', slug: 'social-media', name: 'Social Media', color: '#60a5fa' },
  { id: 'cat_editorial', slug: 'editorial', name: 'Editorial', color: '#c084fc' },
  { id: 'cat_uncat', slug: 'uncategorized', name: 'Uncategorized', color: '#94a3b8' }
];

export const CATEGORY_COLORS = [
  '#38bdf8', '#a78bfa', '#f472b6', '#fbbf24', '#34d399', '#fb923c', '#60a5fa', '#e879f9', '#f87171', '#94a3b8'
];

export const BLOCK_CATALOG = [
  {
    type: 'heading-text',
    name: 'Editorial Heading & Subtitle',
    desc: 'Architectural display title with eyebrow tagline and italic quote',
    defaults: () => ({
      tagline: 'NEW CHAPTER // ARCHITECTURE',
      title: 'The Form of Presence',
      subtitle: '“Light does not define space; shadow isolates its sovereign truth.”',
      align: 'left'
    })
  },
  {
    type: 'narrative',
    name: 'Narrative Image + Chapter Split',
    desc: 'Sculptural portrait paired with editorial story (flip left/right)',
    defaults: () => ({
      imageUrl: 'instagram/meauxsvision/images/DZ5dX4SjAXv.jpg',
      imageCaption: 'Portrait Study · Amsterdam',
      heading: 'Tactile Rigor',
      body: 'Every material carries memory. From cold machined steel to hand-tanned obsidian leathers, our practice orchestrates visceral tension.',
      reversed: false
    })
  },
  {
    type: 'quote',
    name: 'Monumental Interlude Quote',
    desc: 'Full-bleed typographic statement on obsidian backdrop',
    defaults: () => ({
      quote: 'Form follows feeling.',
      author: 'Mohammed / Meaux',
      align: 'left'
    })
  },
  {
    type: 'gallery',
    name: 'Curated Photographic Grid',
    desc: '2, 3, or 4-column editorial gallery with hover metadata overlays',
    defaults: () => ({
      title: 'Atmospheric Studies',
      columns: 3,
      images: [
        { url: 'instagram/meauxsvision/images/DEXuQ0gNbcp.jpg', title: 'Study 01', subtitle: 'Chiaroscuro' },
        { url: 'instagram/meauxsvision/images/CbI4R9FMcTQ.jpg', title: 'Study 02', subtitle: 'Campaign' },
        { url: 'instagram/meauxsvision/images/CqOSc5kN3gA.jpg', title: 'Study 03', subtitle: 'Movement' }
      ]
    })
  },
  {
    type: 'cta-banner',
    name: 'Commission CTA Banner',
    desc: 'High-impact callout banner linking to Enquiries or any URL',
    defaults: () => ({
      title: 'Commission a Bespoke Production',
      body: 'Available for fashion campaigns, editorial portraiture, styling direction, and digital curation worldwide.',
      buttonLabel: 'Initiate Commission ↗',
      buttonTarget: '#enquiries'
    })
  },
  {
    type: 'metrics-strip',
    name: '3-Column Essentials / Pillars Strip',
    desc: 'Three numbered editorial columns for process, specs, or highlights',
    defaults: () => ({
      items: [
        { kicker: '01 // CONCEPT', title: 'Visual Architecture', body: 'Moodboards, lighting geometry, and silhouette direction conceived before shoot day.' },
        { kicker: '02 // PRODUCTION', title: 'On-Set Precision', body: 'Studio or international location direction uniting styling, photography, and motion.' },
        { kicker: '03 // DELIVERY', title: 'Gallery-Grade Selects', body: 'Graded finals formatted for print lookbooks, digital flagships, and social campaigns.' }
      ]
    })
  },
  {
    type: 'video-embed',
    name: 'Cinematic Video / Showreel',
    desc: 'Responsive 16:9 YouTube, Vimeo, or direct MP4 video embed',
    defaults: () => ({
      title: 'Campaign Motion Study',
      videoUrl: '',
      caption: 'Directed & Filmed by Meaux Atelier'
    })
  },
  {
    type: 'accordion',
    name: 'FAQ / Services Accordion',
    desc: 'Interactive expandable luxury list for commissions, rates, or press',
    defaults: () => ({
      title: 'Commission Protocol',
      items: [
        { question: 'How far in advance should we book a campaign?', answer: 'We recommend initiating your dossier 3 to 6 weeks prior to your desired shoot window.' },
        { question: 'Do you travel internationally for location shoots?', answer: 'Yes — the atelier operates out of Amsterdam and commissions worldwide across Europe, the UK, UAE, and US.' },
        { question: 'Can Photography, Styling & Curation be combined?', answer: 'Yes. Full Atelier Direction unites all three disciplines under one cohesive visual signature.' }
      ]
    })
  },
  {
    type: 'spacer-divider',
    name: 'Architectural Divider / Spacer',
    desc: 'Precision vertical breathing room with optional chrome hairline',
    defaults: () => ({
      height: 64,
      showLine: true
    })
  },
  {
    type: 'custom-html',
    name: 'Custom HTML / Embed Code',
    desc: 'Raw HTML, interactive widget, or third-party embed snippet',
    defaults: () => ({
      html: '<div style="padding:28px;border:1px solid rgba(255,255,255,0.14);text-align:center;font-size:12px;letter-spacing:0.15em;text-transform:uppercase;">Custom Atelier Embed Block</div>'
    })
  }
];

export const BUILTIN_SECTIONS_BY_PAGE = {
  atelier: [
    { id: 'atelier-hero', label: 'Hero Composition' },
    { id: 'atelier-disciplines', label: 'Three Disciplines Strip' },
    { id: 'atelier-works', label: 'Selected / Full Portfolio Archive' },
    { id: 'atelier-interlude', label: 'Monumental Image Interlude' },
    { id: 'atelier-studio', label: 'The Practice & Services Accordion' }
  ],
  photography: [
    { id: 'photo-style-bar', label: 'Shoot Style Filter Bar' },
    { id: 'photo-bento', label: 'Asymmetric Bento Grid' },
    { id: 'photo-essentials', label: 'Studio / Direction / Delivery Strip' },
    { id: 'photo-archive-bar', label: 'Archive Jump Bar' },
    { id: 'photo-cta', label: 'Book a Shoot CTA Banner' }
  ],
  styling: [
    { id: 'styling-narrative', label: 'Narrative Portrait Split' },
    { id: 'styling-services', label: 'Styling Service Tiers' },
    { id: 'styling-gallery', label: 'Selected Styling Case Studies' },
    { id: 'styling-cta', label: 'Commission Styling CTA Banner' }
  ],
  'social-media': [
    { id: 'social-ig', label: 'Interactive Instagram Feed Mockup' },
    { id: 'social-walkthrough', label: 'Inside a Session 3-Step Walkthrough' },
    { id: 'social-cta', label: 'Curate Your Flagship CTA Banner' }
  ],
  about: [
    { id: 'about-hero', label: 'Mohammed Editorial Portrait & Bio' },
    { id: 'about-values', label: 'Three Unwavering Principles' },
    { id: 'about-clients', label: 'Selected Collaborations & Houses' }
  ]
};

export const REQUIRED_DB_TABLES = [
  { name: 'admins', label: 'Admins & Roles', publicReadable: false },
  { name: 'site_content', label: 'Site Content (Draft/Live)', publicReadable: true },
  { name: 'site_revisions', label: 'Revision History', publicReadable: false },
  { name: 'media_categories', label: 'Media Categories', publicReadable: true },
  { name: 'media_items', label: 'Media Vault (Tags/Cats)', publicReadable: true },
  { name: 'pages', label: 'Pages & Per-Page SEO', publicReadable: true },
  { name: 'site_settings', label: 'Global Site Settings', publicReadable: true },
  { name: 'enquiries', label: 'Client Enquiries Inbox', publicReadable: false },
  { name: 'audit_log', label: 'Audit Telemetry Log', publicReadable: false }
];

// Smart initial category/tags inference for uncategorized catalog photos
export function inferAssetMetadata(item) {
  const text = `${item.title || ''} ${item.caption || ''} ${item.filename || ''}`.toLowerCase();
  let category = 'Photography';
  const tags = new Set();

  if (/gucci|fendi|versace|joshv|babush|vanderwilt|rouhi|modestart|lallamoulati|campaign/.test(text)) {
    category = 'Campaigns';
    tags.add('campaign');
  } else if (/bridal|wedding|milos|lanzarote|paris|spain|dubai|sunset|location/.test(text)) {
    category = 'Location & Bridal';
    tags.add('location');
  } else if (/gaultier|jacquemus|styling|styled|gowtu|wissal/.test(text)) {
    category = 'Styling';
    tags.add('styling');
  } else if (/tenebris|fetus|vigil|cosmica|unidentified|surrealism|seduca|butterfly|spider|🕷/.test(text)) {
    category = 'Avant-Garde';
    tags.add('avant-garde');
  } else if (/portrait|eyes|make up|makeup|beauty|sabri|daan|gloom|bromtji|powerwoman/.test(text)) {
    category = 'Portraits';
    tags.add('portrait');
  } else if (/feed-|session-/.test(text)) {
    category = 'Social Media';
    tags.add('social-media');
  }

  if (/anouk/.test(text)) tags.add('anouk');
  if (/vanderwilt/.test(text)) tags.add('vanderwilt');
  if (/gucci/.test(text)) tags.add('gucci');
  if (/amsterdam/.test(text)) tags.add('amsterdam');
  if (/bridal|wedding/.test(text)) tags.add('bridal');
  if (/beauty|makeup|make up/.test(text)) tags.add('beauty');
  if (/daan/.test(text)) tags.add('daan');
  if (/mel\.dlgn|caramel/.test(text)) tags.add('editorial');
  if (tags.size === 0) tags.add('atelier');

  return { category, tags: Array.from(tags) };
}
