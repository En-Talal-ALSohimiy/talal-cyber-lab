# Language map / خريطة اللغة

The product is bilingual at the user-facing layer. Use the language toggle to switch Arabic/RTL and English/LTR. The following documents are paired references:

| Arabic / العربية | English / الإنجليزية |
|---|---|
| `README.md` and `README-LINUX.md` | `docs/ENGLISH-GUIDE.md` |
| `public/docs/USER-GUIDE.md` | `docs/ENGLISH-GUIDE.md` |
| `public/docs/ARCHITECTURE.md` | `ARCHITECTURE-LINUX.md` plus English sections in `docs/ENGLISH-GUIDE.md` |
| `public/docs/CONNECTORS.md` | `docs/ENGLISH-GUIDE.md` |
| `SECURITY.md`, `CONTRIBUTING.md`, `THIRD-PARTY.md` | Same files include English control and licensing text |

API identifiers, database fields, connector IDs, execution profile IDs and report kind IDs are language-neutral. Never parse Arabic or English labels as protocol values.

واجهة المستخدم ثنائية اللغة، والمعرفات البرمجية محايدة للغة. لا تستخدم النصوص المرئية كقيم بروتوكول؛ استخدم معرفات API الثابتة.

