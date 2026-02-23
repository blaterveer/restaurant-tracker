// inject-env.js
// Reads index.html, replaces __SUPABASE_URL__ and __SUPABASE_ANON_KEY__ placeholders
// with real values from environment variables, and writes the result to dist/index.html.
// This runs as the Netlify build command so secrets are never committed to git.

const fs   = require('fs');
const path = require('path');

const url  = process.env.SUPABASE_URL;
const key  = process.env.SUPABASE_ANON_KEY;

if (!url || !key) {
  console.error('ERROR: SUPABASE_URL and SUPABASE_ANON_KEY must be set as environment variables.');
  process.exit(1);
}

const src  = path.join(__dirname, 'index.html');
const dest = path.join(__dirname, 'dist', 'index.html');

fs.mkdirSync(path.join(__dirname, 'dist'), { recursive: true });

let html = fs.readFileSync(src, 'utf8');
html = html
  .replace(/__SUPABASE_URL__/g,      url)
  .replace(/__SUPABASE_ANON_KEY__/g, key);

fs.writeFileSync(dest, html, 'utf8');
console.log('Build complete → dist/index.html');
