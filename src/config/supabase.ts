import { createClient } from '@supabase/supabase-js';
import config from './env';

if (!config.supabaseUrl || !config.supabaseKey) {
    console.warn('⚠️ Supabase configuration missing. URL:', config.supabaseUrl ? 'Set' : 'Missing', 'Key:', config.supabaseKey ? 'Set' : 'Missing');
    // throw new Error('Missing Supabase configuration'); // Temporarily disable throw to verify basic server start
}

export const supabase = createClient(config.supabaseUrl, config.supabaseKey);
