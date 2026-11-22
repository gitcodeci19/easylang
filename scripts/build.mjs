import * as esbuild from 'esbuild';
import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const publicDir = path.join(rootDir, 'public');
const distDir = path.join(rootDir, 'dist');
const isWatch = process.argv.includes('--watch');

async function copyStaticAssets() {
  await mkdir(distDir, { recursive: true });
  await cp(publicDir, distDir, { recursive: true, force: true });

  // Compact and gzip built-in cards deck inside dist/ (4.44 MB -> ~0.71 MB; Chrome DecompressionStream reads it in ~15ms)
  const distCardsJson = path.join(distDir, 'data', 'cards.json');
  const rawCards = await readFile(distCardsJson, 'utf8');
  const compactCards = JSON.stringify(JSON.parse(rawCards));
  await writeFile(path.join(distDir, 'data', 'cards.json.gz'), gzipSync(Buffer.from(compactCards, 'utf8'), { level: 9 }));
  await rm(distCardsJson, { force: true });

  // Copy ONNX Runtime Web SIMD WASM binary locally for MV3 CSP compliance (Chrome 116+ always supports WASM SIMD)
  const ortDistDir = path.join(rootDir, 'node_modules/onnxruntime-web/dist');
  const ttsDistDir = path.join(distDir, 'tts');
  await mkdir(ttsDistDir, { recursive: true });
  await cp(path.join(ortDistDir, 'ort-wasm-simd.wasm'), path.join(ttsDistDir, 'ort-wasm-simd.wasm'), {
    force: true,
  });
}

async function runBuild() {
  await rm(distDir, { recursive: true, force: true });
  await copyStaticAssets();

  const sharedOptions = {
    bundle: true,
    sourcemap: isWatch ? 'inline' : false,
    minify: !isWatch,
    target: 'chrome116',
    logLevel: 'info',
  };

  const configs = [
    {
      ...sharedOptions,
      entryPoints: [path.join(rootDir, 'src/background/index.ts')],
      outfile: path.join(distDir, 'background.js'),
      format: 'esm',
    },
    {
      ...sharedOptions,
      entryPoints: [path.join(rootDir, 'src/content/index.ts')],
      outfile: path.join(distDir, 'content.js'),
      format: 'iife',
    },
    {
      ...sharedOptions,
      entryPoints: [path.join(rootDir, 'src/popup/index.ts')],
      outfile: path.join(distDir, 'popup.js'),
      format: 'esm',
    },
    {
      ...sharedOptions,
      entryPoints: [path.join(rootDir, 'src/options/index.ts')],
      outfile: path.join(distDir, 'options.js'),
      format: 'esm',
    },
    {
      ...sharedOptions,
      entryPoints: [path.join(rootDir, 'src/offscreen/ttsOffscreen.ts')],
      outfile: path.join(distDir, 'tts-offscreen.js'),
      format: 'esm',
    },
  ];

  if (isWatch) {
    const contexts = await Promise.all(configs.map((cfg) => esbuild.context(cfg)));
    await Promise.all(contexts.map((ctx) => ctx.watch()));
    console.log('[watch] Listening for TypeScript changes...');
  } else {
    await Promise.all(configs.map((cfg) => esbuild.build(cfg)));
    console.log('[build] Extension bundled cleanly into dist/');
  }
}

runBuild().catch((err) => {
  console.error(err);
  process.exit(1);
});
