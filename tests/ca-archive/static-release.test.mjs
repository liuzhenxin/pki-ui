import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { gunzipSync } from 'node:zlib';

const script = fileURLToPath(new URL('../../scripts/build-ca-release.sh', import.meta.url));

test('builds entry and lazy assets under one versioned base with readable permissions', async (t) => {
  const cwd = await mkdtemp(join(tmpdir(), 'ca-static-release-'));
  t.after(() => rm(cwd, { recursive: true, force: true }));
  const bin = join(cwd, 'bin');
  await mkdir(bin);
  await writeFile(
    join(bin, 'yarn'),
    `#!/bin/sh
set -eu
test "$1" = build:ca
test "$2" = --base
test "$4" = --outDir
mkdir -p "$5/assets"
printf '<script src="%sassets/index.js"></script>' "$3" > "$5/index.html"
printf '%sassets/recovery.css' "$3" > "$5/assets/index.js"
touch "$5/assets/recovery.css"
`,
    { mode: 0o755 }
  );
  const previousRelease = join(cwd, 'dist/releases/previous');
  await mkdir(previousRelease, { recursive: true, mode: 0o700 });
  await writeFile(join(previousRelease, 'index.html'), 'previous entry');
  await writeFile(join(cwd, 'dist/index.html'), 'old entry', { mode: 0o600 });

  const result = spawnSync('sh', ['-c', 'umask 077; exec sh "$1"', 'sh', script], {
    cwd,
    env: { ...process.env, PATH: `${bin}:${process.env.PATH}`, CA_UI_RELEASE_ID: 'ca-recovery.3' },
    encoding: 'utf8'
  });
  assert.equal(result.status, 0, result.stderr);

  const release = join(cwd, 'dist/releases/ca-recovery.3');
  const entry = await readFile(join(cwd, 'dist/index.html'), 'utf8');
  assert.equal(entry, await readFile(join(release, 'index.html'), 'utf8'));
  assert.match(entry, /src="\/releases\/ca-recovery\.3\/assets\/index\.js"/);
  assert.equal(gunzipSync(await readFile(join(cwd, 'dist/index.html.gz'))).toString(), entry);
  assert.equal(await readFile(join(release, 'assets/index.js'), 'utf8'), '/releases/ca-recovery.3/assets/recovery.css');
  assert.equal(await readFile(join(previousRelease, 'index.html'), 'utf8'), 'previous entry');
  for (const name of ['dist', 'dist/releases', 'dist/releases/ca-recovery.3/assets']) {
    assert.equal((await stat(join(cwd, name))).mode & 0o777, 0o755);
  }
  for (const name of ['dist/index.html', 'dist/index.html.gz', 'dist/releases/ca-recovery.3/assets/recovery.css']) {
    assert.equal((await stat(join(cwd, name))).mode & 0o777, 0o644);
  }
});

test('rejects a release ID that would escape the asset directory', () => {
  const result = spawnSync('sh', [script], { env: { ...process.env, CA_UI_RELEASE_ID: '../other' }, encoding: 'utf8' });
  assert.equal(result.status, 64);
  assert.match(result.stderr, /Invalid CA_UI_RELEASE_ID/);
});
