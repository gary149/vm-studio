# SEO Comparison Pages Skill

Create SEO-optimized comparison landing pages with proper indexing setup.

## Overview

This skill creates a system of comparison pages comparing N items (models, products, tools) with:
- Hub page listing all comparisons
- N×(N-1)/2 individual comparison pages
- Automated sitemap generation
- Google Search Console integration

## Architecture

```
website/
├── compare/
│   ├── index.html              # Hub page
│   ├── build-pages.js          # Generator script
│   ├── sitemap.xml             # Auto-generated
│   ├── {item-a}-vs-{item-b}/
│   │   └── index.html          # Generated comparison page
│   └── ...
├── robots.txt                  # Points to sitemap
└── styles.css                  # Shared styles
```

## Step 1: Define Items to Compare

In `build-pages.js`:

```javascript
const ITEMS = [
  {
    id: "item-slug",           // URL-safe identifier
    name: "Display Name",      // Human-readable name
    icon: "icon-class",        // Optional
    provider: "Provider Name", // Optional metadata
  },
];
```

## Step 2: Build Script Structure

See `website/compare/build-pages.js` for full implementation. Key functions:

```javascript
// Generate all unique pairs: N items → N×(N-1)/2 pairs
function generatePairs(items) { ... }

// Generate comparison page HTML with all SEO tags
function generateComparisonPage(itemA, itemB) { ... }

// Generate sitemap.xml
function generateSitemap(pairs) { ... }
```

Run: `node website/compare/build-pages.js`

## Step 3: Required SEO Tags

### Comparison Pages

```html
<head>
  <title>{Item A} vs {Item B} | Site Name</title>
  <meta name="description" content="Compare... (150-160 chars)">
  <link rel="canonical" href="https://domain.com/compare/a-vs-b/">

  <!-- Open Graph -->
  <meta property="og:title" content="...">
  <meta property="og:description" content="...">
  <meta property="og:url" content="...">
  <meta property="og:image" content="..." width="1200" height="630">

  <!-- Twitter -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:image" content="...">

  <!-- Schema: Article -->
  <script type="application/ld+json">
  {"@type": "Article", "headline": "...", "datePublished": "..."}
  </script>

  <!-- Schema: BreadcrumbList -->
  <script type="application/ld+json">
  {"@type": "BreadcrumbList", "itemListElement": [...]}
  </script>
</head>
```

### Hub Page

```html
<!-- Schema: CollectionPage + ItemList -->
<script type="application/ld+json">
{
  "@type": "CollectionPage",
  "mainEntity": {
    "@type": "ItemList",
    "itemListElement": [/* all comparison URLs */]
  }
}
</script>
```

## Step 4: robots.txt

```
User-agent: *
Allow: /

Sitemap: https://vmstudio.ai/compare/sitemap.xml
```

## Step 5: Internal Linking (Critical for Indexing)

1. **Homepage → Hub**: Navigation link to `/compare/`
2. **Hub → Comparisons**: Link to ALL comparison pages
3. **Comparisons → Hub**: Nav + breadcrumb links back

## Step 6: Google Search Console

### Submit Sitemap
1. GSC → Sitemaps → Add `https://domain.com/compare/sitemap.xml`
2. Verify status: "Success" + correct page count

### Request Indexing (speeds up crawling)
1. GSC → URL Inspection → paste URL
2. Click "Request Indexing"
3. Repeat for important pages

### Monitor Status
- GSC → Indexation → Pages
- "Discovered, not indexed" = normal for new pages, wait 1-4 weeks
- "No sitemap referent" = GSC lag, sitemap is processed separately

## Step 7: Performance Checklist

- [ ] First images: `fetchpriority="high"` (not lazy)
- [ ] Other images: `loading="lazy"`
- [ ] All images: `width` + `height` attributes
- [ ] Text contrast ≥ 4.5:1 (min `#767676` on dark)

## Timeline Expectations

| Stage | Duration |
|-------|----------|
| Sitemap processing | 1-3 days |
| Page discovery | 1-7 days |
| Full indexing | 1-4 weeks |

## Quick Checklist

1. [ ] Define ITEMS array in build-pages.js
2. [ ] Run `node website/compare/build-pages.js`
3. [ ] Verify hub page links to all comparisons
4. [ ] Verify robots.txt has sitemap URL
5. [ ] Add "/compare/" link to homepage nav
6. [ ] Deploy
7. [ ] Submit sitemap in GSC
8. [ ] Request indexing for hub page
9. [ ] Monitor indexing over 1-4 weeks
