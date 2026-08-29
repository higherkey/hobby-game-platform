# The "Grounded Wisdom" Universal AI Design System Rules (v2)

This reference document defines a set of mathematically, physiologically, and psychologically validated guidelines for modern front-end design, layout architecture, and user interaction. 

It functions as a framework-agnostic system prompt and ruleset. You can drop this markdown file directly into your repository (e.g., as `.cursor/rules/design-system.mdc`, `CLAUDE.md`, `.cursorrules`, or as part of your system prompt) to force any coding or layout agent to generate exceptionally distinct, high-performance, and high-fidelity interfaces.

***

## 1. Perceptually Uniform Colors & APCA Contrast Standards

Legacy sRGB models (HEX, RGB, and HSL) are not perceptually uniform. In HSL, two colors with identical lightness values can exhibit drastically different perceived brightness levels (e.g., pure yellow is perceived as significantly brighter than pure blue). This mathematical discrepancy causes unpredictable contrast ratios and inaccessible states.

All colors, themes, hover animations, and interaction layers must be declared exclusively within the **OKLCH color space**.

### 1.1 OKLCH Color Tokens & Hover Rules
Define central design tokens using the CSS `oklch(L C H)` function, where `L` represents Perceived Lightness (0% to 100%), `C` represents Chroma (color purity/vibrancy, 0.0 to 0.4), and `H` represents Hue angle (0 to 360).
*   **Programmatic Hover Calculations:** Interactive states must be derived programmatically by modifying Lightness to preserve perceptual safety and guarantee consistent contrast.

```css
:root {
  /* System Base Canvas Tokens */
  --color-canvas-base: oklch(98% 0.01 85);       /* Warm off-white */
  --color-canvas-surface: oklch(95% 0.015 85);    /* Slightly darker layered elements */
  --color-ink-primary: oklch(18% 0.02 240);       /* Low-lightness dark slate text */
  --color-ink-muted: oklch(45% 0.03 240);         /* Medium-lightness slate muted text */

  /* Focus Accent and CTA Tokens */
  --color-brand-primary: oklch(58% 0.22 28);      /* Rich accent */
  --color-brand-success: oklch(62% 0.17 145);     /* High-trust green */
  
  /* Programmatic Hover Formulas */
  --color-brand-primary-hover: oklch(calc(58% - 8%) 0.22 28);
  --color-brand-success-hover: oklch(calc(62% - 8%) 0.17 145);
}
```

### 1.2 Contrast Enforcement via the Advanced Perceptual Contrast Algorithm (APCA)
Replace legacy contrast ratio models with the APCA to evaluate readability based on font weight, font size, background luminance, and foreground luminance. The interface must strictly assert the following minimum lightness contrast (Lc) targets:
1.  **Lc >= 75 (Standard Body Copy):** Mandatory threshold for standard reading text (14px to 18px, normal weight).
2.  **Lc >= 60 (Sub-Headings):** Mandatory threshold for smaller bold text, labels, and captions.
3.  **Lc >= 45 (Large Display Text):** Minimum contrast for bold display headers and titles (24px and larger).
4.  **Lc >= 15 (Decorative Borders and Outlines):** Minimum contrast for layout borders, input field borders, and divider lines.

***

## 2. Programmatic Typography & Viewport Fluidity

To maximize readability and visual authority, reject standard default system font sets (such as Inter or Roboto) which represent the visual signature of uncurated automated templates.

### 2.1 The Line-Length Constraint (Butterick's Rule)
Excessively wide text blocks fatigue the eye during horizontal tracking and cause scanning errors when moving back to the start of the next line.
*   **Programmatic Bound:** Standard body copy paragraphs must remain strictly constrained within **45 to 75 characters per line** (including spaces).
*   **CSS Implementation:** Use the `max-inline-size` CSS property set with `ch` (character width) units to enforce the measure dynamically:
    ```css
    article p, 
    section p.lead-copy {
      max-inline-size: 65ch; /* Locks text blocks to the ideal visual measure */
    }
    ```

### 2.2 Typographic Geometry
*   **Line Spacing (Leading):** Body copy line-height must sit between **120% and 145%** (1.2 to 1.45) of the active point size. Headings require tighter line spacing, set between **100% and 110%** (1.0 to 1.1) to maintain structural density.
*   **Paragraph Spacing:** Space between paragraphs must correspond to **1.0 to 1.5 times the active line spacing** of the text. Do not simulate spacing with double-carriage returns (`<br><br>`); use CSS margins instead:
    ```css
    p + p {
      margin-block-start: 1.25em; /* Intentional paragraph gap */
    }
    ```
*   **Typographical Columns:** On wide display screens (viewports exceeding 1000px), body copy must never stretch to full width. Bind text blocks inside multi-column layouts or constrain them to a central, high-readability column.

