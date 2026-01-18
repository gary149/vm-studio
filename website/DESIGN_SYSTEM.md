# VM Studio Design System Specification

## Overview
This document defines the exact design language for all VM Studio subpages. All pages must follow these specifications exactly to ensure visual consistency.

---

## Layout Structure

### Split Layout (Desktop)
```html
<div class="split-layout">
    <aside class="left-panel">
        <!-- Sticky sidebar with nav -->
    </aside>
    <main class="right-panel">
        <!-- Scrollable content -->
    </main>
</div>
```

- **Left Panel**: 40% width, max 480px, min 320px, sticky, full viewport height
- **Right Panel**: Flex 1, scrollable, background #080808
- **Max container width**: 1265px, centered

### Left Panel Components
1. **Logo** (always present):
```html
<header class="header-content">
    <a href="/" class="logo">
        <img src="../assets/logo.svg" alt="VM Studio Logo">
        <span>VM Studio</span>
    </a>
</header>
```

2. **Page Title Section** (page-specific):
```html
<div class="hero-text-content">
    <div class="badge">[Badge Text]</div>
    <h1 class="hero-title">[Page Title]</h1>
    <p class="hero-subtitle">[Subtitle]</p>
    <div class="hero-actions">
        <a href="https://www.figma.com/community/plugin/1588675833256652136"
           target="_blank" class="btn btn-primary btn-lg">
            [Figma icon SVG]
            Add to Figma
        </a>
    </div>
    <nav class="nav-links">
        <!-- Page-specific navigation -->
    </nav>
</div>
```

3. **Footer** (always present):
```html
<footer class="footer-content">
    <div class="footer-left">
        <span class="copyright">© 2026 VM Studio</span>
    </div>
    <div class="footer-right">
        <a href="https://www.figma.com/community/plugin/1588675833256652136" target="_blank">Figma Community</a>
    </div>
</footer>
```

---

## Right Panel Sections

### Section Header Pattern
```html
<section id="[section-id]" class="features">
    <div class="container">
        <div class="section-header">
            <h2>[Section Title]</h2>
            <p>[Section subtitle]</p>
        </div>
        <!-- Section content -->
    </div>
</section>
```

### Section Padding
- All sections: `padding: 80px 48px`
- Border bottom: `1px solid var(--border-subtle)`

---

## Component Patterns

### Bento Grid (Features)
```html
<div class="bento-grid">
    <div class="bento-card card-large">  <!-- spans 2 columns -->
        <div class="card-content">
            <div class="icon-box">[SVG icon]</div>
            <h3>[Title]</h3>
            <p>[Description]</p>
        </div>
    </div>
    <div class="bento-card">  <!-- single column -->
        <!-- ... -->
    </div>
</div>
```

### Data Table
```html
<div class="models-table">
    <div class="table-header">
        <span>[Col 1]</span>
        <span>[Col 2]</span>
        <span class="align-right">[Col 3]</span>
    </div>
    <div class="table-row">
        <div class="col-model">
            <div class="model-info">
                [SVG icon]
                <div>
                    <span class="model-name">[Name]</span>
                    <span class="model-desc">[Description]</span>
                </div>
            </div>
        </div>
        <div class="col-caps">
            <span class="tag">[Tag]</span>
        </div>
        <div class="col-provider align-right">
            <a href="[url]" target="_blank">[Link]</a>
        </div>
    </div>
</div>
```

### FAQ Grid
```html
<div class="faq-grid">
    <div class="faq-item">
        <h3>[Question]</h3>
        <div class="faq-content">
            <p>[Answer]</p>
        </div>
    </div>
</div>
```

### CTA Section
```html
<section class="cta">
    <div class="container">
        <div class="cta-card">
            <h2>[CTA Headline]</h2>
            <p>[CTA subtext]</p>
            <a href="https://www.figma.com/community/plugin/1588675833256652136"
               target="_blank" class="btn btn-primary btn-lg">
                [Figma icon SVG]
                Add to Figma
            </a>
        </div>
    </div>
</section>
```

---

## CSS Variables (Required)

```css
--bg-body: #050505;
--bg-surface: #0A0A0A;
--bg-surface-hover: #121212;
--border-subtle: rgba(255, 255, 255, 0.08);
--border-strong: rgba(255, 255, 255, 0.15);
--text-primary: #EDEDED;
--text-secondary: #888888;
--text-tertiary: #555555;
--accent: #FFFFFF;
```

---

## Typography

- **Font**: Inter (Google Fonts)
- **Hero Title**: 48px, font-weight 600, letter-spacing -0.03em
- **Section Headers**: 28px, font-weight 600, letter-spacing -0.02em
- **Card Titles**: 16px, font-weight 500
- **Body Text**: 14-16px, font-weight 400
- **Small Text/Tags**: 10-12px

---

## Figma Button SVG Icon
```html
<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M5 5.5A3.5 3.5 0 0 1 8.5 2H12v7H8.5A3.5 3.5 0 0 1 5 5.5z"></path>
    <path d="M12 2h3.5a3.5 3.5 0 1 1 0 7H12V2z"></path>
    <path d="M12 12.5a3.5 3.5 0 1 1 7 0 3.5 3.5 0 1 1-7 0z"></path>
    <path d="M5 19.5A3.5 3.5 0 0 1 8.5 16H12v3.5a3.5 3.5 0 1 1-7 0z"></path>
    <path d="M5 12.5A3.5 3.5 0 0 1 8.5 9H12v7H8.5A3.5 3.5 0 0 1 5 12.5z"></path>
</svg>
```

---

## Asset Paths for Subpages

From `/website/models/flux.html`:
- CSS: `../styles.css`
- Logo: `../assets/logo.svg`
- Favicon: `../assets/favicon.png`

---

## Required HTML Head
```html
<!DOCTYPE html>
<html lang="en" class="dark">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">

    <!-- SEO Meta Tags -->
    <title>[Page Title] | VM Studio</title>
    <meta name="description" content="[Meta description]">
    <meta name="robots" content="index, follow">
    <link rel="canonical" href="https://vmstudio.ai/[path]/">

    <!-- Open Graph -->
    <meta property="og:type" content="website">
    <meta property="og:title" content="[OG Title] | VM Studio">
    <meta property="og:description" content="[OG description]">
    <meta property="og:image" content="https://vmstudio.ai/assets/vm-studio.png">
    <meta property="og:url" content="https://vmstudio.ai/[path]/">

    <!-- Twitter Card -->
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="[Twitter title] | VM Studio">
    <meta name="twitter:description" content="[Twitter description]">
    <meta name="twitter:image" content="https://vmstudio.ai/assets/vm-studio.png">

    <!-- Favicon -->
    <link rel="icon" type="image/png" href="[relative-path]/assets/favicon.png">
    <link rel="apple-touch-icon" href="[relative-path]/assets/apple-touch-icon.png">

    <!-- Fonts -->
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&display=swap" rel="stylesheet">

    <link rel="stylesheet" href="[relative-path]/styles.css">
</head>
```

---

## File Organization

```
website/
├── index.html              # Homepage
├── styles.css              # Shared styles
├── assets/                 # Shared assets
├── models/
│   ├── index.html          # Models hub
│   ├── flux.html
│   ├── gpt-image.html
│   └── nano-banana.html
├── guides/
│   ├── getting-started.html
│   └── prompt-writing.html
├── use-cases/
│   ├── ui-ux-design.html
│   └── marketing.html
└── pricing.html
```
