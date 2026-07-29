import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const migrationsDirectory = join(process.cwd(), "supabase", "migrations");
const migrationNames = readdirSync(migrationsDirectory);
const baseMigrationName = migrationNames.find((name) =>
  /^\d+_add_central_user_manager_health_probe\.sql$/.test(name),
);
const hardeningMigrationName = migrationNames.find((name) =>
  /^\d+_harden_central_user_manager_health_probe\.sql$/.test(name),
);

function normalizedSql(name: string | undefined): string {
  return name
    ? readFileSync(join(migrationsDirectory, name), "utf8")
        .replace(/--.*$/gm, "")
        .replace(/\s+/g, " ")
        .toLowerCase()
    : "";
}

const baseSql = normalizedSql(baseMigrationName);
const hardeningSql = normalizedSql(hardeningMigrationName);
const composedSql = `${baseSql} ${hardeningSql}`;
const normalizedContractValues = hardeningSql.replace(
  /::text(?:\[\])?/g,
  "",
);

const REQUIRED_RELATIONS = [
  "public.admin_users:r",
  "public.admin_user_operations:r",
  "public.admin_user_mutation_locks:r",
  "public.admin_user_mutation_fences:r",
  "public.admin_user_provider_events:r",
] as const;

const REQUIRED_COLUMNS = [
  "public.admin_users.user_id:uuid:true",
  "public.admin_users.email:text:true",
  "public.admin_users.role:text:true",
  "public.admin_users.is_active:boolean:true",
  "public.admin_users.must_change_password:boolean:true",
  "public.admin_users.credential_version:integer:true",
  "public.admin_users.created_at:timestamp with time zone:true",
  "public.admin_users.updated_at:timestamp with time zone:true",
  "public.admin_user_operations.operation_id:uuid:true",
  "public.admin_user_operations.actor_kind:text:true",
  "public.admin_user_operations.actor_uid:uuid:true",
  "public.admin_user_operations.action:text:true",
  "public.admin_user_operations.target_user_id:uuid:false",
  "public.admin_user_operations.target_email_normalized:text:false",
  "public.admin_user_operations.request_hash:text:true",
  "public.admin_user_operations.status:text:true",
  "public.admin_user_operations.stage:text:true",
  "public.admin_user_operations.fence_version:integer:true",
  "public.admin_user_operations.attempt_count:integer:true",
  "public.admin_user_operations.lease_token_hash:text:false",
  "public.admin_user_operations.lease_expires_at:timestamp with time zone:false",
  "public.admin_user_operations.provider_intent_at:timestamp with time zone:false",
  "public.admin_user_operations.provider_outcome_at:timestamp with time zone:false",
  "public.admin_user_operations.safe_result:jsonb:false",
  "public.admin_user_operations.safe_error_code:text:false",
  "public.admin_user_operations.safe_error_message:text:false",
  "public.admin_user_operations.created_at:timestamp with time zone:true",
  "public.admin_user_operations.updated_at:timestamp with time zone:true",
  "public.admin_user_operations.completed_at:timestamp with time zone:false",
  "public.admin_user_mutation_locks.target_email_normalized:text:true",
  "public.admin_user_mutation_locks.operation_id:uuid:true",
  "public.admin_user_mutation_locks.owner_kind:text:true",
  "public.admin_user_mutation_locks.state:text:true",
  "public.admin_user_mutation_locks.fence_version:integer:true",
  "public.admin_user_mutation_locks.lease_token_hash:text:true",
  "public.admin_user_mutation_locks.lease_expires_at:timestamp with time zone:true",
  "public.admin_user_mutation_locks.quarantine_code:text:false",
  "public.admin_user_mutation_locks.quarantine_reason:text:false",
  "public.admin_user_mutation_locks.created_at:timestamp with time zone:true",
  "public.admin_user_mutation_locks.updated_at:timestamp with time zone:true",
  "public.admin_user_mutation_fences.target_email_normalized:text:true",
  "public.admin_user_mutation_fences.last_fence_version:integer:true",
  "public.admin_user_mutation_fences.is_quarantined:boolean:true",
  "public.admin_user_mutation_fences.quarantine_code:text:false",
  "public.admin_user_mutation_fences.quarantine_reason:text:false",
  "public.admin_user_mutation_fences.updated_at:timestamp with time zone:true",
  "public.admin_user_provider_events.operation_id:uuid:true",
  "public.admin_user_provider_events.provider_step:text:true",
  "public.admin_user_provider_events.step_ordinal:integer:true",
  "public.admin_user_provider_events.outcome:text:false",
  "public.admin_user_provider_events.target_user_id:uuid:false",
  "public.admin_user_provider_events.credential_version:integer:false",
  "public.admin_user_provider_events.provider_error_code:text:false",
  "public.admin_user_provider_events.intent_at:timestamp with time zone:true",
  "public.admin_user_provider_events.outcome_at:timestamp with time zone:false",
] as const;

