#!/bin/sh
set -eu

release_id=${CA_UI_RELEASE_ID:?Set CA_UI_RELEASE_ID to the static release ID}
case "$release_id" in
    [!a-zA-Z0-9]*|*[!a-zA-Z0-9._-]*)
        printf '%s\n' 'Invalid CA_UI_RELEASE_ID' >&2
        exit 64
        ;;
esac

umask 022
release_dir="dist/releases/$release_id"
yarn build:ca --base "/releases/$release_id/" --outDir "$release_dir"

cp "$release_dir/index.html" dist/index.html
gzip -nc dist/index.html > dist/index.html.gz
chmod 755 dist dist/releases
find "$release_dir" -type d -exec chmod 755 {} +
find "$release_dir" -type f -exec chmod 644 {} +
chmod 644 dist/index.html dist/index.html.gz
