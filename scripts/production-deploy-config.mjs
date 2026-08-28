import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import ts from "typescript";

const WRANGLER_CONFIG_PATH = fileURLToPath(
  new URL("../wrangler.jsonc", import.meta.url),
);

export const PRODUCTION_DEPLOYMENT_TARGETS = Object.freeze([
  Object.freeze({
    target: "baanparty",
    siteUrl: "https://www.baanpartypattaya.com",
  }),
  Object.freeze({
    target: "baan02",
    siteUrl: "https://www.poolvillapattaya.co.th",
  }),
  Object.freeze({
    target: "baanPMhee",
    siteUrl: "https://www.pmheevilla.com",
  }),
  Object.freeze({
    target: "flukNasa",
    siteUrl: "https://fluk-nasa-poolvilla.poolvilla.workers.dev",
  }),
  Object.freeze({
    target: "villaMedia",
    siteUrl: "https://villa-media-poolvilla.poolvilla.workers.dev",
  }),
]);

export const REQUIRED_BUILD_ENVIRONMENT_VARIABLES = Object.freeze([
  "CLOUDFLARE_ACCOUNT_ID",
  "CLOUDFLARE_API_TOKEN",
  "NEXT_PUBLIC_SITE_URL",
  "NEXT_PUBLIC_HOME_CONFIG_SUPABASE_URL",
  "NEXT_PUBLIC_HOME_CONFIG_SUPABASE_PUBLISHABLE_KEY",
  "NEXT_PUBLIC_TURNSTILE_SITE_KEY",
  "SUPABASE_PUBLISHABLE_KEY",
]);

export const REQUIRED_RUNTIME_SECRETS = Object.freeze([
  "CALENDAR_INTERNAL_API_TOKEN",
  "DEVILLE_BEARER_TOKEN",
  "PATTAYA_BOOKINGS_API_TOKEN",
  "SUPABASE_PUBLISHABLE_KEY",
  "TURNSTILE_SECRET_KEY",
]);

export const PROJECT_REF_VARIABLE = "CENTRAL_USER_MANAGER_PROJECT_REF";

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeHttpsOrigin(variableName, value) {
  let url;

  try {
    url = new URL(value);
  } catch {
    throw new Error(`Invalid ${variableName}: expected an HTTPS origin.`);
  }

  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash
  ) {
    throw new Error(`Invalid ${variableName}: expected an HTTPS origin.`);
  }

  return url.origin;
}

