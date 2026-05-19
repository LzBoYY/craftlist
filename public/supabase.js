import { createClient } from "@supabase/supabase-js";

const supabaseUrl =
  "https://umvpigxwceekndxnyrmi.supabase.co";

const supabaseAnonKey =
  "sb_publishable_4UiI7fMJCoGKUnbhzwYkTg_0_r8F2Vz";

export const supabase = createClient(
  supabaseUrl,
  supabaseAnonKey
);
