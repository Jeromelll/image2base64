from pathlib import Path
import shutil

ROOT = Path(__file__).parent
OUT = ROOT / "dist"
AUTH = ROOT / "site-auth"
EXTENSIONS = {".html", ".css", ".js", ".png", ".svg", ".ico", ".webmanifest", ".xml", ".txt"}

if OUT.exists():
    shutil.rmtree(OUT)
OUT.mkdir(parents=True)
for path in ROOT.iterdir():
    if path.is_file() and path.name != "worker.js" and (path.suffix in EXTENSIONS or path.name == "_redirects"):
        shutil.copy2(path, OUT / path.name)
for name in ("login.html", "login.css", "login.js"):
    shutil.copy2(AUTH / name, OUT / name)
(OUT / "assets").mkdir(exist_ok=True)
for name in ("login.css", "login.js"):
    shutil.copy2(AUTH / name, OUT / "assets" / name)
login_html = (OUT / "login.html").read_text(encoding="utf-8")
assert '<link rel="stylesheet" href="/assets/login.css">' in login_html
assert '<script type="module" src="/assets/login.js"></script>' in login_html
assert (OUT / "assets" / "login.css").is_file()
assert (OUT / "assets" / "login.js").is_file()
for path in (OUT / "assets").rglob("*"):
    assert path.is_file() and path.suffix in {".css", ".js"}
assert not any((OUT / name).exists() for name in ("worker.js", "site-auth", "functions", "wrangler.toml", "wrangler.jsonc", ".dev.vars", ".env"))
assert not any(
    path.name in {"tests", "handler.js", "oauth.js", ".dev.vars", ".env"}
    or path.name.endswith(".test.mjs")
    for path in OUT.rglob("*")
)
# Bing IndexNow key must be a public root asset, body = key only.
INDEXNOW_KEY = "90f183e7c09545009a6183a505313600"
indexnow = (OUT / f"{INDEXNOW_KEY}.txt").read_text(encoding="utf-8")
assert indexnow in {INDEXNOW_KEY, INDEXNOW_KEY + "\n"}
print(f"Built {len(list(OUT.iterdir()))} public assets")
