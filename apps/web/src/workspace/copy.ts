/**
 * English copy for sign-in, onboarding, invites and the buyer / ops workspaces (B-05). Supplier-facing strings are
 * zh-CN first and live in @fbg/i18n. workspace-isolation.test.ts runs all of it through the public-claims guard:
 * no promises, no "verified", no counters — this is plain account and navigation text.
 */
export const AUTH_COPY = {
  productName: "Factory Bridge Global",
  notConfigured:
    "Sign-in is not configured in this environment yet. No account data can be entered here.",
  badCredentials: "Email or password is incorrect.",
  rateLimited: "Too many attempts. Wait a few minutes, then try again.",
  badCode: "That code is not valid or has expired. Request a new one.",
  codeSessionExpired: "Your sign-in code request has expired. Request a new code.",
  weakPassword: "Choose a longer, less common password.",
  signUpRefused:
    "We could not create an account with that email. If you already have one, sign in instead.",
  signInTitle: "Sign in",
  signInLead: "Use your password, or get a one-time code by email.",
  codeTitle: "Enter your code",
  codeLead:
    "If an account exists for that address, we sent it a 6-digit code. It expires after one hour.",
  signUpTitle: "Create an account",
  signUpLead:
    "Create a login first; you set up or join your organization next. Use a work email you can receive codes at.",
} as const;

export const ONBOARDING_COPY = {
  title: "Set up your organization",
  lead: "Create an organization to start a workspace, or open an invitation link from a teammate.",
  yourWorkspaces: "Your workspaces",
  createTitle: "Create an organization",
  buyerOption: "Buyer — sourcing products from manufacturers",
  supplierOption: "Supplier — manufacturer or trading company (供应商)",
  created: "Organization created.",
  failed: "We could not create the organization. Check the fields and try again.",
} as const;

export const INVITE_COPY = {
  title: "Join an organization",
  lead: "A teammate invited you to their Factory Bridge Global workspace.",
  signedOutBody:
    "Sign in, or create an account, with the email address the invitation was sent to. Then open this link again.",
  accept: "Accept invitation",
  invalid:
    "This invitation is not valid, has already been used, or has expired. Ask for a new one.",
  wrongEmail:
    "This invitation was issued to a different email address. Sign in with that address to accept it.",
  malformed: "This invitation link is incomplete. Copy the whole link and try again.",
} as const;

export const BUYER_COPY = {
  workspace: "Buyer workspace",
  overviewTitle: "Projects",
  overviewLead:
    "Your organization's sourcing projects. Only members of your organization can see them.",
  noProjectsTitle: "No projects yet",
  noProjectsBody: "Start a project with a short brief describing what you want to source.",
  readOnly: "You have view-only access in this organization.",
  newProject: "New project",
  newProjectLead:
    "Name the project and describe what you need. You can edit the brief while it is a draft.",
  projectName: "Project name",
  briefLabel: "Brief",
  briefHint:
    "Product, quantities, specification, packaging, target timing. Plain text; nothing is sent to suppliers.",
  saveBrief: "Save brief",
  briefSaved: "Brief saved.",
  briefLocked: "This brief is no longer a draft, so it can't be edited here.",
  createFailed: "We could not create the project. Check the fields and try again.",
  team: "Team",
  teamLead: "Members of your organization, their roles, and pending invitations.",
  invite: "Create invitation",
  inviteHint:
    "We do not send emails yet. Copy the link and send it to your teammate yourself. It works once, for that address, for 7 days.",
  inviteCreated: "Invitation link (shown once):",
  inviteFailed: "We could not create the invitation.",
  changeSaved: "Membership updated. That person must sign in again.",
  changeFailed: "We could not update that membership.",
} as const;

export const OPS_COPY = {
  workspace: "Operations",
  overviewTitle: "Projects you can access",
  overviewLead:
    "Buyer projects appear here only while you are assigned to them (compliance reviewers see all projects for hold review).",
  noProjectsTitle: "No assigned projects",
  noProjectsBody: "A platform admin assigns operators to buyer projects.",
  dataNotice:
    "Do not enter real buyer or supplier data in this workspace until the founder approves it.",
} as const;

/** Two-step sign-in (TOTP) for internal accounts (B-05b, ADR-043). */
export const MFA_COPY = {
  enrollTitle: "Set up two-step sign-in",
  enrollLead:
    "Internal accounts need an authenticator app before the operations workspace opens. You set this up once.",
  start: "Set up an authenticator app",
  scanStep:
    "1. Scan this QR code with an authenticator app (for example 1Password, Google Authenticator or Microsoft Authenticator), or type in the setup key.",
  qrAlt: "QR code for your authenticator app",
  secretLabel: "Setup key",
  confirmStep: "2. Enter the 6-digit code the app shows now.",
  confirm: "Confirm and continue",
  verifyTitle: "Two-step sign-in",
  verifyLead:
    "Enter the 6-digit code from your authenticator app to open the operations workspace.",
  verify: "Continue",
  codeLabel: "6-digit code",
  badCode:
    "That code did not match. Check that your device's clock is set automatically, then enter the current code.",
  rateLimited: "Too many attempts. Wait a minute, then try again.",
  startFailed: "We could not start the setup. Reload the page and try again.",
  lostDevice:
    "Lost your authenticator app? Ask the founder to reset two-step sign-in for your account, then set it up again.",
  signOut: "Sign out",
} as const;

/** Internal staff provisioning for platform admins (B-05b, ADR-043 §4). */
export const STAFF_COPY = {
  nav: "Staff",
  title: "Internal staff",
  lead: "Operators and compliance reviewers. Each person sets up two-step sign-in before the operations workspace opens for them.",
  members: "Staff members",
  inviteTitle: "Invite a staff member",
  invite: "Create staff invitation",
  inviteHint:
    "We do not send emails yet. Copy the link and send it to the person yourself. It works once, for that address, for 72 hours.",
  inviteCreated: "Staff invitation link (shown once):",
  inviteFailed: "We could not create the staff invitation.",
  alreadyStaff: "That address already belongs to an active staff member.",
  pending: "Pending staff invitations",
  noPending: "No pending staff invitations.",
  changeSaved: "Staff membership updated. That person must sign in again.",
  changeFailed: "We could not update that staff membership.",
  adminRow: "Platform admin roles change only through the bootstrap runbook.",
} as const;
