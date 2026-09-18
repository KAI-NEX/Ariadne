"""Export web icons from the same reviewed Icon Composer document as the Mac App."""
from pathlib import Path
import struct
import subprocess

ROOT = Path(__file__).resolve().parents[1]
TOOL = Path('/Applications/Xcode.app/Contents/Applications/Icon Composer.app/Contents/Executables/ictool')

def build():
    output = ROOT / 'public/icons'
    output.mkdir(exist_ok=True)
    images = []
    for size in (16, 32, 48, 180):
        filename = 'apple-touch-icon.png' if size == 180 else f'favicon-{size}.png'
        target = output / filename
        subprocess.run([str(TOOL), str(ROOT / 'assets/desktop-icon/Ariadne.icon'), '--export-image',
                        '--output-file', str(target), '--platform', 'macOS', '--rendition', 'Default',
                        '--width', str(size), '--height', str(size), '--scale', '1'], check=True)
        if size != 180:
            images.append((size, target.read_bytes()))
    # ICO supports embedded PNG payloads; no additional image transformation.
    header = struct.pack('<HHH', 0, 1, len(images))
    offset = 6 + 16 * len(images)
    entries = []
    for size, png in images:
        entries.append(struct.pack('<BBBBHHII', size, size, 0, 0, 1, 32, len(png), offset))
        offset += len(png)
    (ROOT / 'public/favicon.ico').write_bytes(header + b''.join(entries) + b''.join(p for _, p in images))

if __name__ == '__main__':
    build()
