# Setup Guide - Isometric 3D Viewer

This guide will walk you through setting up the project, uploading it to GitHub, and publishing it to NPM.

## Prerequisites

- Node.js (v14 or higher)
- Git
- GitHub account
- NPM account (for publishing)

## Local Development Setup

### 1. Install Dependencies

```bash
cd /Users/erwin/GitHub/isometric-3d-viewer
npm install
```

### 2. Build the Project

```bash
npm run build
```

This will create minified files in the `dist/` directory:
- `isometric-3d.min.js` - Main viewer module
- `scroll-sync.min.js` - Scroll synchronization module

### 3. Test Locally

```bash
npm run serve
```

Open `http://localhost:8080/examples/` in your browser to test the example.

## GitHub Setup

### 1. Create GitHub Repository

1. Go to [GitHub](https://github.com) and create a new repository
2. Name it: `isometric-3d-viewer`
3. Don't initialize with README (we already have one)
4. Make it public (for NPM publishing)

### 2. Update package.json

Replace `YOUR_USERNAME` in `package.json` with your actual GitHub username:

```json
{
  "repository": {
    "type": "git",
    "url": "git+https://github.com/YOUR_USERNAME/isometric-3d-viewer.git"
  },
  "bugs": {
    "url": "https://github.com/YOUR_USERNAME/isometric-3d-viewer/issues"
  },
  "homepage": "https://github.com/YOUR_USERNAME/isometric-3d-viewer#readme"
}
```

### 3. Initialize Git and Push

```bash
cd /Users/erwin/GitHub/isometric-3d-viewer

# Initialize git repository
git init

# Add all files
git add .

# Create initial commit
git commit -m "Initial release v1.0.0 - Isometric 3D Viewer

Features:
- Interactive 3D isometric perspective rendering
- Keyboard and mouse navigation with smooth transitions
- SVG connector system with intelligent routing
- Multi-key highlighting with auto-dimming
- Scroll synchronization for storytelling
- Programmatic navigation API
- Pure CSS/JavaScript (no dependencies)"

# Add remote repository (replace YOUR_USERNAME)
git remote add origin https://github.com/YOUR_USERNAME/isometric-3d-viewer.git

# Push to GitHub
git branch -M main
git push -u origin main
```

### 4. Create Release Tag

```bash
# Tag the release
git tag -a v1.0.0 -m "Release version 1.0.0"

# Push the tag
git push origin v1.0.0
```

## NPM Publishing

### 1. Login to NPM

```bash
npm login
```

Enter your NPM credentials.

### 2. Update Author in package.json

Edit `package.json` and add your details:

```json
{
  "author": "Your Name <your.email@example.com>",
  "keywords": [
    "isometric",
    "3d",
    "visualization",
    "navigation",
    "viewer",
    "css3d",
    "interactive",
    "connectors",
    "highlighting"
  ]
}
```

### 3. Publish to NPM

```bash
npm publish
```

Your package will be available at: `https://www.npmjs.com/package/isometric-3d-viewer`

Users can install it with:
```bash
npm install isometric-3d-viewer
```

## Post-Publishing

### Update CHANGELOG.md

Replace the date placeholder in `CHANGELOG.md`:
```markdown
## [1.0.0] - 2024-01-XX
```
with the actual release date.

### GitHub Release

1. Go to your GitHub repository
2. Click "Releases" → "Create a new release"
3. Choose tag `v1.0.0`
4. Title: "Release v1.0.0 - Isometric 3D Viewer"
5. Copy the changelog content
6. Publish release

## Maintenance

### Making Changes

```bash
# Create feature branch
git checkout -b feature/your-feature

# Make changes, commit
git add .
git commit -m "Add your feature"

# Push branch
git push origin feature/your-feature

# Create pull request on GitHub
```

### Publishing Updates

1. Update version in `package.json` (follow semver)
2. Update `CHANGELOG.md` with changes
3. Commit changes
4. Create git tag: `git tag -a v1.1.0 -m "Version 1.1.0"`
5. Push: `git push && git push --tags`
6. Publish: `npm publish`

## Troubleshooting

### Build Errors

```bash
# Clean install
rm -rf node_modules package-lock.json
npm install
npm run build
```

### NPM Publish Errors

- **Name taken**: Choose a different package name (e.g., `@yourname/isometric-3d-viewer`)
- **Not logged in**: Run `npm login` first
- **Version exists**: Increment version in `package.json`

## Support

For issues or questions:
- Open an issue on GitHub
- Check existing issues first
- Provide detailed reproduction steps

---

**Ready to go!** Follow the steps above to get your package on GitHub and NPM.
