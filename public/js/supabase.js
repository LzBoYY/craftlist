
const supabaseUrl =
  "https://umvpigxwceekndxnyrmi.supabase.co";

const supabaseKey =
  "sb_publishable_4UiI7fMJCoGKUnbhzwYkTg_0_r8F2Vz";

window.supabaseClient =
  window.supabase.createClient(
    supabaseUrl,
    supabaseKey
  );
