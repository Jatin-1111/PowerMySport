# Server tests

`npm test` builds to `dist/` and runs `node --test` over `dist/tests/*.test.js`.

## Why the suite runs serially

`--test-concurrency=1` is deliberate.

Sixteen of these files each start their own `MongoMemoryServer`. Run in
parallel, roughly one run in four failed — always in a file unrelated to
whatever had just changed, and always one that passed on its own. The symptom
is a lower-than-expected test count plus a handful of failures, because a whole
file dies during startup rather than any assertion failing. It surfaced twice
as `Unable to deserialize cloned data due to invalid or unsupported version`,
which is the runner losing a child process, not a test problem.

Bounding concurrency at 4 was still flaky. Serial has been stable across
repeated runs and costs about two minutes for ~345 tests. A suite that has to
be re-run to be believed is not a safety net, so the two minutes are worth it.

If this becomes too slow, the fix is to share one `MongoMemoryServer` across
files (a global setup hook) rather than to raise the concurrency again.

## Writing an integration test

- One `MongoMemoryServer` **per file**, started in a top-level `before` and
  stopped in `after`. Two `describe` blocks each starting their own server in
  the same file will break the suite: mongoose has a single default connection,
  so the first `after` tears down the connection the second block is still
  using.
- Never rely on the default connection. Local development points at the live
  production cluster, so a test that connects without an explicit in-memory URI
  writes to production.
- Set `process.env.JWT_SECRET` before requiring app modules — several read env
  at load time.
