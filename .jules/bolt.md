## 2024-05-27 - [Avoid toLocaleString in loops]
**Learning:** `Date.prototype.toLocaleString` is very slow in JS engines. Using it inside an array `.map()` or `.filter()` over potentially thousands of items (like transactions) causes severe performance bottlenecks.
**Action:** Pre-calculate timezone boundaries outside the loop and use basic numerical `Date.getTime()` comparison for filtering lists of date strings.
