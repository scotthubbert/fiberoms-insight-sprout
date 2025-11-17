#!/usr/bin/env node

// Count records with missing coordinates or at (0,0) in Supabase table 'mfs'
import { createClient } from '@supabase/supabase-js';

const url = process.env.VITE_SUPABASE_URL;
const key = process.env.VITE_SUPABASE_ANON_KEY;

if (!url || !key) {
  console.error('Missing env vars. Please export VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.');
  process.exit(1);
}

const supabase = createClient(url, key);

async function main() {
  try {
    const [{ count: missingCount, error: missingErr }, { count: zeroCount, error: zeroErr }] = await Promise.all([
      supabase
        .from('mfs')
        .select('id', { count: 'exact', head: true })
        .or('latitude.is.null,longitude.is.null'),
      supabase
        .from('mfs')
        .select('id', { count: 'exact', head: true })
        .eq('latitude', 0)
        .eq('longitude', 0)
    ]);

    if (missingErr) throw missingErr;
    if (zeroErr) throw zeroErr;

    const total = (missingCount || 0) + (zeroCount || 0);

    console.log(JSON.stringify({
      missingCoordinates: missingCount || 0,
      zeroZeroCoordinates: zeroCount || 0,
      combinedTotal: total
    }, null, 2));
  } catch (err) {
    console.error('Failed to count records:', err.message || err);
    process.exit(1);
  }
}

main();


