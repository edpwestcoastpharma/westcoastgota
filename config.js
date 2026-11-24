/* West-Coast Gota Plant – Tool Access: settings
   storage: "local"    -> data saved in each browser only (works with no setup)
   storage: "supabase" -> data shared on every computer (fill in the two Supabase values below)
*/
window.WC_CONFIG = {
  storage: "local",
  supabaseUrl: "",       // e.g. "https://abcdxyz.supabase.co"
  supabaseAnonKey: "",   // Supabase > Project Settings > API > anon public key
  stateId: "gota"        // keep "gota" for the Gota plant
};
