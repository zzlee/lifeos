## 2024-05-27 - [Avoid toLocaleString in loops]
**Learning:** `Date.prototype.toLocaleString` is very slow in JS engines. Using it inside an array `.map()` or `.filter()` over potentially thousands of items (like transactions) causes severe performance bottlenecks.
**Action:** Pre-calculate timezone boundaries outside the loop and use basic numerical `Date.getTime()` comparison for filtering lists of date strings.
## 2024-05-28 - [Delay expensive timezone formatting]
**Learning:** `Date.prototype.toLocaleString` is very slow. Applying it within a `.map()` on an array of thousands of items, even if that array is later sliced, causes a massive, unnecessary performance hit.
**Action:** When formatting dates for large datasets, sort the data using raw ISO date strings and apply pagination/limits (e.g., `.slice(0, 50)`) *before* running expensive mapping functions like `Date.prototype.toLocaleString`. This prevents running slow operations on discarded elements.
## 2024-05-29 - [Chunked String.fromCharCode for base64]
**Learning:** Cloudflare workers can experience severe performance penalties or "Maximum call stack size exceeded" errors with simple character-by-character string concatenation for generating base64 (e.g. from Uint8Array). Similarly `Array.from()` incurs too much allocation overhead.
**Action:** Use chunked strategy with an 8192-byte window and `String.fromCharCode.apply(null, chunk as unknown as number[])` to safely and efficiently generate base64 strings without overflowing the call stack.
## 2024-05-30 - [Avoid multiple map/reduce passes in renders]
**Learning:** Running multiple `.map()` or `.reduce()` passes over the same array inside a React render function (e.g. calculating related stats or multi-line SVG paths) causes excessive array/string allocations and unnecessary O(N) traversal overhead.
**Action:** Consolidate related calculations into a single `for` loop to save intermediate allocations and reduce time complexity.
## 2024-05-31 - [Cache User DB Lookups per Request]
**Learning:** Authenticating every API request by repeatedly querying the users table adds unnecessary D1 latency and consumes limited DB ops, especially on a unified worker architecture where the same user hits multiple routes.
**Action:** Use a module-scoped `Map` with a short TTL (e.g. 5 minutes) as a session cache keyed by `user.id` in `resolveSession`, and selectively invalidate it upon profile updates, preventing thousands of redundant SELECT queries.
## 2024-05-31 - [Debounce text inputs bound to API calls]
**Learning:** Text inputs that update state used directly as dependencies for backend API calls can cause severe network bottlenecks and server load when updated on every keystroke.
**Action:** Always introduce a debounce delay (e.g. 300ms) for search/query inputs in React components to prevent redundant API fetches.
## 2024-06-03 - [Memoize global prompt component descendants]
**Learning:** In a monolithic app architecture where a highly dynamic state (like an AI prompt input updating on every keystroke) resides at the top level (`App.tsx`), *all* nested components re-render by default on every keystroke. This destroys text input performance if child components are doing any layout or rendering work, even if they appear static.
**Action:** Aggressively wrap purely presentational descendants (like `MetricCard`, `StatCard`, `FinanceRow`, etc) in `React.memo` to shield them from top-level state churn.
## 2024-06-05 - [Avoid redundant client-side sorting of pre-ordered data]
**Learning:** If a backend database query already guarantees order (e.g. `ORDER BY created_at DESC`), we should not redundantly sort the data again on the frontend using expensive O(N log N) `Array.prototype.sort()` coupled with slow `new Date()` parsing.
**Action:** When we need to flip the display order (e.g., from newest-first to oldest-first), use a simple O(N) `Array.prototype.reverse()` on the returned array to drastically reduce parsing and sorting overhead.
## 2024-06-03 - [Memoize complex router descendants]
**Learning:** In a monolithic app architecture where a highly dynamic state (like an AI prompt input updating on every keystroke) resides at the top level (`App.tsx`), *all* nested components re-render by default on every keystroke. This destroys text input performance if child components are doing any layout or rendering work.
**Action:** Aggressively wrap isolated view components (like `LineChatView`) in `React.memo` to shield them from parent state churn if they do not depend on it.
## 2024-06-07 - [Avoid multiple filter passes for counts]
**Learning:** Running multiple `.filter().length` passes over the same array to get subset counts creates unnecessary intermediate arrays and incurs redundant O(N) traversal overhead. This is a common React anti-pattern when calculating derived summary stats.
**Action:** Consolidate related count calculations into a single `for` loop to save intermediate allocations and reduce time complexity.
