# Talal Cyber Lab / مختبر طلال السيبراني

## Product scope / نطاق المنتج

Talal Cyber Lab is a Linux-local bilingual workspace for scoped digital-forensics triage, evidence custody, bounded tool execution, findings review and report snapshots. It is a training and evaluation implementation. It is not a government-accredited forensic appliance, a full-disk imaging system, or a claim that every catalog entry is installed.

مختبر طلال السيبراني منصة Linux محلية ثنائية اللغة لإدارة القضايا، حفظ الأدلة، تشغيل تحليلات محددة، مراجعة النتائج وحفظ التقارير. هذه نسخة تدريبية وتقييمية وليست جهاز تصوير أقراص كاملاً أو اعتماداً حكومياً.

## Language / اللغة

The web interface switches between Arabic and English using the language button. Right-to-left layout is applied for Arabic and left-to-right layout for English. Tool cards, connector names, severity states, report kinds, empty states and errors have both labels. The API returns stable identifiers and the UI translates them; integrations should use identifiers rather than visible language labels.

تبدل الواجهة بين العربية والإنجليزية من زر اللغة، وتطبق RTL للعربية وLTR للإنجليزية. معرفات API ثابتة؛ استخدمها في التكاملات بدلاً من النصوص المعروضة.

## Installation / التثبيت

```bash
bash install.sh
docker compose exec app cat /data/initial-password.txt
```

Requirements: Linux, Docker Engine, Compose v2 and OpenSSL. Open `http://localhost:3210`, then use the generated local password. No cloud account is required. Keep `.env`, `/data`, backups and the initial password private.

المتطلبات: Linux وDocker Engine وCompose v2 وOpenSSL. افتح `http://localhost:3210` واستخدم كلمة المرور المحلية الناتجة. لا يحتاج التشغيل إلى حساب سحابي.

## Daily workflow / سير العمل

1. Create a case and record authority, scope and exclusions. / أنشئ قضية وسجل التفويض والنطاق والاستثناءات.
2. Deposit evidence up to 8 MiB; the server computes SHA-256. / أودع دليلاً حتى 8 MiB وتحسب المنصة SHA-256.
3. Open **Run tools**. Only profiles reported ready by the worker can run. / افتح **تشغيل الأدوات**؛ لا تظهر للتشغيل إلا الوظائف الجاهزة فعلياً.
4. Select a file or the named `training` target, run a predefined profile, and wait for the job. / اختر ملفاً أو الهدف المسمى `training` وشغل وظيفة محددة.
5. The output is saved as new evidence with custody. Nmap output may be imported automatically. / تحفظ المخرجات كدليل جديد بسلسلة حيازة، وقد تستورد مخرجات Nmap تلقائياً.
6. Review pending findings, record a reason, and save a bilingual report snapshot. / راجع النتائج المعلقة وسجل السبب واحفظ نسخة تقرير ثنائية اللغة.

## Actual execution / التشغيل الفعلي

The worker contains 15 predefined profiles: hashes, strings, file, ExifTool, pdfinfo, pdftotext, mmls, fsstat, fls, img_stat, capinfos, tshark, ssdeep, YARA and Nmap. Hashes and strings are built in Node; the remaining profiles require the Linux packages installed in the worker image. The UI status is authoritative for the current host.

يحتوي العامل على 15 وظيفة محددة. تنفذ hashes وstrings داخل Node؛ وبقية الوظائف تتطلب حزم Linux في صورة العامل. حالة الجاهزية المعروضة هي المرجع للجهاز الحالي.

Commercial tools such as EnCase and FTK are catalog entries only and are not redistributed. They require vendor licenses and compatible environments. The 40-entry registry and six file connectors are broader than the installed execution set.

الأدوات التجارية مثل EnCase وFTK تظهر في المكتبة فقط ولا يعاد توزيعها. تحتاج تراخيص وبيئات متوافقة. مكتبة 40 أداة وموصلاتها الست أوسع من مجموعة التشغيل المثبتة.

## Reports and connectors / التقارير والموصلات

Connectors accept Nmap XML, ZAP JSON, SARIF 2.1.0, Zeek JSONL, Volatility JSON and Nuclei JSONL. Input is bounded to 2 MiB and 200 records. External XML entities and remote fetching are rejected. Report kinds are forensics, pentest, incident, executive, custody and remediation; each can be Arabic or English and saved as an immutable SHA-256 snapshot.

تقبل الموصلات Nmap XML وZAP JSON وSARIF 2.1.0 وZeek JSONL وVolatility JSON وNuclei JSONL. حد الملف 2 MiB و200 سجل. ترفض الكيانات الخارجية. أنواع التقارير الستة قابلة للحفظ بالعربية أو الإنجليزية ببصمة مستقلة.

## Security / الأمان

The local account uses scrypt and expiring HttpOnly/SameSite sessions. The app and worker are separate containers; the worker has no database volume or Docker socket. Commands use fixed argument arrays with `shell:false`, bounded runtime and output, and temporary input files. Do not expose the worker or Docker daemon. Read SECURITY.md before changing network exposure.

يستخدم الحساب المحلي scrypt وجلسات HttpOnly/SameSite منتهية. العامل منفصل ولا يملك قاعدة البيانات أو مقبس Docker. الأوامر ثابتة وبلا shell مع حدود زمنية وحجم مخرجات. لا تعرض العامل أو Docker للشبكة.

## Verification / التحقق

```bash
npm test
npx tsc --noEmit
npm run build
docker compose exec app node local/acceptance.mjs
```

The first three commands passed in the development environment and covered 28 tests. Two built-in profiles were executed through the local worker. The 13 external Linux profiles require a successful Docker acceptance run before an operational release claim. CI is configured in `.github/workflows/linux.yml`.

اجتازت الأوامر الثلاثة الأولى 28 اختباراً في بيئة التطوير، وثبت تشغيل وظيفتي hashes وstrings. تحتاج الوظائف الخارجية الـ13 إلى نجاح فحص Docker قبل إعلان إصدار تشغيلي.

## Maintenance / الصيانة

Use `backup.sh` before upgrades. Use `docker compose logs --tail=100 app worker` for diagnostics. Change the password with `local/change-password.mjs` through stdin; it revokes existing sessions. Add a new generated migration for schema changes and never edit an applied migration. Select a platform license and review third-party notices before public redistribution.

استخدم `backup.sh` قبل التحديث. راجع السجلات للتشخيص. غيّر كلمة المرور عبر stdin حتى لا تظهر في سجل الأوامر، ويؤدي التغيير إلى إلغاء الجلسات. أضف ترحيلًا جديداً للمخطط ولا تعدل ترحيلاً مطبقاً.

Developer / المطور: **م. طلال فواز السحيمي** — [talal@talalsuhaimi.com](mailto:talal@talalsuhaimi.com) — [talalsuhaimi.com](https://talalsuhaimi.com).

