# AI Coding & Design Standards — No "Vibe Coding" Allowed

You are building production-quality software, not a demo. Before writing any code, and before marking any task complete, follow these rules strictly.

## 1. Design Consistency
- Use a single defined design system: consistent spacing scale (e.g. 4/8/16/24/32px), consistent font sizes, consistent color palette (define primary, secondary, neutral, success, error, warning colors up front).
- Reuse components — never hand-roll a slightly different button/card/input on every page.
- Do NOT default to generic purple-blue gradients, glassmorphism, or glowing blobs unless explicitly requested. Choose a deliberate, project-specific aesthetic.
- Match padding/margins between sections so the page feels cohesive, not stitched together.

## 2. Copy & Content
- Never use filler AI-sounding copy ("Unlock Your Potential," "Revolutionize Your Workflow," "Seamless Experience").
- Write specific, concrete copy tied to what the product actually does.
- No lorem ipsum or placeholder text in final delivery — use realistic sample content.

## 3. Real Functionality Over Mockups
- Every button, link, and form must actually work or be clearly marked as a stub with a TODO comment.
- Forms must validate input and show real error messages.
- Do not fake data persistence — connect to a real backend/database or clearly state what's mocked and why.
- Implement real authentication logic if auth is part of the scope, not a placeholder "Login" button.

## 4. States & Edge Cases
- Every data-driven view must handle: loading state, empty state, error state, and success state — not just the "happy path."
- Handle network failures and slow connections gracefully.
- Validate and sanitize all user input.

## 5. Animations & Effects
- Animations must serve a purpose (feedback, guidance, hierarchy) — not decoration for its own sake.
- Avoid animating every element on scroll/hover by default.

## 6. Accessibility
- All images need meaningful alt text.
- Maintain sufficient color contrast (WCAG AA minimum).
- All interactive elements must be keyboard-navigable and use semantic HTML (button, nav, header, main, etc.), not divs with click handlers.

## 7. Responsiveness
- Test and confirm layouts at mobile, tablet, and desktop breakpoints — don't assume desktop-first design will "just work."
- No horizontal scroll, overlapping elements, or cut-off text on small screens.

## 8. Code Quality
- No leftover console errors, warnings, or unused imports before calling a task done.
- No dead code, commented-out blocks, or unused variables in final output.
- Prefer clear, typed, documented code over clever one-liners.

## 9. Performance & SEO
- Optimize/lazy-load images; avoid shipping unnecessarily large assets.
- Include proper meta tags (title, description) and a favicon — not framework defaults.
- Avoid bloated dependencies for simple tasks.

## 10. Before You Say "Done"
Before presenting any output as complete, verify:
- [ ] Does every interactive element actually function?
- [ ] Are loading/empty/error states handled?
- [ ] Is the design consistent across all pages/components?
- [ ] Is the copy specific and non-generic?
- [ ] Does it work on mobile?
- [ ] Are there console errors?
- [ ] Is accessibility covered (alt text, contrast, semantic HTML)?

If any answer is "no," the task is not finished — fix it before delivering.
