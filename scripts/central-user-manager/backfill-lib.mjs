import { createHash } from "node:crypto";

const PROJECT_REF_PATTERN = /^[a-z0-9]{20}$/;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PROFILE_PROJECTION = "user_id,email";
const DEFAULT_AUTH_PAGE_SIZE = 1_000;
const DEFAULT_AUTH_MAX_PAGES = 100;
const INVALID_ARGUMENTS = "Invalid backfill arguments.";
const INVALID_CONFIGURATION = "Backfill configuration is invalid.";

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeEmail(value) {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  return normalized && EMAIL_PATTERN.test(normalized) ? normalized : null;
}

function isCanonicalUuid(value) {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

function isSafeMetadata(value) {
  if (!isRecord(value)) {
    return false;
  }

  if (
    Object.hasOwn(value, "bpv_admin_managed") &&
    typeof value.bpv_admin_managed !== "boolean"
  ) {
    return false;
  }

  return (
    !Object.hasOwn(value, "bpv_created_operation_id") ||
    isCanonicalUuid(value.bpv_created_operation_id)
  );
}

function readExistingVersion(metadata) {
  if (!Object.hasOwn(metadata, "credential_version")) {
    return { kind: "legacy" };
  }

  return Number.isSafeInteger(metadata.credential_version) &&
    metadata.credential_version === 1
    ? { kind: "exact" }
    : { kind: "unsafe" };
}

function defaultHashUid(uid) {
  return createHash("sha256").update(uid).digest("hex").slice(0, 12);
}

function addIssue(issues, seen, category, uid, hashUid) {
  const uidRef = hashUid(uid);
  const key = `${category}:${uidRef}`;

  if (!seen.has(key)) {
    seen.add(key);
    issues.push({ category, uidRef });
  }
}

function duplicateValues(rows, key) {
  const counts = new Map();

  for (const row of rows) {
    const value = row[key];
    if (value === null) {
      continue;
    }
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }

  return new Set(
    [...counts.entries()]
      .filter(([, count]) => count > 1)
      .map(([value]) => value),
  );
}

export function buildBackfillPreflight(
  profileRows,
  authRows,
  { hashUid = defaultHashUid } = {},
) {
  const issues = [];
  const seenIssues = new Set();
  const profiles = [];
  const authUsers = [];
  const profileIdentities = [];
  const authIdentities = [];

  for (const [index, row] of profileRows.entries()) {
    const rawUserId = isRecord(row) ? row.user_id : null;
    const userId = isCanonicalUuid(rawUserId) ? rawUserId : null;
    const email = isRecord(row) ? normalizeEmail(row.email) : null;
    profileIdentities.push({
      userId,
      email,
      reference:
        typeof rawUserId === "string" ? rawUserId : `profile-${index}`,
    });
    if (!userId || !email) {
      addIssue(
        issues,
        seenIssues,
        "malformed_profile",
        typeof rawUserId === "string" ? rawUserId : `profile-${index}`,
        hashUid,
      );
      continue;
    }
    profiles.push({ userId, email });
  }

  for (const [index, row] of authRows.entries()) {
    const rawUserId = isRecord(row) ? row.id : null;
    const userId = isCanonicalUuid(rawUserId) ? rawUserId : null;
    const email = isRecord(row) ? normalizeEmail(row.email) : null;
    const metadata = isRecord(row) ? row.app_metadata : null;
    authIdentities.push({
      userId,
      email,
      reference:
        typeof rawUserId === "string" ? rawUserId : `auth-${index}`,
    });
    if (!userId || !email) {
      addIssue(
        issues,
        seenIssues,
        "malformed_auth_user",
        typeof rawUserId === "string" ? rawUserId : `auth-${index}`,
        hashUid,
      );
      continue;
    }
    if (!isSafeMetadata(metadata)) {
      addIssue(
        issues,
        seenIssues,
        "malformed_auth_metadata",
        userId,
        hashUid,
      );
      continue;
    }
    if (readExistingVersion(metadata).kind === "unsafe") {
      addIssue(
        issues,
        seenIssues,
        "unsafe_credential_version",
        userId,
        hashUid,
      );
      continue;
    }
    authUsers.push({ userId, email, metadata });
  }

  const duplicateProfileUids = duplicateValues(
    profileIdentities,
    "userId",
  );
  const duplicateProfileEmails = duplicateValues(
    profileIdentities,
    "email",
  );
  const duplicateAuthUids = duplicateValues(authIdentities, "userId");
  const duplicateAuthEmails = duplicateValues(authIdentities, "email");

  for (const row of profileIdentities) {
    if (duplicateProfileUids.has(row.userId)) {
      addIssue(
        issues,
        seenIssues,
        "duplicate_profile_uid",
        row.reference,
        hashUid,
      );
    }
    if (duplicateProfileEmails.has(row.email)) {
      addIssue(
        issues,
        seenIssues,
        "duplicate_profile_email",
        row.reference,
        hashUid,
      );
    }
  }
  for (const row of authIdentities) {
    if (duplicateAuthUids.has(row.userId)) {
      addIssue(
        issues,
        seenIssues,
        "duplicate_auth_uid",
        row.reference,
        hashUid,
      );
    }
    if (duplicateAuthEmails.has(row.email)) {
      addIssue(
        issues,
        seenIssues,
        "duplicate_auth_email",
        row.reference,
        hashUid,
      );
    }
  }

  const profileByUid = new Map(profiles.map((row) => [row.userId, row]));
  const profileByEmail = new Map(profiles.map((row) => [row.email, row]));
  const authByUid = new Map(authUsers.map((row) => [row.userId, row]));
  const authByEmail = new Map(authUsers.map((row) => [row.email, row]));
  const matches = [];

  if (
    duplicateProfileUids.size === 0 &&
    duplicateProfileEmails.size === 0 &&
    duplicateAuthUids.size === 0 &&
    duplicateAuthEmails.size === 0
  ) {
    for (const profileRow of profiles) {
      const uidMatch = authByUid.get(profileRow.userId);
      const emailMatch = authByEmail.get(profileRow.email);

      if (uidMatch) {
        if (uidMatch.email !== profileRow.email) {
          addIssue(
            issues,
            seenIssues,
            "uid_email_mismatch",
            profileRow.userId,
            hashUid,
          );
          continue;
        }

        const nextAppMetadata = {
          ...uidMatch.metadata,
          credential_version: 1,
          bpv_admin_managed: true,
        };
        matches.push({
          userId: profileRow.userId,
          needsUpdate:
            uidMatch.metadata.credential_version !== 1 ||
            uidMatch.metadata.bpv_admin_managed !== true,
          nextAppMetadata,
        });
      } else if (emailMatch) {
        addIssue(
          issues,
          seenIssues,
          "email_uid_mismatch",
          profileRow.userId,
          hashUid,
        );
      } else {
        addIssue(
          issues,
          seenIssues,
          "profile_only",
          profileRow.userId,
          hashUid,
        );
      }
    }

    for (const authRow of authUsers) {
      const uidMatch = profileByUid.get(authRow.userId);
      const emailMatch = profileByEmail.get(authRow.email);

      if (uidMatch) {
        if (uidMatch.email !== authRow.email) {
          addIssue(
            issues,
            seenIssues,
            "uid_email_mismatch",
            authRow.userId,
            hashUid,
          );
        }
      } else if (emailMatch) {
        addIssue(
          issues,
          seenIssues,
          "email_uid_mismatch",
          authRow.userId,
          hashUid,
        );
      } else {
        addIssue(
          issues,
          seenIssues,
          "auth_only",
          authRow.userId,
          hashUid,
        );
      }
    }
  }

  return {
    ok: issues.length === 0,
    issues,
    matches: issues.length === 0 ? matches : [],
    counts: {
      profiles: profileRows.length,
      authUsers: authRows.length,
      matched: issues.length === 0 ? matches.length : 0,
    },
  };
}

export function parseBackfillArgs(argv) {
  if (argv.length === 0) {
    return { mode: "dry-run" };
  }
  if (
    argv.length !== 3 ||
    argv[0] !== "--apply" ||
    argv[1] !== "--project-ref" ||
    !PROJECT_REF_PATTERN.test(argv[2])
  ) {
    throw new Error(INVALID_ARGUMENTS);
  }

  return { mode: "apply", projectRef: argv[2] };
}

export function deriveProjectRef(supabaseUrl) {
  if (typeof supabaseUrl !== "string") {
    throw new Error(INVALID_CONFIGURATION);
  }

  let url;
  try {
    url = new URL(supabaseUrl);
  } catch {
    throw new Error(INVALID_CONFIGURATION);
  }

  const match = /^([a-z0-9]{20})\.supabase\.co$/.exec(url.hostname);
  if (
    url.protocol !== "https:" ||
    !match ||
    url.username ||
    url.password ||
    url.port ||
    url.pathname !== "/" ||
    url.search ||
    url.hash
  ) {
    throw new Error(INVALID_CONFIGURATION);
  }

  return match[1];
}

export function resolveBackfillConfig({ argv, env }) {
  const options = parseBackfillArgs(argv);
  const supabaseUrl = env.NEXT_PUBLIC_HOME_CONFIG_SUPABASE_URL;
  const supabaseSecretKey = env.SUPABASE_SECRET_KEY;
  const projectRef = deriveProjectRef(supabaseUrl);

  if (
    typeof supabaseSecretKey !== "string" ||
    !supabaseSecretKey.startsWith("sb_secret_") ||
    supabaseSecretKey.length > 1_024 ||
    (options.mode === "apply" && options.projectRef !== projectRef)
  ) {
    throw new Error(INVALID_CONFIGURATION);
  }

  return {
    mode: options.mode,
    projectRef,
    supabaseUrl,
    supabaseSecretKey,
  };
}

async function readProfiles(client) {
  const response = await client
    .from("admin_users")
    .select(PROFILE_PROJECTION);

  if (
    !isRecord(response) ||
    response.error !== null ||
    !Array.isArray(response.data)
  ) {
    throw new Error("Admin profile enumeration failed.");
  }

  return response.data;
}

export async function enumerateAuthUsers(
  client,
  {
    perPage = DEFAULT_AUTH_PAGE_SIZE,
    maxPages = DEFAULT_AUTH_MAX_PAGES,
  } = {},
) {
  if (
    !Number.isSafeInteger(perPage) ||
    perPage < 1 ||
    perPage > DEFAULT_AUTH_PAGE_SIZE ||
    !Number.isSafeInteger(maxPages) ||
    maxPages < 1 ||
    maxPages > DEFAULT_AUTH_MAX_PAGES
  ) {
    throw new Error("Auth pagination configuration is invalid.");
  }

  const users = [];
  for (let page = 1; page <= maxPages; page += 1) {
    const response = await client.auth.admin.listUsers({ page, perPage });
    if (
      !isRecord(response) ||
      response.error !== null ||
      !isRecord(response.data) ||
      !Array.isArray(response.data.users)
    ) {
      throw new Error("Auth user enumeration failed.");
    }

    users.push(...response.data.users);
    if (response.data.users.length < perPage) {
      return users;
    }
  }

  throw new Error("Auth pagination limit exceeded.");
}

function categoriesFromIssues(issues) {
  /** @type {Record<string, number>} */
  const categories = {};
  for (const issue of issues) {
    categories[issue.category] = (categories[issue.category] ?? 0) + 1;
  }
  return categories;
}

function createReport({
  projectRef,
  mode,
  profileCount,
  authUserCount,
  matched,
  updatesPlanned,
  updated,
  unchanged,
  verified,
  issues,
  completedAt,
}) {
  return {
    projectRef,
    mode,
    counts: {
      profiles: profileCount,
      authUsers: authUserCount,
      matched,
      updatesPlanned,
      updated,
      unchanged,
      verified,
      blocking: issues.length,
    },
    categories: categoriesFromIssues(issues),
    references: issues
      .filter((issue) => typeof issue.uidRef === "string")
      .map(({ category, uidRef }) => ({ category, uidRef })),
    completedAt,
  };
}

export async function runAdminAuthMetadataBackfill({
  client,
  mode,
  projectRef,
  supabaseUrl,
  clock = () => new Date(),
  hashUid = defaultHashUid,
  authPageSize = DEFAULT_AUTH_PAGE_SIZE,
  authMaxPages = DEFAULT_AUTH_MAX_PAGES,
}) {
  if (
    (mode !== "dry-run" && mode !== "apply") ||
    deriveProjectRef(supabaseUrl) !== projectRef
  ) {
    throw new Error(INVALID_CONFIGURATION);
  }

  const profiles = await readProfiles(client);
  const authUsers = await enumerateAuthUsers(client, {
    perPage: authPageSize,
    maxPages: authMaxPages,
  });
  const preflight = buildBackfillPreflight(profiles, authUsers, { hashUid });
  const updatesPlanned = preflight.matches.filter(
    (match) => match.needsUpdate,
  ).length;
  const unchanged = preflight.matches.length - updatesPlanned;
  const completedAt = () => clock().toISOString();

  if (!preflight.ok) {
    return {
      ok: false,
      report: createReport({
        projectRef,
        mode,
        profileCount: profiles.length,
        authUserCount: authUsers.length,
        matched: preflight.counts.matched,
        updatesPlanned,
        updated: 0,
        unchanged,
        verified: 0,
        issues: preflight.issues,
        completedAt: completedAt(),
      }),
    };
  }

  if (mode === "dry-run") {
    return {
      ok: true,
      report: createReport({
        projectRef,
        mode,
        profileCount: profiles.length,
        authUserCount: authUsers.length,
        matched: preflight.matches.length,
        updatesPlanned,
        updated: 0,
        unchanged,
        verified: 0,
        issues: [],
        completedAt: completedAt(),
      }),
    };
  }

  let updated = 0;
  for (const match of preflight.matches) {
    if (!match.needsUpdate) {
      continue;
    }

    let response;
    try {
      response = await client.auth.admin.updateUserById(match.userId, {
        app_metadata: match.nextAppMetadata,
      });
    } catch {
      response = null;
    }

    if (!isRecord(response) || response.error !== null) {
      const issues = [
        {
          category: "auth_update_failed",
          uidRef: hashUid(match.userId),
        },
      ];
      return {
        ok: false,
        report: createReport({
          projectRef,
          mode,
          profileCount: profiles.length,
          authUserCount: authUsers.length,
          matched: preflight.matches.length,
          updatesPlanned,
          updated,
          unchanged,
          verified: 0,
          issues,
          completedAt: completedAt(),
        }),
      };
    }
    updated += 1;
  }

  let verifiedProfiles;
  let verifiedAuthUsers;
  try {
    verifiedProfiles = await readProfiles(client);
    verifiedAuthUsers = await enumerateAuthUsers(client, {
      perPage: authPageSize,
      maxPages: authMaxPages,
    });
  } catch {
    return {
      ok: false,
      report: createReport({
        projectRef,
        mode,
        profileCount: profiles.length,
        authUserCount: authUsers.length,
        matched: preflight.matches.length,
        updatesPlanned,
        updated,
        unchanged,
        verified: 0,
        issues: [{ category: "verification_failed" }],
        completedAt: completedAt(),
      }),
    };
  }
  const verification = buildBackfillPreflight(
    verifiedProfiles,
    verifiedAuthUsers,
    { hashUid },
  );
  const verificationIssues = [...verification.issues];
  for (const match of verification.matches) {
    if (match.needsUpdate) {
      verificationIssues.push({
        category: "verification_mismatch",
        uidRef: hashUid(match.userId),
      });
    }
  }

  return {
    ok: verificationIssues.length === 0,
    report: createReport({
      projectRef,
      mode,
      profileCount: verifiedProfiles.length,
      authUserCount: verifiedAuthUsers.length,
      matched: preflight.matches.length,
      updatesPlanned,
      updated,
      unchanged,
      verified:
        verificationIssues.length === 0 ? verification.matches.length : 0,
      issues: verificationIssues,
      completedAt: completedAt(),
    }),
  };
}
