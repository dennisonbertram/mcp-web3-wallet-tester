import * as esbuild from 'esbuild';

// Build the injectable provider as a self-executing IIFE for browser injection
await esbuild.build({
  entryPoints: ['src/provider/injected.ts'],
  bundle: true,
  outfile: 'dist/provider.js',
  format: 'iife',
  globalName: 'Web3WalletProvider',
  platform: 'browser',
  target: ['es2020'],
  minify: false, // Keep readable for debugging
  sourcemap: 'inline',
  define: {
    'process.env.NODE_ENV': '"production"'
  }
});

console.log('Provider bundle built: dist/provider.js');
