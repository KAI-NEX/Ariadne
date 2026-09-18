# Ariadne sharing assets

- `cover.html`: editable 1280×640 composition using the existing VI tokens, the released hand logo (`public/icons/apple-touch-icon.png`), and an actual app screenshot.
- `workspace-empty.png`: captured in Ego Lite from a fresh isolated local workspace on 2026-09-19. No real personal materials, credentials, or generated model answers are present.
- `../../public/social/ariadne-preview.png`: browser-rendered final cover, used by GitHub Social preview, the README, and the website's Open Graph/Twitter card metadata. No video is included.

To reproduce the cover, serve the repository root, open `assets/social/cover.html` at 1280×640 with device scale factor 1, wait for images/fonts, and capture the viewport. Retain earlier evidence when replacing an export. The template uses the project font fallback chain; this export used the available system sans-serif fonts.

The descriptions and first-session walkthrough live in the English and Chinese README files. GitHub About links to `https://ariadne.kai-nex.com/`. Website cards describe the product and available download; they do not include user workspace content.
