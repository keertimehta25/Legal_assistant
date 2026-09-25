# LegalLens — Code Quality & Evaluation Parameter Improvements

## Audit by Parameter

### ✅ Already Well-Addressed
- **Security**: Helmet headers, rate limiting, CORS with origin config, file-type filter, size limit, input char limit, dotenv
- **Accessibility (App.jsx)**: Skip link, aria-label on nav, aria-live regions, focus management on main, sr-only labels
- **Code Quality (server)**: Well-structured routes, central error handler, good separation of concerns (aiProvider / geminiService / documentService)
- **Testing**: 8 passing tests covering happy paths, 400/413 validation, 503 mapping, security headers

---

## Changes to Make

### 1. Problem Statement Alignment (HIGH IMPACT)
**Issue:** `DashboardPage.jsx` — the page title and empty state lack semantic headings. The "not analyzed" state is a bare `<div>`, not a proper `<main>` context with role guidance.
**Issue:** `DashboardPage.jsx` — `key={i}` on list items (uses array index as key, fragile for dynamic lists).
**Fix:** Stabilize list keys with a content-based hash/slice; add `role="status"` to empty states.

### 2. Security (MEDIUM IMPACT)
**Issue:** `server/index.js` — the global error handler catches **all** errors (`if (err instanceof multer.MulterError || err)` — the `|| err` is always truthy, masking real 500s as 400s).
**Fix:** Scope it correctly to only `MulterError`.
**Issue:** Uploads are stored in `uploads/` permanently — no cleanup on successful parse.
**Fix:** Delete temp file after extraction in `documentService.js`.

### 3. Efficiency (MEDIUM IMPACT)  
**Issue:** `UploadPage.jsx` — calls `/index-document` sequentially before `/analyze`. They can run in parallel since they operate on the same `text`.
**Fix:** Use `Promise.all` for index + analyze.

### 4. Accessibility (LOW IMPACT)
**Issue:** `DashboardPage.jsx` — risk badges lack accessible color contrast labels (colour alone signals risk level).
**Fix:** Add `aria-label` / visually hidden text to each badge.
**Issue:** `ComparePage.jsx` — `UploadSlot` inputs have no visible label; the `<label>` wraps the input but no `id`/`htmlFor` association.
**Fix:** Add explicit `id` to the hidden `<input>` and `htmlFor` to the wrapping `<label>` (already wrapping, but add `aria-label` for screen-reader context).

### 5. Code Quality / Testing (MEDIUM IMPACT)
**Issue:** `server/__tests__/index.test.js` — missing tests for:
  - `/api/analyze` happy path
  - `/api/compare` validation (missing docA/docB)
  - `/api/ask` validation
  - `/api/index-document` validation
**Fix:** Add these test cases.
