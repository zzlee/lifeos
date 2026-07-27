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
