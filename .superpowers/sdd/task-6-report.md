# Task 6 RED/GREEN Report: Brand, Theme, and Hero Editors

## Scope

Added independently bundled Brand, Theme, and Hero settings routes. Each route
statically imports only its editor, and each editor reads and patches only its
matching section endpoint and fields/assets. Existing controls, upload
validation, safe image previews, scoped theme stylesheet, and Thai copy were
reused without adding dependencies or a section switch.

## RED

Added one endpoint-ownership and PATCH-payload test per page before production
code. The required page command failed because the three editor modules did not
exist.

## GREEN

An initial page-test run hung because each test's `useRouter` mock returned a
new object on every render, retriggering the hook load effect. The stable router
mock pattern already used by the hook tests fixed the harness root cause.

Each page then passed independently. The required focused command passed:

```powershell
npm.cmd test -- components/admin/settings/__tests__/brand-settings-page.test.tsx components/admin/settings/__tests__/theme-settings-page.test.tsx components/admin/settings/__tests__/hero-settings-page.test.tsx components/admin/settings/__tests__/settings-form-controls.test.tsx components/admin/settings/__tests__/settings-validation.test.ts --maxWorkers=1
```

- Test files: 5 passed
- Tests: 8 passed

The one required full suite also passed:

```powershell
npm.cmd test -- --maxWorkers=1
```

- Test files: 175 passed
- Tests: 1139 passed

Lint and build were intentionally skipped per parent instruction.
