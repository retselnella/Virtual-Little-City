import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { dirname, resolve, relative, extname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../src/', import.meta.url));
function files(dir) { return readdirSync(dir, { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? files(resolve(dir, entry.name)) : [resolve(dir, entry.name)]); }
const modules = files(root).filter(file => /\.[jt]sx?$/.test(file));
const edges = new Map();
const permitted = {
  models: ['models', 'config'], config: ['config'], services: ['services', 'models', 'config'],
  scenes: ['scenes', 'models', 'config'], hooks: ['hooks', 'services', 'models', 'scenes', 'config'],
  controllers: ['controllers', 'hooks', 'services', 'models', 'scenes', 'config'],
  views: ['views', 'hooks', 'models', 'services', 'config'], app: ['app', 'controllers', 'views', 'hooks'],
};
test('source imports resolve with exact casing and respect MVC layer boundaries', () => {
  for (const file of modules) {
    const source = readFileSync(file, 'utf8'), layer = relative(root, file).split(/[\\/]/)[0];
    const imports = [...source.matchAll(/\b(?:from|import)\s*(?:\(\s*)?['"]([^'"]+)['"]/g)].map(match => match[1]);
    const dependencies = [];
    for (const specifier of imports) {
      if (!specifier.startsWith('.')) {
        if (layer === 'models') assert(!['react', 'react-dom', 'three'].some(name => specifier === name || specifier.startsWith(name + '/')), file);
        continue;
      }
      assert(extname(specifier), `Use explicit extensions: ${file} -> ${specifier}`);
      const target = resolve(dirname(file), specifier);
      assert(existsSync(target), `Missing module: ${file} -> ${specifier}`);
      assert(readdirSync(dirname(target)).includes(basename(target)), `Wrong import casing: ${specifier}`);
      if (!/\.jsx?$/.test(target)) continue;
      dependencies.push(target);
      const targetLayer = relative(root, target).split(/[\\/]/)[0];
      if (permitted[layer]) assert(permitted[layer].includes(targetLayer), `Invalid layer dependency: ${layer} -> ${targetLayer} in ${file}`);
    }
    if (layer !== 'services') assert(!/\b(?:localStorage|sessionStorage)\s*\./.test(source), `Storage belongs in services: ${file}`);
    if (layer === 'models') assert(!/\b(?:window|document|navigator)\s*\./.test(source), `DOM access in model: ${file}`);
    assert(!/dangerouslySetInnerHTML|\.innerHTML\s*=|\beval\s*\(/.test(source), `Unsafe HTML or evaluation: ${file}`);
    edges.set(file, dependencies);
  }
});
test('application modules contain no circular imports', () => {
  // Build independently so this test also works with --test-name-pattern.
  for (const file of modules) {
    const imports = [...readFileSync(file, 'utf8').matchAll(/\b(?:from|import)\s*(?:\(\s*)?['"]([^'"]+)['"]/g)].map(match => match[1]);
    edges.set(file, imports.filter(specifier => specifier.startsWith('.') && /\.jsx?$/.test(specifier)).map(specifier => resolve(dirname(file), specifier)));
  }
  const done = new Set();
  function visit(file, route = []) {
    assert(!route.includes(file), `Circular import: ${[...route, file].map(file => relative(root, file)).join(' -> ')}`);
    if (done.has(file)) return;
    for (const next of edges.get(file) ?? []) visit(next, [...route, file]);
    done.add(file);
  }
  modules.forEach(file => visit(file));
});
