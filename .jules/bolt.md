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
## 2026-08-02 - [Debounce frontend inputs to prevent excessive API load]
**Learning:** Keystroke-triggered API calls in React components without debouncing cause a massive, unnecessary volume of network requests and database queries, especially for text search inputs (e.g. `vaultQuery`).
**Action:** Introduce a debounced state using `useEffect` and `setTimeout` to delay state updates passed to fetch functions, reducing backend load and unnecessary re-renders.
