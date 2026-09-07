# Contributing

Use synthetic fixtures. Run `npm ci`, `npm test`, `npm run build`, then the Linux Docker acceptance check before proposing a change. Do not commit `data/`, `.env`, backups, vendor binaries, licensed OS images, secrets or real evidence.

A new execution profile must specify a fixed executable and argument list, bounded input/output and runtime, supported input format, licensing/provisioning requirements, and an acceptance fixture exercising the actual executable. Never accept user-supplied shell commands or arbitrary command-line flags. Add parser tests when automatically turning output into findings. Adding a catalog card does not establish execution support.

Schema updates require a new generated incremental Drizzle migration; never edit an applied migration. Update both Arabic and English descriptions. Document any fixture-only coverage and unsupported vendor versions.

