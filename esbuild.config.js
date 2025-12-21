import * as esbuild from 'esbuild';

// Check if DEV_MODE is enabled
const isDev = process.env.DEV_MODE === 'true' || process.env.NODE_ENV === 'development';

console.log(`Building provider bundle (DEV_MODE: ${isDev})`);

// Build the injectable provider as a self-executing IIFE for browser injection
await esbuild.build({
  entryPoints: ['src/provider/injected.ts'],
  bundle: true,
  outfile: 'dist/provider.js',
  format: 'iife',
  globalName: 'Web3WalletProvider',
  platform: 'browser',
  target: ['es2020'],
  minify: !isDev, // Minify in production, keep readable in dev
  sourcemap: isDev ? 'inline' : false,
  define: {
    'process.env.NODE_ENV': isDev ? '"development"' : '"production"',
    '__DEV_UI_ENABLED__': String(isDev),
  }
});

console.log('Provider bundle built: dist/provider.js');
