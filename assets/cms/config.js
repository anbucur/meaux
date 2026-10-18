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
    supabaseUrl: stored.url || 'https://lttsxfxookcqslbftygc.supabase.co',
    supabaseAnonKey: stored.anonKey || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx0dHN4Znhvb2tjcXNsYmZ0eWdjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIzMTQ0MjQsImV4cCI6MjEwNzg5MDQyNH0.xzqXpFypkcLnJvpghgwHPZIRdItTwl1kgSXpAPhJUr4',
    
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
