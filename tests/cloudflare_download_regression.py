"""Keep the published download through page-only releases and validate replacements."""
import hashlib
import json
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts'))
import build_cloudflare_release as release


class DownloadTests(unittest.TestCase):
    def test_published_release_survives_without_local_build_artifacts(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            manifest = root / 'deploy/cloudflare/local-download.json'
            manifest.parent.mkdir(parents=True)
            metadata = {'url': 'https://github.com/KAI-NEX/Ariadne/releases/download/local-20260918/Ariadne-Local-macOS-arm64-20260918-104410.zip', 'bytes': 123, 'sha256': 'a' * 64}
            with patch.object(release, 'ROOT', root):
                self.assertEqual(release.download_metadata(), {'available': False})
                manifest.write_text(json.dumps(metadata))
                self.assertEqual(release.download_metadata(), metadata)
                for changes in ({'url': 'https://untrusted.invalid/package.zip'}, {'sha256': 'bad'}, {'bytes': -1}, {'bytes': True}):
                    manifest.write_text(json.dumps({**metadata, **changes}))
                    with self.assertRaises(ValueError):
                        release.download_metadata()

    def test_replacement_requires_exact_local_bytes_and_filename(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            downloads = root / 'public/downloads'
            downloads.mkdir(parents=True)
            name = 'Ariadne-Local-macOS-arm64-20260918-104410.zip'
            archive = downloads / name
            archive.write_bytes(b'synthetic archive')
            metadata = {'url': '/downloads/' + name, 'bytes': archive.stat().st_size, 'sha256': hashlib.sha256(archive.read_bytes()).hexdigest()}
            (downloads / 'latest.json').write_text(json.dumps(metadata))
            url = 'https://github.com/KAI-NEX/Ariadne/releases/download/local-20260918/' + name
            with patch.object(release, 'ROOT', root):
                self.assertEqual(release.download_metadata(url), {**metadata, 'url': url})
                with self.assertRaises(ValueError):
                    release.download_metadata(url.replace('104410', '104411'))
                archive.write_bytes(b'changed archive')
                with self.assertRaises(ValueError):
                    release.download_metadata(url)


if __name__ == '__main__':
    unittest.main()
