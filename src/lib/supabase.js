import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://jtcawgggjkczxxpyshty.supabase.co'
const SUPABASE_ANON_KEY = 'PLACEHOLDER_ANON_KEY_REPLACE_ME'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
