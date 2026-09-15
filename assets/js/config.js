/* ============================================================
   Console configuration

   apiBase empty  -> the console runs on the mock data in mock.js.
   apiBase set    -> every screen talks to the Nexas API.

   Set it to your Render URL when the service is up:
     apiBase: 'https://nexas-api.onrender.com'
   ============================================================ */
window.NexasAdminConfig = {
  apiBase: '',

  /* Supabase project. The publishable key is safe in a browser — it is
     bound by row level security and cannot read another user's rows.
     The service-role key must never appear in a file like this. */
  supabaseUrl: 'https://avzuiwqkqyhsjanjwtrx.supabase.co',
  supabaseKey: 'sb_publishable_aGZeOzRTqbvY2P6NgEVliQ_d_rh_pvn'
};
