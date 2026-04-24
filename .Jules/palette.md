## 2024-03-01 - Missing Visual Feedback for AI Operations
**Learning:** Found that the primary "LifeOS Agent" command bar completely lacks visual feedback during its async operation. This leaves users wondering if their input was received, leading to potential duplicate submissions or confusion. Also discovered that several modal close buttons are missing `aria-label`s.
**Action:** Added a loading state (`⏳` and `disabled`) to the AI submit button, disabled the input field while processing, and added `aria-label="關閉"` to modal close (`✕`) buttons to improve screen reader accessibility. Ensure all future async interactions have a loading state to prevent user friction.## 2024-04-12 - Input Overflow and Default Values in Modals
**Learning:** Inputs within flexbox containers (`.form-row` -> `.form-group`) can overflow the modal boundaries if they lack a defined width, especially on mobile viewports. Additionally, numeric inputs initializing with non-zero defaults (like `120`/`80` for blood pressure) force users to manually clear them before entering new data, causing friction.
**Action:** Added `width: 100%` to `.form-group input` to constrain them within their flex containers. Updated initial states to `0` and bound input values to show empty (`value={state || ""}`) to allow quick data entry, and added `onFocus={e => e.target.select()}` for faster modification of existing values.
## 2026-04-14 - Modal form group flex shrinkage
**Learning:** In a flex container context, inputs and textareas can overflow their parent container boundaries on small viewports unless explicitly constrained.
**Action:** Applied `min-width: 0` to `.form-group` flex children and `width: 100%` to inputs and textareas to enforce proper shrinkage.
## 2025-02-18 - Modal Readability
**Learning:** Semi-transparent or omitted background colors on modal overlays can cause underlying page content to bleed through, making inputs hard to read.
**Action:** Always ensure modal containers (e.g., `.modal-content`) have an explicit opaque background color (e.g., `background: #ffffff;`).

## 2025-02-18 - Interactive Row Accessibility
**Learning:** Custom interactive elements like clickable rows or cards using `onClick` must be navigable via keyboard to support accessibility.
**Action:** Add `role="button"`, `tabIndex={0}`, and `onKeyDown` handlers (listening for Enter or Space) to ensure they function like native buttons.