const REQUIRED_ROUTINES = [
  "public.resume_admin_user_operation_v2(uuid,uuid,text,uuid,text,text,text,integer)",
  "public.renew_admin_user_operation_lease(uuid,integer,text,text,integer)",
  "public.commit_admin_user_provider_intent_v2(uuid,integer,text,text)",
  "public.commit_admin_user_provider_outcome_v2(uuid,integer,text,text,text,uuid,integer,text)",
  "public.complete_admin_user_operation_v2(uuid,integer,text,text,uuid,text,text,timestamp with time zone,timestamp with time zone,integer,integer,text)",
  "public.quarantine_admin_user_operation(uuid,integer,text,text)",
  "public.mark_admin_user_operation_needs_review(uuid,integer,text,text)",
  "public.record_admin_user_late_fence_v2(uuid,integer,integer,integer)",
  "public.create_admin_user_profile_for_operation_v2(uuid,integer,text,uuid,text)",
  "public.prepare_admin_user_create_compensation_v2(uuid,integer,text,uuid,text)",
  "public.advance_admin_user_profile_for_operation_v2(uuid,integer,text,uuid,text,boolean,boolean,integer,boolean,boolean,integer)",
  "public.activate_admin_user_profile_for_operation_v2(uuid,integer,text,uuid,text,integer)",
  "public.list_reconciled_admin_users_v1(integer,integer)",
] as const;

interface CatalogFixture {
  relations: Set<string>;
  columns: Set<string>;
  routines: Map<
    string,
    {
      kind: "f" | "p";
      returnType: string;
      securityDefiner: boolean;
      serviceRoleExecute: boolean;
    }
  >;
}

function completeCatalog(): CatalogFixture {
  return {
    relations: new Set(REQUIRED_RELATIONS),
    columns: new Set(REQUIRED_COLUMNS),
    routines: new Map(
      REQUIRED_ROUTINES.map((identity) => [
        identity,
        {
          kind: "f" as const,
          returnType: "jsonb",
          securityDefiner: true,
          serviceRoleExecute: true,
        },
      ]),
    ),
  };
}

function catalogSatisfiesRuntimeContract(catalog: CatalogFixture): boolean {
  return (
    REQUIRED_RELATIONS.every((relation) =>
      catalog.relations.has(relation)) &&
    REQUIRED_COLUMNS.every((column) => catalog.columns.has(column)) &&
    REQUIRED_ROUTINES.every((identity) => {
      const routine = catalog.routines.get(identity);
      return (
        routine?.kind === "f" &&
        routine.returnType === "jsonb" &&
        routine.securityDefiner === true &&
        routine.serviceRoleExecute === true
      );
    })
  );
}