### 2.3 Fluid Responsive Scales without Breakpoint Jumps
To eliminate visual jarring, reject media-query "breakpoint step jumps" for text sizes, margins, and padding. All typographic scaling must use viewport-relative mathematical `clamp()` functions to ensure perfectly fluid scaling:
```css
h1 {
  /* Scales smoothly from 2.0rem (32px) on mobile up to 4.0rem (64px) on wide desktop screens */
  font-size: clamp(2.0rem, 1.5rem + 2.5vw, 4.0rem);
}

p {
  /* Scales body copy fluidly from 1.0rem (16px) to 1.125rem (18px) */
  font-size: clamp(1.0rem, 0.95rem + 0.25vw, 1.125rem);
}
```

***

## 3. Gestalt Organization & Grouping Heuristics

To establish immediate cognitive ease and facilitate rapid visual processing, layouts must respect pre-attentive grouping before a user consciously reads any copywriting text.

### 3.1 Proximity & Grouping (Law of Proximity)
*   **Sibling Spacing:** Sibling elements within a card or functional group (such as a heading and its body copy) must maintain a tight spatial margin (maximum **8px to 12px**).
*   **Grouping Gaps:** Separate containers or unrelated blocks must be separated by a spatial gap at least **3.5 times** larger than the sibling margin (minimum **28px to 42px**). Inconsistent spacing boundaries disrupt natural scanning, triggering visual fatigue.

### 3.2 Depth Cues & Figure-Ground Separation
Users must instantly distinguish between active interactive components (the Figure) and the underlying background canvas (the Ground).
*   **Subtle Bevel Outlines:** Containers must feature an extremely subtle, solid border outline (maximum **1px** width) styled in a slightly lighter OKLCH lightness token than the background canvas.
*   **Consistent Light-Angle Sourcing:** Enforce a single, consistent light source coming from the top-left (a 135-degree angle).
*   **Tactile 8px Grid Spacing:** Banish hyper-rounded pill buttons (`border-radius: 9999px`) across standard interactive triggers. All buttons, input boxes, and card components must use tactile, geometrically consistent radii (e.g., `4px`, `6px`, or `8px`) aligned to a strict **8px spatial grid**.
*   **Crisp Offset Shadows (Zero-Blur UI):** All primary buttons and high-fidelity interactive elements must feature hard offset solid drop shadows without blur (e.g., `box-shadow: 4px 4px 0px var(--color-ink-primary)`), providing clear tactile indicators of interactivity while preserving modern performance.
*   **No Glassmorphism:** Standardize solid, high-trust backgrounds using concrete OKLCH tokens. Avoid semi-transparent card panels and `backdrop-filter: blur()`.

***

## 4. Visual Search Dynamics & Attention Tracking

To optimize the placement of high-intent conversion elements (such as call-to-action buttons, forms, and value propositions), align layout compositions with documented human scanning paths.

### 4.1 Eye-Gaze Scans & Grid Layout Hierarchy
*   **Top-Left Orientation Anchor:** Users begin scanning interfaces with a dense cluster of gaze fixations focused on the top-left quadrant of the screen. Primary navigation headers and brand identity (logos) must reside strictly in this region.
*   **The Gutenberg Z-Pattern:** For low-density, content-light landing pages, structure the layout to follow a diagonal sweep from top-left to top-right, down to bottom-left, and finally terminating at the bottom-right call-to-action.
*   **The Nielsen F-Pattern:** For text-heavy, informational interfaces, gaze fixations focus heavily across the top horizontal row and then scan vertically down the left margin. Place high-salience keyword anchors within the **first 2 to 3 words** of a horizontal line to capture attention before the eye regresses.
*   **Contrast Density Control:** Restrict highly saturated accent colors to a **single, high-intent call-to-action (CTA) per viewport** to prevent gaze scattering and attention dilution.

### 4.2 Age-Appropriate Ergonomics & Density Calibrations
*   **Information Block Ceiling:** Limit the number of functional information blocks per screen viewport to a maximum of **4 (low visual complexity)**. Avoid vertical stacks of multi-style content which elevate extraneous cognitive load.
*   **Left-to-Right Sibling Alignment:** Structure parent layouts using left-text/right-image or left-image/right-text alignments rather than dense, multi-column grid meshes.
*   **Keyword Saliency Highlights:** In complex or dense copy blocks, apply high-contrast, warm color highlights (e.g., a tinted red/amber highlight in light mode) to primary keywords. This visual anchor reduces search time, stabilizes pupil dilation, and reduces subjective cognitive effort.

***

## 5. Mobile Touch Target Sizing & Ergonomics

Operating touchscreen layouts introduces distinct error thresholds due to human hand physiology, device-holding postures, and capacitive touch mechanics.

