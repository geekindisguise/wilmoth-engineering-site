#!/usr/bin/env node
// Rebuilds js/vendor/three.js: a tree-shaken, minified subset of three.js
// holding only what js/system/scene.js imports. The site has no build step;
// this runs once by hand when scene.js needs a new three.js class.
//
//   mkdir -p /tmp/three-build && npm install --prefix /tmp/three-build three esbuild
//   node tools/vendor-three.mjs /tmp/three-build/node_modules
//
// If scene.js starts using a class that isn't listed here, add it to NAMES.
import { writeFileSync, readFileSync, mkdirSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const modules = resolve(process.argv[2] || 'node_modules');
const require = createRequire(join(modules, 'noop.js'));
const esbuild = require('esbuild');
const version = JSON.parse(readFileSync(join(modules, 'three/package.json'), 'utf8')).version;

const NAMES = [
  'WebGLRenderer', 'SRGBColorSpace', 'PCFShadowMap', 'DynamicDrawUsage',
  'Scene', 'Group', 'Object3D', 'Mesh', 'InstancedMesh', 'LineSegments',
  'OrthographicCamera', 'HemisphereLight', 'DirectionalLight',
  'BufferGeometry', 'Float32BufferAttribute', 'PlaneGeometry', 'BoxGeometry',
  'CylinderGeometry', 'SphereGeometry', 'TubeGeometry', 'EdgesGeometry',
  'CurvePath', 'LineCurve3', 'QuadraticBezierCurve3', 'CatmullRomCurve3',
  'MeshLambertMaterial', 'MeshBasicMaterial', 'ShadowMaterial', 'LineBasicMaterial',
  'CanvasTexture', 'Color', 'Vector2', 'Vector3', 'Box3', 'Raycaster', 'MathUtils',
];

const result = await esbuild.build({
  stdin: { contents: `export { ${NAMES.join(', ')} } from 'three';`, resolveDir: modules, loader: 'js' },
  bundle: true, format: 'esm', minify: true, write: false, target: 'es2020',
  legalComments: 'none',
});
const banner = `/* three.js r${version.split('.')[1]} (${version}) subset for wilmoth.engineering. MIT License, Copyright 2010-2025 three.js authors. Built by tools/vendor-three.mjs. */\n`;
const file = join(ROOT, 'js/vendor/three.js');
mkdirSync(dirname(file), { recursive: true });
writeFileSync(file, banner + result.outputFiles[0].text);
console.log(`wrote ${file} (${(result.outputFiles[0].text.length / 1024).toFixed(0)} KB, three ${version})`);
