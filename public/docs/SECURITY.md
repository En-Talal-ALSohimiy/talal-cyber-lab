# Security and operational boundaries

Report vulnerabilities privately to **talal@talalsuhaimi.com**. Do not attach real evidence, credentials, exploit targets, or personal data to public issues.

## Implemented controls

- A local account uses scrypt with a random salt; random initial passwords are written with mode 0600. Sessions are hashed in SQLite, expire after 12 hours, and use HttpOnly/SameSite cookies. Login attempts are bounded.
- Host and Origin checks protect the local service; mutation APIs require a custom header. Browser-provided cloud identity headers are ignored.
- The UI container owns SQLite and evidence storage. The worker has neither the database volume nor the Docker socket. Worker requests require a separate random shared credential.
- Tool execution uses fixed argument arrays and no shell. Inputs are copied to temporary files. Output, runtime, process count, memory and CPU are bounded. Worker containers run as an unprivileged user with capabilities dropped and a read-only filesystem.
- The default target network is internal. Nmap accepts configured target identifiers only. No arbitrary shell, flags, URLs or target ranges are accepted from the UI.
- Tool output is stored through the same evidence/custody path as uploads. Findings remain subject to examiner review.

## Limits requiring operational review

This release is an evaluation implementation, not an accredited forensic appliance. It currently supports one local account, files up to 8 MiB, 60-second jobs and output up to 2 MiB. It is for bounded triage artifacts, not multi-terabyte forensic imaging. There is no independently anchored audit chain, multi-user separation of duties, encrypted evidence volume, raw disk acquisition or write blocker. Use host disk encryption and organization-specific retention/backup controls.

Analysis tools parse untrusted formats and can contain vulnerabilities. Container isolation reduces exposure but is not a security proof. Do not expose the worker or Docker daemon. Binding the web service outside localhost requires an HTTPS reverse proxy and explicit LAB_ORIGIN configuration; this topology has not been validated in this delivery.

The default YARA rule matches a training marker only. It is not a general malware ruleset. Administrators must review their own rules, rebuild the worker, and validate expected matches and false positives.

Container images use official moving Node/Debian tags during development. Before a signed release, pin reviewed image digests, record installed package versions, scan the resulting image, run the Linux acceptance workflow and retain results. Do not auto-upgrade a live forensic case environment. Stage, validate, back up, then update.

