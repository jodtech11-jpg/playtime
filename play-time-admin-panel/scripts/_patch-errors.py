from pathlib import Path

ROOT = Path(r"C:/Users/murug/Documents/Playtime/Playtime/play-time-admin-panel")

FILES = [
  "pages/Polls.tsx",
  "pages/QuickMatches.tsx",
  "pages/FlashDeals.tsx",
  "pages/Tournaments.tsx",
  "pages/Staff.tsx",
  "pages/Bookings.tsx",
  "pages/Leaderboards.tsx",
  "components/modals/QuickMatchFormModal.tsx",
  "components/modals/FlashDealFormModal.tsx",
  "components/modals/TournamentFormModal.tsx",
  "components/modals/StaffFormModal.tsx",
  "components/modals/TicketDetailModal.tsx",
  "components/modals/CourtFormModal.tsx",
  "components/modals/SportManagementModal.tsx",
  "components/modals/ArchiveModal.tsx",
  "components/modals/CourtManagementModal.tsx",
]

REPLACEMENTS = [
  ("'Failed to accept booking: ' + error.message", "'Failed to accept booking: ' + getFirebaseErrorMessage(error)"),
  ("'Failed to reject booking: ' + error.message", "'Failed to reject booking: ' + getFirebaseErrorMessage(error)"),
  ("'Failed to cancel booking: ' + error.message", "'Failed to cancel booking: ' + getFirebaseErrorMessage(error)"),
  ("'Failed to confirm some bookings: ' + error.message", "'Failed to confirm some bookings: ' + getFirebaseErrorMessage(error)"),
  ("'Failed to cancel some bookings: ' + error.message", "'Failed to cancel some bookings: ' + getFirebaseErrorMessage(error)"),
  ("'Failed to save poll: ' + error.message", "'Failed to save poll: ' + getFirebaseErrorMessage(error)"),
  ("'Failed to delete poll: ' + error.message", "'Failed to delete poll: ' + getFirebaseErrorMessage(error)"),
  ("'Failed to update status: ' + error.message", "'Failed to update status: ' + getFirebaseErrorMessage(error)"),
  ("'Failed to save quick match: ' + error.message", "'Failed to save quick match: ' + getFirebaseErrorMessage(error)"),
  ("'Failed to delete quick match: ' + error.message", "'Failed to delete quick match: ' + getFirebaseErrorMessage(error)"),
  ("'Failed to save flash deal: ' + error.message", "'Failed to save flash deal: ' + getFirebaseErrorMessage(error)"),
  ("'Failed to delete flash deal: ' + error.message", "'Failed to delete flash deal: ' + getFirebaseErrorMessage(error)"),
  ("'Failed to delete tournament: ' + error.message", "'Failed to delete tournament: ' + getFirebaseErrorMessage(error)"),
  ("'Failed to delete leaderboard: ' + error.message", "'Failed to delete leaderboard: ' + getFirebaseErrorMessage(error)"),
  ("'Failed to delete staff: ' + error.message", "'Failed to delete staff: ' + getFirebaseErrorMessage(error)"),
  ("'Failed to log expense: ' + error.message", "'Failed to log expense: ' + getFirebaseErrorMessage(error)"),
  ("'Failed to delete sport: ' + err.message", "'Failed to delete sport: ' + getFirebaseErrorMessage(err)"),
  ("'Failed to update sport: ' + err.message", "'Failed to update sport: ' + getFirebaseErrorMessage(err)"),
  ("'Failed to restore ticket: ' + error.message", "'Failed to restore ticket: ' + getFirebaseErrorMessage(error)"),
  ("'Failed to delete ticket: ' + error.message", "'Failed to delete ticket: ' + getFirebaseErrorMessage(error)"),
  ("'Failed to delete court: ' + error.message", "'Failed to delete court: ' + getFirebaseErrorMessage(error)"),
  ("err.message || 'Failed to save sport'", "getFirebaseErrorMessage(err) || 'Failed to save sport'"),
  ("err.message || 'Failed to save quick match'", "getFirebaseErrorMessage(err) || 'Failed to save quick match'"),
  ("err.message || 'Failed to save flash deal'", "getFirebaseErrorMessage(err) || 'Failed to save flash deal'"),
  ("err.message || 'Failed to save tournament'", "getFirebaseErrorMessage(err) || 'Failed to save tournament'"),
  ("err.message || 'Failed to save staff'", "getFirebaseErrorMessage(err) || 'Failed to save staff'"),
  ("err.message || 'Failed to add response'", "getFirebaseErrorMessage(err) || 'Failed to add response'"),
  ("err.message || 'Failed to update ticket'", "getFirebaseErrorMessage(err) || 'Failed to update ticket'"),
  ("err.message || 'Failed to save court'", "getFirebaseErrorMessage(err) || 'Failed to save court'"),
]

for rel in FILES:
  p = ROOT / rel
  text = p.read_text(encoding="utf-8")
  orig = text
  for a, b in REPLACEMENTS:
    text = text.replace(a, b)

  if "getFirebaseErrorMessage(" in text and "import { getFirebaseErrorMessage }" not in text:
    lines = text.splitlines(True)
    insert_at = 0
    for i, line in enumerate(lines):
      if line.startswith("import "):
        insert_at = i + 1
    if "components/modals/" in rel.replace("\\", "/"):
      imp = "import { getFirebaseErrorMessage } from '../../utils/errorUtils';\n"
    else:
      imp = "import { getFirebaseErrorMessage } from '../utils/errorUtils';\n"
    lines.insert(insert_at, imp)
    text = "".join(lines)

  if text != orig:
    p.write_text(text, encoding="utf-8")
    print("updated", rel)
  else:
    print("nochange", rel)
