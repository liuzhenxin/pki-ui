import { describe, expect, it } from 'vitest';
import { containerImageTag, matchesContainerVersion } from '../../src/views/ops/utils';

describe('container version scan matching', () => {
  const repository = 'registry.example:5006/pki/pki-ca';
  const scanned = { currentTag: '3.0.31-rc.2', currentDigest: 'sha256:previous' };

  it('drops the scan for the previous tag even when the Agent supplies no digest', () => {
    const container = { image: `${repository}:3.0.31-rc.2`, imageDigest: '' };
    expect(matchesContainerVersion(container, { currentTag: '3.0.28', currentDigest: '' })).toBe(false);
  });

  it('drops the scan when the digest changes under the same tag', () => {
    const container = { image: `${repository}:3.0.31-rc.2`, imageDigest: 'sha256:current' };
    expect(matchesContainerVersion(container, scanned)).toBe(false);
  });

  it('keeps a scan for the same running image, including candidates with a newer Registry digest', () => {
    const container = { image: `${repository}:3.0.31-rc.2`, imageDigest: scanned.currentDigest };
    const candidate = { ...scanned, latestReleaseDigest: 'sha256:replacement', updateAvailable: true };
    expect(matchesContainerVersion(container, candidate)).toBe(true);
  });

  it('does not read the registry port or a pinned digest as a tag', () => {
    expect(containerImageTag(repository)).toBe('');
    expect(containerImageTag(`${repository}@sha256:current`)).toBe('');
  });
});
