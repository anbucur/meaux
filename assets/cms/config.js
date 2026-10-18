/* =====================================================================
   MEAUX CMS — CONFIGURATION
   ===================================================================== */
(function() {
  const LOCAL_CONFIG_KEY = 'meaux_supabase_config';
  let stored = {};
  try {
    stored = JSON.parse(localStorage.getItem(LOCAL_CONFIG_KEY) || '{}');
  } catch (e) {}

  window.MEAUX_CONFIG = {
    // Replace with your real Supabase project URL and anon public key,
    // OR enter them directly inside the Admin Settings panel in the browser.
    supabaseUrl: stored.url || '',
    supabaseAnonKey: stored.anonKey || '',
    
    // Default master admin who is always granted access upon seed
    initialAdmin: 'alexandru.n.bucur@gmail.com',

    // Helper to persist credentials from the UI
    saveCredentials(url, anonKey) {
      this.supabaseUrl = (url || '').trim();
      this.supabaseAnonKey = (anonKey || '').trim();
      try {
        localStorage.setItem(LOCAL_CONFIG_KEY, JSON.stringify({
          url: this.supabaseUrl,
          anonKey: this.supabaseAnonKey
        }));
      } catch (e) {}
    },

    isConfigured() {
      return Boolean(this.supabaseUrl && this.supabaseAnonKey);
    }
  };
})();