### 5.1 Biomechanical Viewport Zoning (The Thumb Zone)
For the critical one-handed grip (which dominates 49% of interactions), the mobile screen is mapped into three distinct ergonomic zones:
1.  **The Green Zone (Natural Reach):** Spans the bottom-center and middle-center portions of the screen (lower 40% to 50% of the viewport). Primary calls-to-action (CTAs), tab navigation bars, and critical checkout buttons must reside here.
2.  **The Yellow Zone (Stretch Zone):** Occupies the mid-screen sides and upper-middle regions. Reaching these targets requires physical extension of the thumb.
3.  **The Red Zone (Awkward Reach):** Encompasses the top 20% of the screen. Reaching these targets requires a complete hand grip shift.

### 5.2 Physical Touch Target Sizing & Spacing Limits
Platform guidelines and biomechanical touch models dictate minimum bounding boxes for touch targets to maintain a low error profile:
*   **Google Material / Google Touch Standard:** $48 \times 48\text{ px}$ with $8\text{ px}$ minimum buffer zone.
*   **Apple iOS HIG:** $44 \times 44\text{ pt}$ with $1\text{ px}$ minimum spacing.
*   **The Bayesian Touch Criterion (BTC):** In capacitive finger-touch environments, the actual physical dispersion of touch points (Effective Width) is twice the visual nominal target width for small buttons. When targets are sized below **4.8mm (~48px)**, touch selection error rates spike to 29%.
*   **Minimum Target Size:** Enforce a minimum interactive hit target of **44px to 48px** for all primary controls.
*   **The Overlap Constraint:** Adjacent buttons must never be nested closer than **4.8mm (~48px)**. If adjacent buttons are nested closer, their touch area boundaries will overlap, causing accidental activations.
*   **Awkward Margin Clearance:** To prevent catastrophic errors from ballistic thumb sweeps, high-impact, destructive interactive targets (such as "Delete", "Reset", or "Submit Purchase") must feature a minimum non-interactive clearance margin of **40 pixels** from standard navigation pathways.

***

## 6. High-Performance Motion & CSS Animations

Animating layouts directly blocks the browser's main thread and forces continuous recalculations, causing visual jank and degrading Interaction to Next Paint (INP) metrics.

### 6.1 The Compositor Thread Constraint
All visual transitions must target compositor-only properties to run fluidly on the GPU compositor thread:
*   **Permitted Animatable Properties:** `transform` (utilizing `translate()`, `scale()`, `rotate()`, and `skew()`) and `opacity`.
*   **Strict Prohibitions:** Animating geometric properties that affect document layout flow—such as `height`, `width`, `top`, `left`, `bottom`, `right`, `margin`, `padding`, `flex-grow`, or `border-width`—is strictly prohibited.
*   **will-change Management:** Apply the `will-change: transform, opacity;` property to force permanent GPU layer isolation only on primary animating containers (such as sliding panels or modals). Do not apply globally, as excessive layer creation exhausts device VRAM.

### 6.2 Figma-to-CSS Bézier Parameter Mapping
All transitions must use normalized parametric cubic Bézier timing curves. Map velocity targets to the following CSS coordinate definitions:

| Presets | CSS Declaration | Primary Use Case |
| :--- | :--- | :--- |
| **Ease-Out** | `transition-timing-function: cubic-bezier(0, 0, 0.32, 1);` | **Entering Elements.** Starts instantly to feel responsive, then slows. |
| **Ease-In** | `transition-timing-function: cubic-bezier(0.42, 0, 1, 1);` | **Exiting Elements.** Starts slowly and accelerates as it leaves the viewport. |
| **Ease-In-Out** | `transition-timing-function: cubic-bezier(0.42, 0, 0.58, 1);` | **Cyclical Interactions.** Symmetrical acceleration and deceleration. |
| **Ease-Out Back** | `transition-timing-function: cubic-bezier(0.34, 1.56, 0.64, 1);` | **Tactile Settle.** Over-shoots the final value slightly before settling. |

### 6.3 Micro-Interaction Duration Guidelines
*   **Simple State Feedback (80ms - 120ms):** Checkbox checkmarks, hover highlights, and toggle switches. (100ms is the absolute human physiological limit for an interaction to feel instantaneous).
*   **Localized Menu Adjustments (180ms - 260ms):** Dropdown menu transitions, tooltip reveals, and inline details container expansions.
*   **Large Structural Shifts (260ms - 320ms):** Viewport-centering modal windows, sliding sidebar drawers, and card expansions.
*   **Sequential Sibling Stagger:** When displaying lists or grids, reveal elements in a sequential stagger cascading from left to right. Limit the stagger delay between consecutive elements to a tight **20ms to 25ms** to prevent layout delays.

***

## 7. High-Converting Form Architecture & Geometry

Friction during form completion is the single largest leak in a user funnel. Follow these rigid structural constraints:

