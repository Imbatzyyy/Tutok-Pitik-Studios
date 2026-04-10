import { createClient } from '@supabase/supabase-js';

// Use environment variables instead of hardcoded values
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://wztiuvgmxivogvhqaxvu.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind6dGl1dmdteGl2b2d2aHFheHZ1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU3MjEzMzksImV4cCI6MjA5MTI5NzMzOX0.pb2UCCD1akv5e7uxfEzlxzj29kCOuB-N7HLE0glYMQk';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Extract project ID from URL for API calls
export const projectId = supabaseUrl.replace('https://', '').replace('.supabase.co', '');
export const publicAnonKey = supabaseAnonKey;