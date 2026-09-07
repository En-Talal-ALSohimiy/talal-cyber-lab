export const REPORT_KINDS = [
  { id: 'forensics', ar: 'تحقيق جنائي رقمي', en: 'Digital forensics' },
  { id: 'pentest', ar: 'اختبار أمان', en: 'Security assessment' },
  { id: 'incident', ar: 'استجابة للحوادث', en: 'Incident response' },
  { id: 'executive', ar: 'ملخص تنفيذي', en: 'Executive summary' },
  { id: 'custody', ar: 'سلسلة الحيازة', en: 'Chain of custody' },
  { id: 'remediation', ar: 'خطة المعالجة', en: 'Remediation plan' },
];
export function mdText(value) {
  return String(value ?? '')
    .replace(/[\r\n]+/g, ' ')
    .replace(/([\\`*_{}\[\]()#+!|<>])/g, '\\$1');
}
export function findingsCsv(items) {
  const safe = (v) => {
    let s = String(v ?? '');
    if (/^[\s]*[=+\-@]/.test(s) || /^[\t\r\n]/.test(s)) s = "'" + s;
    return '"' + s.replace(/"/g, '""') + '"';
  };
  const cols = [
    'id',
    'title',
    'asset',
    'severity',
    'status',
    'description',
    'recommendation',
    'evidence_id',
    'review_note',
  ];
  return (
    '\uFEFF' +
    [
      cols.join(','),
      ...items.map((r) => cols.map((k) => safe(r[k])).join(',')),
    ].join('\r\n')
  );
}
export function renderReport(
  kind,
  language,
  c,
  es,
  ts,
  cs,
  fs,
  created = new Date().toISOString(),
) {
  const ar = language === 'ar',
    t = (a, b) => (ar ? a : b),
    s = mdText,
    k = REPORT_KINDS.find((x) => x.id === kind);
  if (!k) throw new Error('invalid_report_kind');
  const title = k[ar ? 'ar' : 'en'];
  const counts = ['critical', 'high', 'medium', 'low', 'info']
    .map(
      (level) =>
        `${level}: ${fs.filter((f) => f.severity === level && f.status !== 'dismissed').length}`,
    )
    .join(' · ');
  const statusLabel = (v) =>
    ({
      pending: t('بانتظار المراجعة', 'Pending review'),
      confirmed: t('مؤكدة بواسطة المستخدم', 'User confirmed'),
      dismissed: t('مستبعدة', 'Dismissed'),
    })[v] || v;
  let out =
    `# ${t('مختبر طلال السيبراني', 'Talal Cyber Lab')} — ${title}\n\n` +
    `**${t('مسودة موثقة — ليست توقيعاً قضائياً', 'Recorded draft — not a legal signature')}**\n\n` +
    `${t('القضية', 'Case')}: ${s(c.title)}\n\nID: ${c.id}\n\nUTC: ${created}\n\n` +
    `## ${t('التفويض والنطاق', 'Authorization and scope')}\n\n${s(c.scope)}\n\n`;
  if (kind !== 'custody') {
    out += `## ${t('ملخص التغطية', 'Coverage summary')}\n\n${t('الأدلة', 'Evidence')}: ${es.length} · ${t('النتائج', 'Findings')}: ${fs.length} · ${t('المهام', 'Tasks')}: ${ts.length}\n\n${counts}\n\n`;
    out += `${t('الشدة مستوردة من الأداة أو مسجلة بواسطة المحقق؛ لا تثبت وحدها وقوع اختراق. النتائج المعلقة تحتاج تحققاً بشرياً.', 'Severity comes from the tool or examiner and does not by itself prove compromise. Pending findings require human validation.')}\n\n`;
  }
  if (['incident', 'executive'].includes(kind))
    out += `## ${t('الأثر والقرارات', 'Impact and decisions')}\n\n${t('[يستكمل المحقق الأثر المثبت، فترة الحادث، القرارات، مسؤول الاستجابة والأصول المتأثرة.]', '[Complete verified impact, incident window, decisions, response owner and affected assets.]')}\n\n`;
  if (kind !== 'custody') {
    out += `## ${t('سجل النتائج', 'Findings register')}\n\n`;
    for (const f of fs) {
      out += `### ${s(f.title)}\n\n${t('الشدة', 'Severity')}: ${s(f.severity)} · ${t('الحالة', 'Status')}: ${statusLabel(f.status)}\n\n${t('الأصل', 'Asset')}: ${s(f.asset)}\n\n${t('مرجع الدليل', 'Evidence reference')}: ${f.evidence_id || t('لم يربط دليل', 'No linked evidence')}\n\n`;
      if (kind !== 'executive') out += `${s(f.description)}\n\n`;
      out += `${t('المعالجة', 'Remediation')}: ${s(f.recommendation) || t('لم تسجل', 'Not recorded')}\n\n${t('ملاحظة المراجعة', 'Review note')}: ${s(f.review_note)}\n\n`;
    }
  }
  if (kind === 'remediation')
    out +=
      `## ${t('التكليف وإعادة الاختبار', 'Assignment and retest')}\n\n| ${t('المهمة', 'Task')} | ${t('المسؤول', 'Assignee')} | ${t('الحالة', 'Status')} |\n|---|---|---|\n` +
      ts
        .map(
          (x) =>
            `|${s(x.title)}|${s(x.assignee)}|${x.status === 'done' ? t('مكتملة', 'Done') : t('مفتوحة', 'Open')}|`,
        )
        .join('\n') +
      '\n\n';
  if (kind !== 'executive')
    out +=
      `## ${t('قائمة الأدلة', 'Evidence manifest')}\n\n| ID | ${t('الاسم', 'Name')} | Bytes | SHA-256 |\n|---|---|---:|---|\n` +
      es.map((e) => `|${e.id}|${s(e.name)}|${e.size}|${e.sha256}|`).join('\n') +
      '\n\n';
  if (['forensics', 'custody', 'incident'].includes(kind))
    out +=
      `## ${t('سلسلة الحيازة', 'Custody history')}\n\n| UTC | ${t('الدليل', 'Evidence')} | ${t('من', 'From')} | ${t('إلى', 'To')} | ${t('السبب', 'Reason')} |\n|---|---|---|---|---|\n` +
      cs
        .map(
          (x) =>
            `|${x.time}|${x.evidence_id}|${s(x.from_name)}|${s(x.to_name)}|${s(x.reason)}|`,
        )
        .join('\n') +
      '\n\n';
  out +=
    `## ${t('المنهجية والقيود', 'Methodology and limitations')}\n\n${t('[يسجل المحقق إصدارات الأدوات وإعداداتها، أدلة التحقق، فروق التوقيت، الفرضيات البديلة والأجزاء التي لم تفحص.]', '[Record tool versions and settings, validation evidence, clock offsets, alternative explanations and unexamined areas.]')}\n\n` +
    `${t('تصميم وتطوير م. طلال فواز السحيمي', 'Designed and developed by Eng. Talal Fawaz Al-Suhaimi')}\n\nhttps://talalsuhaimi.com · talal@talalsuhaimi.com\n`;
  return out;
}