### 7.1 Single-Column Sizing & Geometry
*   **Single-Column Layout:** Organize all input fields in a single, vertical column. Multi-column forms disrupt the natural vertical visual scanning path, causing confusion.
*   **Combined Names:** All forms must utilize a single "Full Name" input field unless API constraints mandate separate name keys.
*   **Collapsed Auxiliary Inputs:** Collapse non-mandatory fields (such as "Address Line 2") behind a text link, expanding only upon user click to prevent vertical screen clutter.
*   **Mobile Keyboard Compensation:** When any input field gains focus, shift the viewport to maintain at least **60px of clearance padding** between the top of the input and the viewport ceiling, keeping the typing cursor fully visible.

### 7.2 Programmatic Address Sync & Population
*   **Auto-Sync Default:** Forms must default to "Billing address is the same as shipping address" using a pre-checked input box, concealing the billing fields until unchecked.
*   **ZIP-Code Autodetection:** Upon the blur event of the postal code input, execute an asynchronous API lookup to autodetect and pre-populate City and State fields, bypassing manual typing.

### 7.3 Real-Time Inline Validation timing
*   **Blur Event Timing:** Validation for standard text inputs (Name, Email, Phone, Addresses) must execute exclusively **On-Blur** (after the cursor has fully exited the input). Flagging errors in real time while a user is actively typing is highly hostile and drives form abandonment.
*   **Password Complexity:** Real-time feedback meters must be debounced by **300ms** to prevent thread-thrashing, styled as soft progressive status states rather than errors.
*   **Credit Cards:** Credit card fields must perform local Luhn-algorithm validation in real-time as the user types, auto-detecting card brand and displaying its logo inline.

### 7.4 Form Accessibility & Error Text (WCAG 3.3.1 & 4.1.2)
*   **Specific, Named Labels:** Banish generic "This field is required" error messages. Naming the specific field and declaring the fix in plain language (e.g., "Enter a valid 10-digit phone number").
*   **ARIA Live Region Integration:** All form validation container tags must specify `aria-live="polite"` and be linked to inputs via `aria-describedby` so screen readers instantly announce errors.
*   **Colorblind Safety:** Never rely solely on a red border to denote validation failure. Accompany errors with explicit explanatory text and high-contrast warning icons.

***

## 8. Robust Edge Security & Thread-Safe Local State

To secure applications from client-side attacks, main-thread bottlenecks, and data loss, enforce strict security containment and asynchronous local state management.

### 8.1 Zero-CDN Asset Hosting
*   **Local Bundling Only:** Loading stylesheets, fonts, icons, or interactive scripts from public CDNs is strictly prohibited. All assets must be bundled, compiled, and served locally from the application’s directory to eliminate supply-chain vulnerabilities.

### 8.2 Declarative Security Headers
Enforce a strict Content Security Policy (CSP). Banish inline scripts unless accompanied by a cryptographic SHA-256 hash matching the exact block content. Banish all frame nesting via `X-Frame-Options: DENY` to block Clickjacking vectors.

### 8.3 Asynchronous Offline-First Storage Subsystems
Enforcing synchronous storage writes on active, data-intensive transactions blocks the browser's main thread, causing visual jank and driving INP scores past the 200ms accessibility limit.
*   **Synchronous Storage Cap (<100KB):** Standard synchronous storage APIs (`localStorage`, `sessionStorage`) are strictly banned for transactional databases, user document history, or state logs. Restrict usage exclusively to lightweight, non-sensitive preference indicators (such as a 1-character dark/light theme token) under **100KB** in size.
*   **Thread-Safe Storage Standard:** All dynamic user interactions, offline queueing, local draft histories, and collaborative documents must write database operations to an asynchronous storage engine: **IndexedDB** or an embedded **SQLite-WASM** engine.
*   **Worker Offloading:** Heavy data transformations, file parsing, and cryptographic operations must be offloaded from the main UI thread into a dedicated **Web Worker**, communicating via asynchronous structured clone message passing (`postMessage`).

### 8.4 Client-Side Cryptographic Hardening (Web Crypto API)
To protect user drafts and transaction histories in shared-device or multi-tenant desktop environments, local storage must use client-side, zero-knowledge encryption using the browser's native Web Crypto API.
*   **Encryption Algorithm:** Standardize on **AES-GCM (Galois/Counter Mode) with 256-bit key length** to guarantee both confidentiality and integrity.
*   **Key Derivation:** Derive keys locally from a user-provided passphrase using **PBKDF2** with **SHA-256**, executing exactly **600,000 iterations** to defend against brute-force attacks.
*   **Unique Salts and IVs:** Generate a unique, random **16-byte salt** for the key derivation, and a unique, random **12-byte Initialization Vector (IV)** using `crypto.getRandomValues()` for every encryption task, never reusing them.
