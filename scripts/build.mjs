import * as esbuild from 'esbuild';
import { cp, mkdir, rm } from 'node:fs/promises';
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

  // Copy ONNX Runtime Web single-threaded WASM binaries locally for MV3 CSP compliance
  const ortDistDir = path.join(rootDir, 'node_modules/onnxruntime-web/dist');
  const ttsDistDir = path.join(distDir, 'tts');
  await mkdir(ttsDistDir, { recursive: true });
  for (const wasmFile of ['ort-wasm-simd.wasm', 'ort-wasm.wasm']) {
    await cp(path.join(ortDistDir, wasmFile), path.join(ttsDistDir, wasmFile), { force: true });
  }
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
      plugins: [
        {
          name: 'emscripten-node-stub',
          setup(build) {
            // Expose bundled Emscripten piper_phonemize ESM glue for multi-voice (EN + TR İlkiz) synthesis
            build.onResolve({ filter: /^piper-phonemize$/ }, () => ({
              path: path.join(rootDir, 'node_modules/@mintplex-labs/piper-tts-web/dist/piper-o91UDS6e.js'),
            }));
            // Emscripten's piper_phonemize wrapper contains Node-only guarded branches for fs/path
            build.onResolve({ filter: /^(fs|path|crypto)$/ }, (args) => ({
              path: args.path,
              namespace: 'node-stub',
            }));
            build.onLoad({ filter: /.*/, namespace: 'node-stub' }, () => ({
              contents: 'export default {};',
              loader: 'js',
            }));
          },
        },
      ],
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
