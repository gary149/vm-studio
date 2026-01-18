# SEO Subpages Council Review Summary

## Overview

Five expert reviewers evaluated the proposed SEO subpages for VM Studio. This document summarizes their findings and recommendations.

---

## Review Scores by Page

| Page | SEO | Conversion | Brand | Avg |
|------|-----|------------|-------|-----|
| /text-to-image | 7/10 | 7/10 | 7/10 | **7.0** |
| /image-to-image | 7/10 | 7/10 | 7/10 | **7.0** |
| /models | 6/10 | 6/10 | 8/10 | **6.7** |
| /models/flux | 8/10 | 6/10 | 7/10 | **7.0** |
| /models/gpt-image | 7/10 | 6/10 | 7/10 | **6.7** |
| /models/nano-banana | 5/10 | 6/10 | 7/10 | **6.0** |
| /compare/flux-vs-midjourney | 8/10 | 5/10 | 6/10 | **6.3** |
| /use-cases/ui-ux-design | 7/10 | 8/10 | 7/10 | **7.3** |
| /use-cases/marketing | 6/10 | 8/10 | 6/10 | **6.7** |
| /guides/prompt-writing | 9/10 | 6/10 | 5/10 | **6.7** |
| /guides/getting-started | 8/10 | 6/10 | 7/10 | **7.0** |
| /pricing | 6/10 | 4/10 | 7/10 | **5.7** |

**Overall Average: 6.7/10**

---

## Critical Issues (Must Fix Before Launch)

### 1. Technical Accuracy Errors

**Homepage inconsistencies found:**
- Twitter card says "5 AI models" - should be 6
- Schema.org says "5 AI models" - should be 6
- FLUX.2 Turbo claims "4MP" but only supports 1K resolution
- Missing Google AI Studio provider for Nano Banana Pro

**Action:** Fix `index.html` before launching subpages.

### 2. Keyword Cannibalization Risk

Pages competing for same keywords:
- `/models/flux` vs `/compare/flux-vs-midjourney` for "FLUX vs Midjourney"
- `/text-to-image` vs `/guides/getting-started` for "generate images in Figma"

**Action:** Differentiate intent clearly. Model pages = features. Comparison pages = vs competitors.

### 3. Missing Figma-Specific Keywords

Current targets are too generic and competitive:
- "text to image AI" (extremely competitive)
- "AI image models comparison" (broad)

**Action:** Add "Figma" or "Figma plugin" modifier to all primary keywords.

### 4. Conversion Weak Points

- No above-fold CTAs on proposed pages
- BYOK model confusing for cold traffic
- Missing trust signals (install count, ratings, testimonials)
- Pricing page lacks cost comparison with alternatives

**Action:** Add hero CTAs, social proof banner, interactive pricing calculator.

---

## Top 10 Recommendations (Prioritized)

### High Priority

1. **Add Figma-specific modifiers to all keywords**
   - Change "text to image AI" → "text to image Figma plugin"
   - Reduces competition, increases relevance

2. **Fix homepage accuracy issues**
   - Update "5 AI models" to "6 AI models" everywhere
   - Verify FLUX.2 Turbo 4MP claim or remove it

3. **Add above-fold CTA to all pages**
   - Every page needs visible CTA without scrolling
   - Use contextual text: "Try [Feature] in Figma"

4. **Create interactive pricing calculator**
   - "Generate X images/month = $Y"
   - Compare with "That's $X less than Midjourney subscription"

5. **Add social proof banner**
   - Install count from Figma Community
   - Star rating
   - "Used by designers at [logos]"

### Medium Priority

6. **Restructure comparison pages**
   - Lead with VM Studio value, not competitor comparison
   - "Access FLUX in Figma" > "FLUX vs Midjourney detailed comparison"

7. **Reduce word counts by 40%**
   - Current targets (1,500-3,000) too long for brand voice
   - Target 800-1,200 words, use tables/visuals

8. **Standardize terminology**
   - Use "Image-to-Image" not "img2img" or "i2i"
   - Use "FLUX.2" not "FLUX AI"

9. **Remove "best" claims from titles**
   - "best AI image generator 2025" = arrogant
   - Use "AI image generators compared" instead

10. **Add quick-start path for impatient users**
    - "Ready to go? Install in 10 seconds" box
    - Appears early on every page

---

## Brand Voice Checklist

Before publishing any page, verify:

- [ ] Headlines under 8 words
- [ ] No sentence exceeds 20 words
- [ ] No "comprehensive," "detailed," "ultimate," "complete"
- [ ] Features described as benefits, not capabilities
- [ ] No competitors named in negative context
- [ ] BYOK model explained honestly
- [ ] No promises of features not yet built
- [ ] Tables preferred over paragraphs

---

## Content Files Created

All draft content saved to `/website/content/`:

```
content/
├── COUNCIL_REVIEW_SUMMARY.md (this file)
├── pages/
│   ├── text-to-image.md
│   ├── image-to-image.md
│   └── pricing.md
├── models/
│   ├── index.md (hub page)
│   ├── flux.md
│   ├── gpt-image.md
│   └── nano-banana.md
├── compare/
│   └── flux-vs-midjourney.md
├── use-cases/
│   ├── ui-ux-design.md
│   └── marketing.md
└── guides/
    ├── getting-started.md
    └── prompt-writing.md
```

---

## Next Steps

1. **Immediate:** Fix homepage accuracy issues
2. **Before launch:** Apply council recommendations to all draft content
3. **Implementation:** Create HTML pages from approved markdown
4. **Post-launch:** Monitor rankings, iterate based on performance

---

*Review completed: January 2026*
*Council: SEO Expert, Senior Copywriter, Technical Reviewer, UX/Conversion Specialist, Brand Strategist*
