import { readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

// A release directory changes the URL of the whole ESM graph, including relative imports.
export function versionStaticEntry(html, releaseId) {
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(releaseId)) throw new Error('Invalid static release ID');
  let replacements = 0;
  const result = html.replace(/(["'])\/assets\//g, (_, quote) => {
    replacements++;
    return `${quote}/releases/${releaseId}/assets/`;
  });
  if (!replacements) throw new Error('No root asset references found in entry HTML');
  return result;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [input, output, releaseId] = process.argv.slice(2);
  if (!input || !output || !releaseId) throw new Error('Usage: version-static-entry.mjs <input> <output> <release-id>');
  await writeFile(output, versionStaticEntry(await readFile(input, 'utf8'), releaseId));
}
