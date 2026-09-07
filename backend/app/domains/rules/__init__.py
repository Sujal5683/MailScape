"""Rules domain package.

Routes for CRUD on classification rules. Each write creates a version
snapshot in `RuleVersion` and emits an audit event — mirroring
`src/app/api/rules/**/route.ts`.
"""
