Testing Notes and Harness Adjustments

- CI sandbox guard: set `CI_SANDBOX=true` to skip socket-binding smoke tests that call Supertest against a real HTTP listener (`tests/smoke.test.ts`). This avoids EPERM in restricted environments.
- Knex test builder: `tests/jest.setup.js` now provides a minimal in-memory Knex mock with:
  - Chain support: `select`, `where`, `leftJoin`, `orderBy`, `limit`, etc.
  - Inserts: `insert().returning('*')` merges inserted data and sets `created_at`/`updated_at`.
  - Uniqueness lookup: `where(criteria).first()` searches the in-memory table (used by slug uniqueness checks).
  - Basic counts: `count('* as count')` returns table length.
- WatchPack tests: use unique slugs where needed to avoid cross-test collisions; created_at/updated_at are available from the builder.
  - Pagination helpers: the builder now supports `clone/clearSelect/clearOrder/clearWhere/countDistinct` and groups in `where(fn) { where().orWhere() }` for search. If you see discrepancies in totals, prefer resolving queries at the last chain call or add explicit distinct-by-id where required.
- PriceComparisonService tests: resolve query results on the last method in a chain (e.g., `orderBy.mockResolvedValueOnce(...)`, or the final `where`/`limit`) to align with code paths that do `await query` on the chain.
- Sanitization behavior: search queries preserve quotes; tests updated to expect escaped quotes rather than removal.
- AuthService tests: constructor now requires repo + logger; tests inject a small adapter to the mocked `User` statics; JWT payload uses `sub`.
- RetailerIntegrationService tests: mock retailer constructors via `jest.spyOn(module, 'ClassName').mockImplementation(...)` instead of `jest.MockedClass`.

Tip: When a test awaits a chain variable (e.g., `const result = await query;`), ensure the last mocked method in the chain resolves the value rather than earlier steps.
