// inject-env.js
// Copies the project files to dist/, replacing __SUPABASE_URL__ and __SUPABASE_ANON_KEY__
// placeholders with real values from environment variables.
// This runs as the Netlify build command so secrets are never committed to git.

const fs   = require('fs');
const path = require('path');

const url  = process.env.SUPABASE_URL;
const key  = process.env.SUPABASE_ANON_KEY;

if (!url || !key) {
  console.error('ERROR: SUPABASE_URL and SUPABASE_ANON_KEY must be set as environment variables.');
  process.exit(1);
}

const distDir = path.join(__dirname, 'dist');

// Recursively copy a directory, processing .js and .html files for placeholder replacement
function copyDir(srcDir, destDir) {
  fs.mkdirSync(destDir, { recursive: true });
  for (const entry of fs.readdirSync(srcDir, { withFileTypes: true })) {
    const srcPath  = path.join(srcDir, entry.name);
    const destPath = path.join(destDir, entry.name);
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      let content = fs.readFileSync(srcPath, 'utf8');
      if (entry.name.endsWith('.js') || entry.name.endsWith('.html')) {
        content = content
          .replace(/__SUPABASE_URL__/g,      url)
          .replace(/__SUPABASE_ANON_KEY__/g, key);
      }
      fs.writeFileSync(destPath, content, 'utf8');
    }
  }
}

// Clean dist and rebuild
if (fs.existsSync(distDir)) {
  fs.rmSync(distDir, { recursive: true });
}

// Copy index.html
const indexSrc  = path.join(__dirname, 'index.html');
const indexDest = path.join(distDir, 'index.html');
fs.mkdirSync(distDir, { recursive: true });
let html = fs.readFileSync(indexSrc, 'utf8');
html = html
  .replace(/__SUPABASE_URL__/g,      url)
  .replace(/__SUPABASE_ANON_KEY__/g, key);
fs.writeFileSync(indexDest, html, 'utf8');

// Copy css/ directory
copyDir(path.join(__dirname, 'css'), path.join(distDir, 'css'));

// Copy js/ directory (config.js has the placeholders)
copyDir(path.join(__dirname, 'js'),  path.join(distDir, 'js'));

console.log('Build complete → dist/');
