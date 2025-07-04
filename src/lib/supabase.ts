import { createClient } from '@supabase/supabase-js'

// These environment variables need to be accessible to the browser
// Add them to your .env.local file with NEXT_PUBLIC_ prefix
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://gtcqilbysfgbpitzjulg.supabase.co'
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd0Y3FpbGJ5c2ZnYnBpdHpqdWxnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDEwMjQ4ODYsImV4cCI6MjA1NjYwMDg4Nn0.kVEvamqmWXaZoFK8qoKtSnP5acTO0y3HLv_Hf9muL7o'

// Create a browser-safe client
export const supabase = createClient(supabaseUrl, supabaseKey)