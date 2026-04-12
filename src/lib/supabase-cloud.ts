import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://uzzgswzicyrqgsnbfzop.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_CwkVNXFljgTqLdupj5Tvtw_giJUv5eM";

export const supabaseCloud = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
