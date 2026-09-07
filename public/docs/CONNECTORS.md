# الموصلات والتقارير / Connectors and reports

## العربية

تضم المكتبة 40 أداة من مصادرها الرسمية، وثمانية تخصصات. الأدوات الخارجية تحتاج تثبيتاً وتراخيص مناسبة على مضيف التحليل؛ هذه المكتبة لا تعني أن الأدوات مثبتة على خادم الموقع.

1. أنشئ قضية وسجل التفويض والنطاق.
2. أودع ملف النتائج في خزنة الأدلة، مع المصدر والحائز. حد الدليل 8 MiB.
3. افتح الموصلات واختر القضية والملف ونوع الموصل. حد ملف الموصل 2 MiB و200 سجل. يدعم النص UTF-8.
4. عاين النتائج ثم أكد الاستيراد. يتحقق الخادم من SHA-256 ويربط السجلات بالدليل وإصدار المحلل ويمنع الاستيراد المكرر للصيغة والبصمة في القضية.
5. افتح النتائج، راجع الملاحظة وسجل سبب التأكيد أو الاستبعاد. المنافذ المفتوحة واتصالات الشبكة ملاحظات معلوماتية وليست إثبات ثغرة.
6. افتح التقارير واختر التحقيق، اختبار الاختراق، الاستجابة للحوادث، الملخص التنفيذي، الحيازة، أو المعالجة. اختر العربية أو الإنجليزية، حرر المسودة ثم احفظ نسخة مستقلة.
7. يمكن مراجعة النسخة بهوية الحساب الحالي وتنزيل Markdown وHTML للطباعة وJSON. النتائج تصدر CSV. المراجعة ليست توقيعاً قضائياً أو مراجعة مستقلة. حد التقرير 256 KiB.

## English

The catalog lists 40 external tools across eight disciplines. Provision tool execution and vendor licenses separately. Deposit an output file as evidence, select a connector, preview records and confirm import. Imported findings remain pending until an examiner records a review. Imports preserve source hashes and parser versions; repeated source/connector combinations in a case are rejected. Closing a case blocks edits.

Six bilingual report types cover forensics, pentest, incident response, executive summaries, custody and remediation. Saving creates a separate content snapshot with SHA-256. Review is attributed to the current account. Download Markdown, printable HTML or JSON; export findings as CSV. Limits: evidence 8 MiB, connector input 2 MiB UTF-8 / 200 records, saved report 256 KiB. Field lengths are bounded; retain original evidence for untruncated source data. External XML entities are rejected and no connector fetches remote content or runs commands.

| Connector | Expected input | Reference |
|---|---|---|
| Nmap | XML nmaprun / host / ports; open ports | [Nmap XML](https://nmap.org/book/output-formats-xml-output.html) |
| ZAP | JSON site array with alerts | [ZAP reports](https://www.zaproxy.org/docs/desktop/addons/report-generation/templates/) |
| SARIF | 2.1.0 runs with tool.driver and results | [OASIS SARIF](https://docs.oasis-open.org/sarif/sarif/v2.1.0/os/sarif-v2.1.0-os.html) |
| Zeek | conn JSON Lines | [Zeek logs](https://docs.zeek.org/en/current/tutorial/logs.html) |
| Volatility 3 | JSON row array; optional __children | [JSON renderer](https://volatility3.readthedocs.io/en/stable/volatility3.cli.text_renderer.html) |
| Nuclei | JSON Lines with template-id and info | [Nuclei output](https://docs.projectdiscovery.io/opensource/nuclei/running) |

Synthetic downloadable samples are available in each connector. Validation used synthetic files, not every vendor release or export configuration. Retain originals and validate representative vendor exports before operational adoption.

