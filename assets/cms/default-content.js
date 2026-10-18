/* =====================================================================
   MEAUX CMS — DEFAULT CONTENT SNAPSHOT
   ===================================================================== */
window.MEAUX_DEFAULT_CONTENT = {
  theme: {
    fontDisplay: "'Syne', sans-serif",
    fontSerif: "'Cormorant Garamond', serif",
    fontMono: "'Space Mono', monospace",
    colors: {
      obsidian: '#050506',
      paper: '#f4f4f0',
      line: '#27272a',
      muted: '#8e8e8a'
    }
  },
  settings: {
    siteTitle: 'MEAUX — Spatial, Visual & Brand Atelier',
    metaDescription: 'Meaux — an independent creative practice in photography, interior design, brand identity and social media.',
    contactEmail: 'bucuralexandrunicolae@gmail.com',
    allowedAdmins: ['alexandru.n.bucur@gmail.com']
  },
  vault: {
    kicker: 'A WORLD BY MEAUX',
    tagline: 'IMAGE. IDENTITY. SPACE.',
    hint: 'Move your cursor. Disturb the surface.',
    motto: 'SOFT FORM. SHARP INSTINCT.',
    disciplines: [
      'INTERIOR DESIGN',
      'BRAND IDENTITY',
      'AVANT-GARDE PHOTOGRAPHY',
      'SOCIAL MEDIA CURATION'
    ]
  },
  footer: {
    tagline: 'Independent in thought. Intentional in form.',
    instagram: 'Instagram @meauxsvision ↗',
    instagramUrl: 'https://www.instagram.com/meauxsvision/',
    copyright: 'Meaux Atelier · All rights reserved.'
  },
  pages: [
    { id: 'atelier', title: 'Atelier', isSystem: true },
    { id: 'photography', title: 'Photography', isSystem: true },
    { id: 'styling', title: 'Styling', isSystem: true },
    { id: 'social-media', title: 'Social Media Curation', isSystem: true },
    { id: 'interior-design', title: 'Interior Design', isSystem: true },
    { id: 'about', title: 'About Me', isSystem: true },
    { id: 'enquiries', title: 'Enquiries', isSystem: true }
  ],
  customBlocks: {
    // pageId -> array of dynamic block objects { id, type, data }
    // e.g. for user created sections
  }
};
