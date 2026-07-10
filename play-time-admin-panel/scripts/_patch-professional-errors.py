"""Replace raw err.message / error.message user-facing strings with getFirebaseErrorMessage."""
from pathlib import Path
import re

ROOT = Path(r"C:/Users/murug/Documents/Playtime/Playtime/play-time-admin-panel")

# Skip the util itself and low-level services that rethrow for internal use
SKIP = {
  "utils/errorUtils.ts",
  "services/firebase.ts",
  "services/whatsappService.ts",
  "services/razorpayService.ts",
}

# Patterns: (regex, replacement template using \1 etc where needed)
# We do simple string replacements that are common across the codebase.

SIMPLE = [
  # setError(err.message || '...')
  (r"setError\(err\.message \|\| ('[^']*')\)", r"setError(getFirebaseErrorMessage(err, \1))"),
  (r"setError\(error\.message \|\| ('[^']*')\)", r"setError(getFirebaseErrorMessage(error, \1))"),
  (r"setError\(err\?\.message \|\| ('[^']*')\)", r"setError(getFirebaseErrorMessage(err, \1))"),
  (r"setError\(err\.message\)", r"setError(getFirebaseErrorMessage(err))"),
  (r"setError\(err\?\.message \?\? ('[^']*')\)", r"setError(getFirebaseErrorMessage(err, \1))"),
  # setError(subscribeError.message || '...')
  (r"setError\(subscribeError\.message \|\| ('[^']*')\)", r"setError(getFirebaseErrorMessage(subscribeError, \1))"),
  # throw new Error(err.message || '...')
  (r"throw new Error\(err\.message \|\| ('[^']*')\)", r"throw new Error(getFirebaseErrorMessage(err, \1))"),
  (r"throw new Error\(error\.message \|\| ('[^']*')\)", r"throw new Error(getFirebaseErrorMessage(error, \1))"),
  # const errorMessage / message =
  (r"const errorMessage = error\.message \|\| ('[^']*')", r"const errorMessage = getFirebaseErrorMessage(error, \1)"),
  (r"const message = err\.message \|\| ('[^']*')", r"const message = getFirebaseErrorMessage(err, \1)"),
  # showError with optional chaining leftovers
  (r"showError\('Failed to save: ' \+ \(err\?\.message \|\| 'Unknown error'\)\)",
   r"showError('Failed to save: ' + getFirebaseErrorMessage(err, 'Unknown error'))"),
  (r"showError\('Failed to delete: ' \+ \(err\?\.message \|\| 'Unknown error'\)\)",
   r"showError('Failed to delete: ' + getFirebaseErrorMessage(err, 'Unknown error'))"),
  (r"showError\('Failed to export CSV: ' \+ \(e\?\.message \|\| 'Unknown error'\)\)",
   r"showError('Failed to export CSV: ' + getFirebaseErrorMessage(e, 'Unknown error'))"),
  (r"showError\('Sync failed: ' \+ \(err\?\.message \|\| err\)\)",
   r"showError('Sync failed: ' + getFirebaseErrorMessage(err))"),
  # ImageUpload
  (r"showError\(`Failed to load \$\{file\.name\}: \$\{error\.message\}`\)",
   r"showError(`Failed to load ${file.name}: ${getFirebaseErrorMessage(error)}`)"),
  (r"showError\(`Failed to upload \$\{file\.name\}: \$\{error\.message \|\| 'Unknown error'\}`\)",
   r"showError(`Failed to upload ${file.name}: ${getFirebaseErrorMessage(error, 'Unknown error')}`)"),
  # invoiceService
  (r"throw new Error\('Failed to generate invoice PDF: ' \+ error\.message\)",
   r"throw new Error('Failed to generate invoice PDF: ' + getFirebaseErrorMessage(error))"),
]

def import_path(rel: str) -> str:
  rel = rel.replace("\\", "/")
  depth = rel.count("/")
  if depth == 0:
    return "./utils/errorUtils"
  return "../" * depth + "utils/errorUtils"

def ensure_import(text: str, rel: str) -> str:
  if "getFirebaseErrorMessage" not in text:
    return text
  if re.search(r"import\s*\{[^}]*getFirebaseErrorMessage[^}]*\}\s*from", text):
    return text
  # Already imports from errorUtils — add to existing import
  m = re.search(r"import\s*\{([^}]+)\}\s*from\s*['\"]([^'\"]*errorUtils)['\"]", text)
  if m:
    names = m.group(1)
    if "getFirebaseErrorMessage" not in names:
      new_names = names.rstrip() + ", getFirebaseErrorMessage"
      text = text[:m.start(1)] + new_names + text[m.end(1):]
    return text
  imp = f"import {{ getFirebaseErrorMessage }} from '{import_path(rel)}';\n"
  lines = text.splitlines(True)
  insert_at = 0
  for i, line in enumerate(lines):
    if line.startswith("import "):
      insert_at = i + 1
  lines.insert(insert_at, imp)
  return "".join(lines)

updated = []
for path in list(ROOT.rglob("*.ts")) + list(ROOT.rglob("*.tsx")):
  rel = str(path.relative_to(ROOT)).replace("\\", "/")
  if rel in SKIP:
    continue
  if "node_modules" in rel or "dist" in rel or "scripts/" in rel:
    continue
  text = path.read_text(encoding="utf-8")
  orig = text
  for pattern, repl in SIMPLE:
    text = re.sub(pattern, repl, text)
  if text != orig:
    text = ensure_import(text, rel)
    path.write_text(text, encoding="utf-8")
    updated.append(rel)

print(f"updated {len(updated)} files")
for u in updated:
  print(" ", u)
