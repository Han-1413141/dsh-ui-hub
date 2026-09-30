/** Verify against an installed DSH runtime; pass its node_modules parent as argv[2]. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { runInNewContext } from 'node:vm';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const runtime = resolve(process.argv[2] || root);
const runtimeRequire = createRequire(resolve(runtime, 'package.json'));
const fromRuntime = (name) => import(pathToFileURL(runtimeRequire.resolve(name)).href);
const { Context } = await fromRuntime('@deepseek-ai/cordis');
const { ClientModuleRegistry } = await fromRuntime('@deepseek-ai/dsh-client-modules');
const manifest = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));
const version = runtimeRequire('@deepseek-ai/dsh/package.json').version;
const ctx = new Context();
try {
  const host = await import(pathToFileURL(resolve(root, 'lib/index.js')).href);
  const fiber = await ctx.plugin(host);
  ctx.baseUrl = pathToFileURL(root + '/').href;
  ctx.provide('loader', {
    *entries() {
      yield { options: { name: manifest.name }, fiber, disabled: false,
        parent: { tree: { ctx: { baseUrl: ctx.baseUrl } } } };
    },
  });
  ctx.provide('webServer', { port: 0, register: () => () => {}, tapIndex: () => () => {} });
  const service = new ClientModuleRegistry(ctx);
  const graph = service.graph();
  const entry = graph.entries.find((row) => row.id === manifest.name);
  assert.ok(entry, 'actual runtime discovers the client entry');
  assert.equal(manifest.dsh.client.platform, 'web', 'Desktop uses the shared web client platform');
  const response = await service.fetchBundle(new Request(new URL(entry.url, 'http://localhost/')));
  assert.equal(response.status, 200, 'current revisioned bundle route serves the plugin');
  let registered;
  runInNewContext(await response.text(), { window: { __ModuleLoader__: { load: (value) => { registered = value; } } } });
  assert.equal(registered.id, manifest.name);
  assert.equal(typeof registered.factory, 'function');
  console.log(`PASS ${manifest.name}: DSH ${version} host activation, client graph and revisioned bundle transport`);
} finally {
  await ctx.fiber.dispose();
}