export function normalizeProjectRef(target, value) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${target} is missing ${PROJECT_REF_VARIABLE}`);
  }

  if (!/^[a-z]{20}$/.test(value.trim())) {
    throw new Error(`${target} has an invalid ${PROJECT_REF_VARIABLE}`);
  }

  return value.trim();
}

export function getDeploymentMatrix(
  config,
  targets = PRODUCTION_DEPLOYMENT_TARGETS,
) {
  return {
    include: targets.map(({ target, siteUrl }) => ({
      target,
      siteUrl,
      projectRef: normalizeProjectRef(
        target,
        config?.env?.[target]?.vars?.[PROJECT_REF_VARIABLE],
      ),
    })),
  };
}

export function parseWranglerConfig(source, filename = "wrangler.jsonc") {
  const parsed = ts.parseConfigFileTextToJson(filename, source);

  if (parsed.error) {
    const detail = ts.flattenDiagnosticMessageText(
      parsed.error.messageText,
      "\n",
    );

    throw new Error(`Invalid ${filename}: ${detail}`);
  }

  if (!isRecord(parsed.config)) {
    throw new Error(`Invalid ${filename}: expected a JSON object.`);
  }

  return parsed.config;
}

export function validateWranglerDeploymentConfig(
  config,
  targets = PRODUCTION_DEPLOYMENT_TARGETS,
  requiredSecrets = REQUIRED_RUNTIME_SECRETS,
) {
  if (!isRecord(config.env)) {
    throw new Error("wrangler.jsonc is missing the env object.");
  }

  const errors = [];

  for (const { target, siteUrl } of targets) {
    const targetConfig = config.env[target];

    if (!isRecord(targetConfig)) {
      errors.push(`wrangler.jsonc is missing environment: ${target}`);
      continue;
    }

    let expectedOrigin;
    let configuredOrigin;

    try {
      expectedOrigin = normalizeHttpsOrigin(`${target}.siteUrl`, siteUrl);
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
      continue;
    }

    const configuredSiteUrl = isRecord(targetConfig.vars)
      ? targetConfig.vars.NEXT_PUBLIC_SITE_URL
      : undefined;

    try {
      normalizeProjectRef(
        target,
        isRecord(targetConfig.vars)
          ? targetConfig.vars[PROJECT_REF_VARIABLE]
          : undefined,
      );
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
    }

    try {
      configuredOrigin = normalizeHttpsOrigin(
        `${target}.vars.NEXT_PUBLIC_SITE_URL`,
        configuredSiteUrl,
      );
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
      continue;
    }

    if (configuredOrigin !== expectedOrigin) {
      errors.push(`${target} has a NEXT_PUBLIC_SITE_URL mismatch.`);
    }

    const declaredSecrets =
      isRecord(targetConfig.secrets) &&
      Array.isArray(targetConfig.secrets.required)
        ? new Set(targetConfig.secrets.required)
        : new Set();
    const missingSecrets = requiredSecrets.filter(
      (name) => !declaredSecrets.has(name),
    );

    if (missingSecrets.length > 0) {
      errors.push(
        `${target} is missing required secret declaration: ${missingSecrets.join(
          ", ",
        )}`,
      );
    }
  }

  if (errors.length > 0) {
    throw new Error(errors.join("\n"));
  }

  return true;
}

export function validateBuildEnvironment(
  target,
  env = process.env,
  targets = PRODUCTION_DEPLOYMENT_TARGETS,
) {
  const targetConfig = targets.find((candidate) => candidate.target === target);

  if (!targetConfig) {
    throw new Error(`Unknown production deployment target: ${target}`);
  }

  const missingNames = REQUIRED_BUILD_ENVIRONMENT_VARIABLES.filter(
    (name) => typeof env[name] !== "string" || env[name].trim() === "",
  );

  if (missingNames.length > 0) {
    throw new Error(
      `Missing required deployment environment variables for ${target}: ${missingNames.join(
        ", ",
      )}`,
    );
  }

  if (!/^[a-f0-9]{32}$/i.test(env.CLOUDFLARE_ACCOUNT_ID.trim())) {
    throw new Error(
      "Invalid CLOUDFLARE_ACCOUNT_ID: expected a 32-character hexadecimal account id.",
    );
  }

  const buildSiteUrl = normalizeHttpsOrigin(
    "NEXT_PUBLIC_SITE_URL",
    env.NEXT_PUBLIC_SITE_URL.trim(),
  );

  if (buildSiteUrl !== targetConfig.siteUrl) {
    throw new Error(`NEXT_PUBLIC_SITE_URL does not match ${target}.`);
  }

  normalizeHttpsOrigin(
    "NEXT_PUBLIC_HOME_CONFIG_SUPABASE_URL",
    env.NEXT_PUBLIC_HOME_CONFIG_SUPABASE_URL.trim(),
  );

  return targetConfig;
}

export async function readWranglerConfig(
  configPath = WRANGLER_CONFIG_PATH,
) {
  const source = await readFile(configPath, "utf8");

  return parseWranglerConfig(source, configPath);
}

export async function runCli(argv, env = process.env) {
  const [command, target, ...extraArguments] = argv;

  if (extraArguments.length > 0) {
    throw new Error(
      "Usage: node scripts/production-deploy-config.mjs matrix | validate [baanparty|baan02|baanPMhee|flukNasa|villaMedia]",
    );
  }

  const config = await readWranglerConfig();
  validateWranglerDeploymentConfig(config);

  if (command === "matrix" && !target) {
    return JSON.stringify(getDeploymentMatrix(config));
  }

  if (command === "validate") {
    if (target) {
      validateBuildEnvironment(target, env);

      return `Validated production deployment target: ${target}`;
    }

    return `Validated ${PRODUCTION_DEPLOYMENT_TARGETS.length} production deployment targets.`;
  }

  throw new Error(
    "Usage: node scripts/production-deploy-config.mjs matrix | validate [baanparty|baan02|baanPMhee|flukNasa|villaMedia]",
  );
}

const isDirectRun =
  process.argv[1] &&
  resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));

if (isDirectRun) {
  runCli(process.argv.slice(2))
    .then((output) => {
      process.stdout.write(`${output}\n`);
    })
    .catch((error) => {
      console.error(
        error instanceof Error
          ? error.message
          : "Unknown deployment configuration error.",
      );
      process.exitCode = 1;
    });
}
