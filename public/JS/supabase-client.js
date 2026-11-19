(() => {
  const url = String(window.BILAFORM_SUPABASE_URL || '').trim();
  const key = String(window.BILAFORM_SUPABASE_PUBLISHABLE_KEY || '').trim();
  const sdk = window.supabase;
  if (!url || !key || !sdk?.createClient) {
    window.BilaFormSupabase = null;
    window.BILAFORM_SUPABASE_ERROR = !url || !key
      ? 'Supabase is not configured yet. Add your project URL and publishable key in JS/supabase-config.js.'
      : 'The Supabase JavaScript client did not load. Check the connection and reload.';
    return;
  }
  window.BilaFormSupabase = sdk.createClient(url, key, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
  });
  window.BILAFORM_SUPABASE_ERROR = '';
})();
