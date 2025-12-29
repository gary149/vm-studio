# VM Studio

AI-powered image generation plugin for Figma. Generate images directly in your design workflow using multiple AI providers.

## Features

### Image Generation
- **Text-to-Image**: Generate images from natural language prompts
- **Image-to-Image**: Transform selected Figma frames/images using AI (editing mode)
- **Batch Generation**: Generate multiple images at once with smart grid placement

### Supported Providers & Models

| Provider | Model | Text-to-Image | Image-to-Image | Max Resolution |
|----------|-------|:-------------:|:--------------:|:--------------:|
| Fal.ai | Nano Banana Pro | Yes | Yes | 4K |
| Fal.ai | Z-Image Turbo | Yes | No | 4K |
| Fal.ai | Seedream v4 | Yes | Yes | 4K |
| Fal.ai | GPT-Image 1.5 | Yes | Yes | 1K |
| Google AI | Gemini 2.0 Flash | Yes | Yes | 4K |
| OpenRouter | Gemini 2.0 Flash | Yes | Yes | 4K |

### Aspect Ratios
- **Square**: 1:1, 5:4
- **Landscape**: 4:3, 3:2, 16:9, 21:9
- **Portrait**: 3:4, 2:3, 9:16, 4:5
- **Auto**: Model default

### Resolution Options
- **1K** (1024px)
- **2K** (2048px)
- **4K** (4096px)

### Smart Positioning
- **Collision Avoidance**: Images never overlap existing Figma objects
- **Grid Layout**: Up to 12 columns with automatic row wrapping
- **Adaptive Placement**: Places images to the right of selection or at viewport center
- **Canvas Bounds**: Stays within Figma's canvas limits

### UI Features
- **Prompt History**: Navigate previous prompts with arrow keys
- **Keyboard Shortcuts**: Cmd/Ctrl+Enter to generate
- **Selection Thumbnails**: Preview selected input images for editing mode
- **Progress Tracking**: Real-time generation status
- **API Key Management**: Secure storage per provider

## Installation

### Prerequisites
- [Node.js](https://nodejs.org) v22+
- [Figma desktop app](https://figma.com/downloads/)

### Build
```bash
npm install
npm run build
```

### Development
```bash
npm run watch
```

### Load in Figma
1. Open Figma desktop app
2. Run `Import plugin from manifest...` via Quick Actions (Cmd/Ctrl+/)
3. Select the generated `manifest.json`

## Usage

### Setup
1. **Get API Keys** from one or more providers:
   - [Fal.ai](https://fal.ai/dashboard/keys)
   - [Google AI Studio](https://aistudio.google.com/apikey)
   - [OpenRouter](https://openrouter.ai/keys)

2. **Configure**: Go to Settings tab and enter your API key(s)

### Text-to-Image Generation
1. Enter a prompt describing the image you want
2. Select model, aspect ratio, and size
3. Set the number of images to generate (1+)
4. Click Generate or press Cmd/Ctrl+Enter

### Batch Generation
Generate multiple images at once:
- Set "Images" count to any number (1, 2, 5, 10, etc.)
- All images generate in parallel
- Placeholders appear immediately showing where images will be placed
- Images are arranged in a grid (up to 12 columns)
- Smart positioning avoids overlapping existing objects

### Editing Mode (Image-to-Image)
Transform existing images or frames using AI:
1. Select one or more frames/images in Figma
2. The prompt label shows "Prompt (editing mode)"
3. Thumbnails of selected images appear below the prompt
4. Enter a prompt describing how to transform the images
5. Generate - new images are placed next to the selection

Note: Some models don't support image-to-image. A warning appears if the selected model is incompatible.

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| Cmd/Ctrl + Enter | Generate images |
| Arrow Up | Previous prompt from history |
| Arrow Down | Next prompt from history |

## Development

Built with [Create Figma Plugin](https://yuanqing.github.io/create-figma-plugin/).

### Project Structure
```
src/
├── main.ts          # Figma sandbox code
├── ui.tsx           # Plugin UI
├── positioning.ts   # Image placement logic
├── providers/       # API integrations
│   ├── fal.ts
│   ├── gemini.ts
│   └── openrouter.ts
├── components/      # UI components
└── types/           # TypeScript types
```

## License

MIT
