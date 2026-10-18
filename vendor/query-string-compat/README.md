# query-string compatibility adapter

This private package forwards all operations to **unmodified upstream
`query-string@9.5.1`**, installed under the npm alias `query-string-upstream`.
Its local version, `9.5.1-freed.1`, identifies this adapter rather than an
upstream release. Upstream's MIT license and Sindre Sorhus attribution are
preserved in `LICENSE.upstream`; see the
[upstream repository](https://github.com/sindresorhus/query-string).

Expo Router 55 and React Navigation 7 import the `query-string` namespace
and invoke `.parse`/`.stringify`. Upstream 9 exports these operations inside
a default object. This adapter exposes the same real upstream functions
through named ESM exports, the default object, and a CommonJS entry point.
It adds no query parsing/decoding implementation and contains no old v7
source. The patched `decode-uri-component@0.5.x` is a real installed and
auditable dependency of upstream 9.5.1.

The root dependency and a single npm workspace point to this local directory.
The workspace lets npm resolve the private adapter version without a registry
publication. Functions remain a separate package outside this workspace.
Consumer-scoped overrides
for Expo Router and Navigation select this adapter's exact version, allowing
npm to deduplicate their dependencies to the installed root package without
ambiguous relative file overrides. The aliased upstream v9 dependency remains
separate. Node 20.19 or newer is required for synchronous CommonJS-to-ESM
loading. Metro compiles the ESM dependency for web and native bundles.

Run `node --test tests/router-query-compat.test.mjs` from the application
root. These checks exercise actual React Navigation query parsing and
serialization, Expo Router's path serialization, both module shapes,
array/null/empty/Unicode parameters, and malformed input in a child
process with a three-second deadline. This is compatibility for the APIs
used by this app and its router/navigation dependencies, not a claim that
every v7 edge case is identical to upstream v9.

Remove this adapter once the installed router and navigation dependencies
adopt a patched decoder and upstream v9's export shape directly.
