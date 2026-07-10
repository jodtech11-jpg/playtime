from pathlib import Path

ROOT = Path(r"C:/Users/murug/Documents/Playtime/Playtime/play-time-admin-panel")

FILES = [
  "pages/Support.tsx",
  "pages/Memberships.tsx",
  "pages/Payments.tsx",
  "pages/CourtManagement.tsx",
  "pages/CRM.tsx",
  "pages/Venues.tsx",
  "pages/VenueDetail.tsx",
  "pages/Users.tsx",
  "pages/UserDetail.tsx",
  "pages/Notifications.tsx",
  "pages/Settings.tsx",
  "pages/Marketplace.tsx",
  "pages/Moderation.tsx",
  "pages/RoleManagement.tsx",
  "pages/PermissionManagement.tsx",
  "pages/Financials.tsx",
  "components/modals/CreateInvoiceModal.tsx",
  "components/modals/MembershipPlanFormModal.tsx",
  "components/modals/VenueFormModal.tsx",
  "components/modals/SettlementConfirmationModal.tsx",
  "components/modals/CategoryManagementModal.tsx",
  "components/modals/LandingPageManagementModal.tsx",
  "components/modals/IntegrationConfigModal.tsx",
  "components/modals/OrderDetailsModal.tsx",
  "components/modals/TeamRegistrationModal.tsx",
  "components/modals/MatchManagementModal.tsx",
  "components/modals/CreateProductModal.tsx",
  "components/modals/CreateCampaignModal.tsx",
  "components/modals/UserFormModal.tsx",
  "components/modals/HelpCenterDocsModal.tsx",
]