describe("Central User Manager health probe migration", () => {
  it("composes an unapplied hardening migration over the original probe", () => {
    expect(baseMigrationName).toBeDefined();
    expect(hardeningMigrationName).toBeDefined();
    expect(hardeningSql).toContain(
      "create or replace function private.central_user_manager_health_probe_v1_impl()",
    );
    expect(hardeningSql).toContain(
      "create or replace function public.central_user_manager_health_probe_v1()",
    );
    expect(hardeningSql.match(/security definer/g)).toHaveLength(2);
    expect(hardeningSql.match(/set search_path = ''/g)).toHaveLength(2);
  });

  it("declares every runtime relation, column type/nullability, and exact RPC identity", () => {
    for (const relation of REQUIRED_RELATIONS) {
      const [qualifiedTable, kind] = relation.split(":");
      const [schema, table] = qualifiedTable.split(".");
      expect(normalizedContractValues).toContain(
        `('${schema}', '${table}', '${kind}')`,
      );
    }
    for (const column of REQUIRED_COLUMNS) {
      const [qualifiedColumn, type, nullable] = column.split(":");
      const [schema, table, columnName] = qualifiedColumn.split(".");
      expect(normalizedContractValues).toContain(
        `('${schema}', '${table}', '${columnName}', '${type}', ${nullable})`,
      );
    }
    for (const identity of REQUIRED_ROUTINES) {
      expect(hardeningSql).toContain(`'${identity}'`);
    }
  });

  it("checks relkind, exact column type/nullability, callable function identity, kind, return, definer, and ACL", () => {
    for (const predicate of [
      "relation.relkind::text = required.relkind",
      "pg_catalog.format_type(",
      "attribute.atttypid",
      "attribute.atttypmod",
      ") = required.data_type",
      "attribute.attnotnull = required.not_null",
      "procedure.oid = pg_catalog.to_regprocedure(required.procedure_identity)",
      "procedure.prokind::text = required.function_kind",
      "procedure.prorettype = pg_catalog.to_regtype(required.return_type)",
      "procedure.prosecdef = required.security_definer",
      "procedure.proretset = false",
      "procedure.proargmodes is null",
      "procedure.proargnames = required.argument_names",
      "pg_catalog.has_function_privilege(",
      "'service_role'",
      "procedure.oid",
      "'execute'",
    ]) {
      expect(hardeningSql).toContain(predicate);
    }
  });

  it.each([
    ["missing column", (catalog: CatalogFixture) => {
      catalog.columns.delete("public.admin_users.role:text:true");
    }],
    ["wrong column type", (catalog: CatalogFixture) => {
      catalog.columns.delete("public.admin_user_operations.safe_result:jsonb:false");
      catalog.columns.add("public.admin_user_operations.safe_result:text:false");
    }],
    ["wrong relation kind", (catalog: CatalogFixture) => {
      catalog.relations.delete("public.admin_user_operations:r");
      catalog.relations.add("public.admin_user_operations:v");
    }],
    ["wrong RPC signature", (catalog: CatalogFixture) => {
      const identity = REQUIRED_ROUTINES[0];
      catalog.routines.delete(identity);
      catalog.routines.set(identity.replace("integer)", "text)"), {
        kind: "f",
        returnType: "jsonb",
        securityDefiner: true,
        serviceRoleExecute: true,
      });
    }],
    ["procedure instead of function", (catalog: CatalogFixture) => {
      const routine = catalog.routines.get(REQUIRED_ROUTINES[1]);
      if (routine) {
        routine.kind = "p";
      }
    }],
    ["wrong return type", (catalog: CatalogFixture) => {
      const routine = catalog.routines.get(REQUIRED_ROUTINES[2]);
      if (routine) {
        routine.returnType = "text";
      }
    }],
    ["revoked service_role execute", (catalog: CatalogFixture) => {
      const routine = catalog.routines.get(REQUIRED_ROUTINES[3]);
      if (routine) {
        routine.serviceRoleExecute = false;
      }
    }],
  ])("fails health for %s", (_label, mutate) => {
    const catalog = completeCatalog();
    expect(catalogSatisfiesRuntimeContract(catalog)).toBe(true);

    mutate(catalog);

    expect(catalogSatisfiesRuntimeContract(catalog)).toBe(false);
  });

  it("returns only exact booleans and remains read-only and least-privilege", () => {
    for (const key of [
      "'database'",
      "'adminuserstable'",
      "'operationtables'",
    ]) {
      expect(hardeningSql).toContain(key);
    }
    expect(composedSql).not.toMatch(
      /\b(insert|update|delete|merge|truncate|lock|for update|create trigger)\b/,
    );
    expect(composedSql).not.toMatch(/\bexecute\s+(format|immediate)\b/);
    expect(hardeningSql).toMatch(
      /revoke all on function private\.central_user_manager_health_probe_v1_impl\(\) from public, anon, authenticated, service_role/,
    );
    expect(hardeningSql).toMatch(
      /revoke all on function public\.central_user_manager_health_probe_v1\(\) from public, anon, authenticated, service_role/,
    );
    expect(hardeningSql).toContain(
      "grant execute on function public.central_user_manager_health_probe_v1() to service_role",
    );
  });
});
