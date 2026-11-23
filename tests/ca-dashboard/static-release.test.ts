import { describe, expect, it } from 'vitest';
import { versionStaticEntry } from '../../scripts/version-static-entry.mjs';

describe('versioned static entry', () => {
  it('versions script, preload and CSS references while preserving other paths', () => {
    const html = `<script type="module" src="/assets/entry.js"></script><link rel='modulepreload' href='/assets/runtime.js'><link href="/assets/style.css"><link href="/favicon.ico"><a href="/api-gateway/ca">CA</a>`;
    const result = versionStaticEntry(html, 'ca-dashboard-20261119');
    expect(result).toContain('src="/releases/ca-dashboard-20261119/assets/entry.js"');
    expect(result).toContain("href='/releases/ca-dashboard-20261119/assets/runtime.js'");
    expect(result).toContain('href="/releases/ca-dashboard-20261119/assets/style.css"');
    expect(result).toContain('href="/favicon.ico"');
    expect(result).toContain('href="/api-gateway/ca"');
  });

  it('rejects unsafe release paths', () => {
    expect(() => versionStaticEntry('<script src="/assets/a.js"></script>', '../other')).toThrow('Invalid static release ID');
  });

  it('rejects entries without root assets instead of silently publishing unchanged URLs', () => {
    expect(() => versionStaticEntry('<html></html>', 'release-1')).toThrow('No root asset references');
  });

  it('does not accidentally nest a previously versioned release', () => {
    const html = '<script src="/releases/old/assets/entry.js"></script>';
    expect(() => versionStaticEntry(html, 'release-2')).toThrow('No root asset references');
  });
});