# Generic patterns applied after specific ones
REPLACEMENTS = [
  ("showError('Failed to resolve ticket: ' + error.message)", "showError('Failed to resolve ticket: ' + getFirebaseErrorMessage(error))"),
  ("showError('Failed to delete plan: ' + error.message)", "showError('Failed to delete plan: ' + getFirebaseErrorMessage(error))"),
  ("showError('Failed to activate membership: ' + error.message)", "showError('Failed to activate membership: ' + getFirebaseErrorMessage(error))"),
  ("showError('Failed to cancel membership: ' + error.message)", "showError('Failed to cancel membership: ' + getFirebaseErrorMessage(error))"),
  ("showError('Failed to delete membership: ' + error.message)", "showError('Failed to delete membership: ' + getFirebaseErrorMessage(error))"),
  ("showError('Failed to extend membership: ' + error.message)", "showError('Failed to extend membership: ' + getFirebaseErrorMessage(error))"),
  ("showError('Failed to confirm settlement: ' + error.message)", "showError('Failed to confirm settlement: ' + getFirebaseErrorMessage(error))"),
  ("showError('Failed to delete court: ' + error.message)", "showError('Failed to delete court: ' + getFirebaseErrorMessage(error))"),
  ("showError('Failed to approve venue: ' + error.message)", "showError('Failed to approve venue: ' + getFirebaseErrorMessage(error))"),
  ("showError('Failed to reject venue: ' + error.message)", "showError('Failed to reject venue: ' + getFirebaseErrorMessage(error))"),
  ("showError('Failed to delete venue: ' + error.message)", "showError('Failed to delete venue: ' + getFirebaseErrorMessage(error))"),
  ("showError(`Failed to save venue: ${err.message}`)", "showError(`Failed to save venue: ${getFirebaseErrorMessage(err)}`)"),
  ("showError(`Failed to delete user: ${err.message}`)", "showError(`Failed to delete user: ${getFirebaseErrorMessage(err)}`)"),
  ("showError(`Failed to update user status: ${err.message}`)", "showError(`Failed to update user status: ${getFirebaseErrorMessage(err)}`)"),
  ("showError(`Failed to save user: ${err.message}`)", "showError(`Failed to save user: ${getFirebaseErrorMessage(err)}`)"),
  ("showError('Failed to delete notification: ' + error.message)", "showError('Failed to delete notification: ' + getFirebaseErrorMessage(error))"),
  ("showError('Failed to update notification: ' + error.message)", "showError('Failed to update notification: ' + getFirebaseErrorMessage(error))"),
  ("showError('Failed to save settings: ' + error.message)", "showError('Failed to save settings: ' + getFirebaseErrorMessage(error))"),
  ("showError('Failed to update integration: ' + error.message)", "showError('Failed to update integration: ' + getFirebaseErrorMessage(error))"),
  ("showError('Failed to upload logo: ' + error.message)", "showError('Failed to upload logo: ' + getFirebaseErrorMessage(error))"),
  ("showError('Failed to delete product: ' + error.message)", "showError('Failed to delete product: ' + getFirebaseErrorMessage(error))"),
  ("showError('Failed to delete products: ' + error.message)", "showError('Failed to delete products: ' + getFirebaseErrorMessage(error))"),
  ("showError('Failed to update products: ' + error.message)", "showError('Failed to update products: ' + getFirebaseErrorMessage(error))"),
  ("showError('Failed to remove post: ' + error.message)", "showError('Failed to remove post: ' + getFirebaseErrorMessage(error))"),
  ("showError('Failed to ban user: ' + error.message)", "showError('Failed to ban user: ' + getFirebaseErrorMessage(error))"),
  ("showError('Failed to dismiss report: ' + error.message)", "showError('Failed to dismiss report: ' + getFirebaseErrorMessage(error))"),
  ("showError('Failed to approve post: ' + error.message)", "showError('Failed to approve post: ' + getFirebaseErrorMessage(error))"),
  ("showError('Failed to reject post: ' + error.message)", "showError('Failed to reject post: ' + getFirebaseErrorMessage(error))"),
  ("showError(`Failed to save role: ${err.message}`)", "showError(`Failed to save role: ${getFirebaseErrorMessage(err)}`)"),
  ("showError(`Failed to delete role: ${err.message}`)", "showError(`Failed to delete role: ${getFirebaseErrorMessage(err)}`)"),
  ("showError(`Failed to save permission: ${err.message}`)", "showError(`Failed to save permission: ${getFirebaseErrorMessage(err)}`)"),
  ("showError(`Failed to delete permission: ${err.message}`)", "showError(`Failed to delete permission: ${getFirebaseErrorMessage(err)}`)"),
  ("showError('Failed to delete category: ' + err.message)", "showError('Failed to delete category: ' + getFirebaseErrorMessage(err))"),
  ("showError('Failed to update category: ' + err.message)", "showError('Failed to update category: ' + getFirebaseErrorMessage(err))"),
  ("showError('Failed to save: ' + error.message)", "showError('Failed to save: ' + getFirebaseErrorMessage(error))"),
  ("showError('Failed to save configuration: ' + error.message)", "showError('Failed to save configuration: ' + getFirebaseErrorMessage(error))"),
  ("setTestResult({ success: false, message: 'Connection test failed: ' + error.message })", "setTestResult({ success: false, message: 'Connection test failed: ' + getFirebaseErrorMessage(error) })"),
  ("setSettlementError(err.message || 'Failed to execute settlement. Please try again.')", "setSettlementError(getFirebaseErrorMessage(err) || 'Failed to execute settlement. Please try again.')"),
  ("setError(err.message || 'Failed to generate PDF')", "setError(getFirebaseErrorMessage(err) || 'Failed to generate PDF')"),
  ("setError(err.message || 'Failed to save membership plan')", "setError(getFirebaseErrorMessage(err) || 'Failed to save membership plan')"),
  ("setError(err.message || 'Failed to save venue')", "setError(getFirebaseErrorMessage(err) || 'Failed to save venue')"),
  ("setError(err.message || 'Failed to confirm payment')", "setError(getFirebaseErrorMessage(err) || 'Failed to confirm payment')"),
  ("setError(err.message || 'Failed to save category')", "setError(getFirebaseErrorMessage(err) || 'Failed to save category')"),
  ("setError(err.message || 'Failed to update order status')", "setError(getFirebaseErrorMessage(err) || 'Failed to update order status')"),
  ("setError(err.message || 'Failed to update payment status')", "setError(getFirebaseErrorMessage(err) || 'Failed to update payment status')"),
  ("setError(err.message || 'Failed to save tracking information')", "setError(getFirebaseErrorMessage(err) || 'Failed to save tracking information')"),
  ("setError(err.message || 'Failed to save notes')", "setError(getFirebaseErrorMessage(err) || 'Failed to save notes')"),
  ("setError(err.message || 'Failed to process refund')", "setError(getFirebaseErrorMessage(err) || 'Failed to process refund')"),
  ("setError(err.message || 'Failed to save team')", "setError(getFirebaseErrorMessage(err) || 'Failed to save team')"),
  ("setError(err.message || 'Failed to delete team')", "setError(getFirebaseErrorMessage(err) || 'Failed to delete team')"),
  ("setError(err.message || 'Failed to save match')", "setError(getFirebaseErrorMessage(err) || 'Failed to save match')"),
  ("setError(err.message || 'Failed to delete match')", "setError(getFirebaseErrorMessage(err) || 'Failed to delete match')"),
  ("setError(err.message || 'Failed to create product')", "setError(getFirebaseErrorMessage(err) || 'Failed to create product')"),
  ("setError(err.message || 'Failed to create campaign')", "setError(getFirebaseErrorMessage(err) || 'Failed to create campaign')"),
  ("setError(err.message || 'Failed to save user')", "setError(getFirebaseErrorMessage(err) || 'Failed to save user')"),
  ("setError(err.message || 'Failed to save document')", "setError(getFirebaseErrorMessage(err) || 'Failed to save document')"),
  ("setError(err.message || 'Failed to delete document')", "setError(getFirebaseErrorMessage(err) || 'Failed to delete document')"),
  ("const message = err.message || 'Failed to save user'", "const message = getFirebaseErrorMessage(err) || 'Failed to save user'"),
  ("const message = err.message || 'Failed to send login invite'", "const message = getFirebaseErrorMessage(err) || 'Failed to send login invite'"),
]

for rel in FILES:
  p = ROOT / rel
  if not p.exists():
    print("missing", rel)
    continue
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
