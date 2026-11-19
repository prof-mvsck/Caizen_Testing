"""Build dist/site-logistics.html, a single offline file, from src/.

    python build.py

src/index.html is the template. Its markers are replaced as follows:
    {{inline:<file>}}   the file's text (styles, symbol libraries, app.js)
    {{text:<file>}}     the same, for text/plain blocks (the licences)
    {{base64:<file>}}   the file's bytes as base64, for PDF.js and its two WebAssembly decoders
    {{worker:<file>}}   the PDF.js worker, patched to run as a classic script (see WORKER_PATCHES), as base64
    {{build_stamp}}     the build date and the PDF.js file hashes

The vendor files are the unmodified pdfjs-dist@5.4.624 legacy build (build/pdf.min.mjs, build/pdf.worker.min.mjs,
wasm/openjpeg.wasm, wasm/jbig2.wasm). VENDOR_SHA256 pins them, so a swapped or corrupted file stops the build.
"""
import base64
import datetime
import hashlib
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent
SRC = ROOT / 'src'
OUT = ROOT / 'dist' / 'site-logistics.html'

VENDOR_SHA256 = {
    'vendor/pdf.min.mjs': '246b088f414359637e6403753a1e815caa4bd20e9c645be4b5ef4c89f405aafa',
    'vendor/pdf.worker.min.mjs': '88b29a656ecf0b104c2ef1b620be099c523be2a57f27fbb8a42bdac6b8c9a4c0',
    'vendor/openjpeg.wasm': '67b8e2b162da472e98cb48d3d32e3e38fff481b9b32ff4818e78bb248af88ab2',
    'vendor/jbig2.wasm': 'df85117444f0f0150c5c9d0dd8eeab102d705217f838a9f6d46788b6d9b3d681',
    # image decoders for formats Chrome and Edge do not read: utif@3.1.0 + pako@1.0.11 (TIFF),
    # jxl-oxide-wasm@0.12.6 (JPEG XL), libheif-js@1.23.5 libheif-wasm/ (HEIC), all unmodified npm files
    'vendor/utif.js': 'e3e76115f49571e39624c3316a76b3c4c5b2c5ca518dfec4b66a9f7af8c6d059',
    'vendor/pako_inflate.min.js': '2ca27e9a8dae569cdeac42752ed1aed1afeff7f19282d3cc12c0aaa54a08bc04',
    'vendor/jxl_oxide_wasm.js': 'd9a314abc55d167e94e2d995ce6ab5276f86ef9de41f06df11fef3acf55ff6b7',
    'vendor/jxl_oxide_wasm_bg.wasm': '3336f3abd4a04fccc437e7a84f12d4b63c12f302044110867f99be14c4c75a69',
    'vendor/libheif.js': '376c0bb483c23ac458cd22d718074693748ea75eddc3e4929353d4153e365a2e',
    'vendor/libheif.wasm': '184d3d20f8323877f13e9f5254f9c6a0ce272c9a3a2f823b0b2bcd2ee9f73f80',
    # text labels' lettering: Flux Architect Bold (orange modern, freeware), unmodified from dafont.com/flux-architect.font
    'vendor/FluxArchitect-Bold.ttf': '505424d37e39c064c60951ad2bca20e19d10393e4040d2aa40a5ad72149eaf41',
}

# The worker ships as an ES module. A blob: URL can only start a module worker where the page itself is allowed to,
# and opened from disk (file://) that fails, so the worker runs as a classic script: its two import.meta.url uses
# become self.location.href and its closing export goes. Each patch must match exactly once.
WORKER_PATCHES = [
    ('r=import.meta.url', 'r=self.location.href'),
    ('a=import.meta.url', 'a=self.location.href'),
    ('export{WorkerMessageHandler};', ''),
]


def read_bytes(rel):
    data = (SRC / rel).read_bytes()
    want = VENDOR_SHA256.get(rel)
    if want and hashlib.sha256(data).hexdigest() != want:
        sys.exit(f'{rel} does not match its pinned vendor file; refusing to build.')
    return data


def b64(data):
    s = base64.b64encode(data).decode('ascii')
    return '\n'.join(s[i:i + 120] for i in range(0, len(s), 120))


def script_safe(text, rel):
    if re.search(r'</script', text, re.I):
        sys.exit(f'{rel} contains "</script", which would end its <script> block early.')
    return text.rstrip('\n')


def patched_worker(rel):
    text = read_bytes(rel).decode('utf-8')
    for old, new in WORKER_PATCHES:
        n = text.count(old)
        if n != 1:
            sys.exit(f'worker patch {old!r} matched {n} times (expected 1); the PDF.js version has changed.')
        text = text.replace(old, new)
    return b64(text.encode('utf-8'))


def main():
    tpl = (SRC / 'index.html').read_text(encoding='utf-8')
    stamp = datetime.date.today().isoformat() + ', PDF.js 5.4.624 legacy'

    def sub(m):
        kind, arg = m.group(1), m.group(2)
        if kind == 'build_stamp':
            return stamp
        if kind in ('inline', 'text'):
            return script_safe((SRC / arg).read_text(encoding='utf-8'), arg)
        if kind == 'base64':
            return b64(read_bytes(arg))
        if kind == 'worker':
            return patched_worker(arg)
        sys.exit(f'unknown marker {m.group(0)}')

    html = re.sub(r'\{\{(\w+)(?::([^}]+))?\}\}', sub, tpl)
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(html, encoding='utf-8', newline='\n')
    print(f'wrote {OUT.relative_to(ROOT)} ({OUT.stat().st_size / 1e6:.2f} MB)')


if __name__ == '__main__':
    main()
