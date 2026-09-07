# مختبر طلال السيبراني | Talal Cyber Lab

**Linux edition — source prepared; full Linux acceptance pending.**

منصة محلية بالعربية والإنجليزية لإدارة القضايا والأدلة وتشغيل تحليلات محددة داخل عامل معزول، وحفظ النتائج والتقارير. تصميم وتطوير **م. طلال فواز السحيمي**، مهندس معماريات أنظمة التشغيل والمنصات السيبرانية.

[الموقع الرسمي](https://talalsuhaimi.com) · [البريد](mailto:talal@talalsuhaimi.com) · 0544473041

## التثبيت على Linux

المتطلبات: Linux مع Docker Engine وCompose v2 وOpenSSL، اتصال إنترنت للبناء الأول، وذاكرة ومساحة كافيتان لبناء الحاويات. يفضل البدء بجهاز تدريب بذاكرة 4 GiB ومساحة حرة 10 GiB؛ هذه توصية تجهيز أولي وليست نتيجة قياس أداء.

نزّل المصدر أو استنسخ المستودع **بعد إنشائه**، ثم افتح الطرفية داخل مجلد المشروع:

```bash
bash install.sh
docker compose exec app cat /data/initial-password.txt
```

افتح **http://localhost:3210** واستخدم كلمة المرور الناتجة. لا تحتاج  استضافة Sites أو خدمة سحابية لتشغيل هذه النسخة. يعمل الموقع على جهاز Linux المحلي؛ الوصول إليه من جهاز آخر يحتاج إعداد نشر HTTPS منفصلاً.

ينشئ المثبت كلمة مرور أولية وسراً مستقلاً للعامل. تبقى بيانات القضايا والأدلة في وحدة `lab-data`. لا تستخدم `docker compose down --volumes` على تثبيت يحتوي أدلة تريد الاحتفاظ بها.

## التشغيل من الواجهة

1. أنشئ قضية وسجل التفويض والنطاق.
2. أودع ملف تحليل حتى 8 MiB مع المصدر والحائز.
3. افتح **تشغيل الأدوات**؛ تظهر فقط الوظائف المثبتة كجاهزة. اختر الملف ثم شغّل التحليل.
4. تابع حالة المهمة. ينفذ العامل الأداة فعلياً، ويحفظ المخرجات كدليل مع SHA-256 وسلسلة حيازة. لتنفيذ Nmap اختر الهدف التدريبي المسمى `training`؛ لا تقبل الواجهة أهدافاً عشوائية.
5. افتح خزنة الأدلة لتنزيل المخرجات أو استيراد الصيغ المدعومة من قسم الموصلات. مخرجات Nmap تستورد تلقائياً عندما تحتوي سجلات.
6. راجع النتائج وأنشئ أحد أنواع التقارير الستة واحفظ نسخة مستقلة. نزّل Markdown أو HTML للطباعة أو JSON؛ سجل النتائج يدعم CSV.

## التغطية الفعلية

| المجال | الوظائف المسجلة في عامل Linux | نوع الاستخدام |
|---|---|---|
| البصمات والنصوص | SHA-256/SHA-512، printable strings | تنفذان داخل Node؛ اجتازتا اختباراً فعلياً هنا |
| الملفات والبيانات الوصفية | file، ExifTool، ssdeep | تشغيل برامج Linux على ملف مودع |
| مستندات PDF | pdfinfo، pdftotext | خصائص المستند واستخراج النص |
| صور الأقراص وأنظمة الملفات | mmls، fsstat، fls، img_stat | تحليل صور تدريبية صغيرة؛ ليست عملية تصوير قرص خام |
| التقاط الشبكة | capinfos، tshark | تحليل PCAP محفوظ؛ ليس التقاطاً حياً |
| مطابقة القواعد | YARA | قاعدة تدريبية مضمنة؛ يحتاج الكشف الحقيقي قواعد يراجعها المختص |
| الشبكة التدريبية | Nmap TCP connect | جرد أربعة منافذ لهدف مضبوط في إعداد العامل |

**الإجمالي 15 ملف تشغيل، وليس 40 أداة مثبتة.** مكتبة الـ40 أداة مرجع أوسع، والموصلات الست تستورد Nmap XML وZAP JSON وSARIF وZeek JSONL وVolatility JSON وNuclei JSONL. EnCase وFTK وبقية البرامج التجارية ليست مضمّنة، ولا تعمل تلقائياً على Linux بمجرد تنزيل المصدر.

## فحص القبول قبل إصدار نسخة جاهزة

```bash
docker compose exec app node local/acceptance.mjs
```

يفحص هذا الأمر توفر الوظائف الـ15 ثم يشغّل كل واحدة على ملفات اصطناعية أو الهدف الداخلي، ويتحقق من حفظ النتائج وبصماتها والتقرير. يترك قضية تدريبية مغلقة في قاعدة البيانات. سير العمل `.github/workflows/linux.yml` ينفذ الاختبارات والبناء وهذا الفحص على Ubuntu عند رفع المشروع إلى GitHub.

اجتازت 28 تجربة آلية في بيئة التطوير، منها تشغيل فعلي لوظيفتي البصمات والنصوص عبر عامل HTTP، تسجيل الدخول، عزل الحساب، التدقيق والحيازة والتقارير. نجح فحص TypeScript وبناء الواجهة. **لم يُنفذ بناء Docker وفحص الوظائف الخارجية الـ13 هنا لعدم توفر مضيف Linux أو محرك Docker يعمل؛ لا يوجد ادعاء بأنها اجتازت الفحص.**

## الصيانة

```bash
docker compose ps
docker compose logs --tail=100 app worker
bash backup.sh
docker compose stop
docker compose start
```

لتغيير كلمة المرور، دون وضعها في سطر أوامر العملية:

```bash
read -rsp 'New password (16+ characters): ' LAB_NEW_PASSWORD
printf '%s' "$LAB_NEW_PASSWORD" | docker compose exec -T app node local/change-password.mjs
unset LAB_NEW_PASSWORD
docker compose restart app
```

يُلغي التغيير الجلسات السابقة ويحذف ملف كلمة المرور الأولية. بعد ذلك يتطلب فحص القبول كلمة المرور الحالية بدلاً من الملف الأولي؛ شغّله على تثبيت تدريبي جديد أو استدع واجهة الفحص البرمجية بهوية الاختبار.

قبل التحديث: احتفظ بنسخة احتياطية، وابنِ نسخة تجريبية منفصلة، وشغّل فحص القبول، ثم حدّث التثبيت. لا تحدّث أدوات قضية نشطة تلقائياً. النسخ الاحتياطية تحتوي أدلة وبيانات دخول ويجب حمايتها. للاستعادة إلى بيئة جديدة: أوقف التطبيق، استعد محتويات `/data` كاملة في وحدة بيانات فارغة بصلاحيات مستخدم الحاوية، ثم شغّل التطبيق وتحقق من بصمات الأدلة قبل استخدامه.

## English quick start

Install Docker Engine, Compose v2 and OpenSSL on Linux. Run `bash install.sh` from the project directory, read `/data/initial-password.txt` with the command above and open http://localhost:3210. This standalone edition uses a local account, SQLite and a file evidence store; it does not require Sites .

Create a scoped case, deposit a bounded evidence file, select an installed execution profile and run it. The isolated worker returns actual output, which is deposited automatically with a hash and custody record. Nmap inventory output additionally passes through the findings connector. Review findings and save bilingual reports from the same interface.

Fifteen profiles are implemented; two built-in profiles were executed successfully in this development environment. The remaining thirteen external Linux profiles require the included Docker acceptance test to pass before claiming a verified Linux release. Forty catalog entries do not mean forty installed programs. Current limits are 8 MiB input, 2 MiB output and 60 seconds per task. Full disk acquisition, large-image workflows, commercial Windows tools and institutional accreditation are outside this release.

See [SECURITY.md](SECURITY.md), [ARCHITECTURE-LINUX.md](ARCHITECTURE-LINUX.md), [THIRD-PARTY.md](THIRD-PARTY.md) and [CONTRIBUTING.md](CONTRIBUTING.md). Select a platform license and validate third-party redistribution requirements before public publication. The repository is prepared locally; this file does not assert that a GitHub repository or a successful CI run already exists.

