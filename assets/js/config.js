/* ============================================================
   Console configuration

   The console reads everything from the Novi API. Point this at the
   service and sign in; without it nothing can be read and no one can
   sign in, which is the correct answer rather than a convenient one.

   The console's own origin must be listed in the API's CORS_ORIGINS,
   or the browser refuses every call before it leaves.
   ============================================================ */
window.NexasAdminConfig = {
  apiBase: 'https://backend-avzc.onrender.com',

  /* Supabase project. The publishable key is safe in a browser, it is
     bound by row level security and cannot read another user's rows.
     The service-role key must never appear in a file like this. */
  supabaseUrl: 'https://avzuiwqkqyhsjanjwtrx.supabase.co',
  supabaseKey: 'sb_publishable_aGZeOzRTqbvY2P6NgEVliQ_d_rh_pvn'
};
