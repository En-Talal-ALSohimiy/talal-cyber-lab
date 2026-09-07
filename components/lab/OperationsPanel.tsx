'use client';
import { useState, useEffect, useCallback } from 'react';
import {
  PlugZap,
  FileCheck2,
  Search,
  Download,
  CheckCircle2,
  ArrowUpRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableRow,
  TableCell,
  TableHead,
  TableHeader,
} from '@/components/ui/table';
import { CONNECTORS } from '@/lib/connector-registry.mjs';
import { REPORT_KINDS } from '@/lib/reporting.mjs';
type Api = (
  path?: string,
  body?: unknown,
  options?: RequestInit,
) => Promise<any>;
type Evidence = { id: string; name: string; case_id: string };
type Props = {
  ar: boolean;
  caseId: string;
  caseTitle: string;
  closed: boolean;
  section: string;
  evidence: Evidence[];
  api: Api;
  onRefresh: () => Promise<void>;
};
const download = (name: string, content: string, type = 'text/markdown') => {
  const url = URL.createObjectURL(
    new Blob([content], { type: `${type};charset=utf-8` }),
  );
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};
export function OperationsPanel({
  ar,
  caseId,
  caseTitle,
  closed,
  section,
  evidence,
  api,
  onRefresh,
}: Props) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [message, setMessage] = useState('');
  const [connector, setConnector] = useState('nmap-xml'),
    [evidenceId, setEvidenceId] = useState(''),
    [preview, setPreview] = useState<any>(null),
    [imports, setImports] = useState<any[]>([]);
  const [findings, setFindings] = useState<any[]>([]),
    [filter, setFilter] = useState('all'),
    [selected, setSelected] = useState<any>(null),
    [level, setLevel] = useState('info'),
    [linked, setLinked] = useState('none');
  const [reports, setReports] = useState<any[]>([]),
    [kind, setKind] = useState('forensics'),
    [draft, setDraft] = useState(''),
    [draftLang, setDraftLang] = useState(ar ? 'ar' : 'en'),
    [reportTitle, setReportTitle] = useState(''),
    [saved, setSaved] = useState<any>(null);
  const t = (a: string, b: string) => (ar ? a : b);
  const labels: Record<string, string> = {
    critical: t('حرجة', 'Critical'),
    high: t('عالية', 'High'),
    medium: t('متوسطة', 'Medium'),
    low: t('منخفضة', 'Low'),
    info: t('معلوماتية', 'Informational'),
    pending: t('بانتظار المراجعة', 'Pending review'),
    confirmed: t('مؤكدة', 'Confirmed'),
    dismissed: t('مستبعدة', 'Dismissed'),
    draft: t('مسودة محفوظة', 'Saved draft'),
    reviewed: t('تمت المراجعة', 'Reviewed'),
  };
  const errors: Record<string, string> = {
    already_imported: t(
      'تم استيراد هذا الملف بهذا الموصل سابقاً؛ راجع سجل الاستيراد.',
      'This file was already imported with this connector. Check import history.',
    ),
    invalid_connector_file: t(
      'بنية الملف لا تطابق صيغة الموصل. استخدم ملف العينة للمقارنة.',
      'File structure does not match the connector. Compare it with the sample.',
    ),
    no_import_records: t(
      'الملف صحيح لكن لا يحتوي سجلات قابلة للاستيراد.',
      'Valid file, but it contains no importable records.',
    ),
    too_many_records: t(
      'الحد 200 سجل في عملية واحدة. جهز تصديراً محدود النطاق من الأداة.',
      'Maximum 200 records per import. Export a bounded selection from the tool.',
    ),
    xml_entities_forbidden: t(
      'يرفض الموصل تعريفات XML الخارجية والكيانات المخصصة.',
      'External XML definitions and custom entities are rejected.',
    ),
    connector_file_too_large: t(
      'الحد الأعلى لملف الموصل 2 MiB.',
      'Connector file limit is 2 MiB.',
    ),
    evidence_hash_mismatch: t(
      'بصمة الدليل غير مطابقة. أوقف الاستيراد وراجع سلامة المخزن.',
      'Evidence checksum mismatch. Stop importing and investigate storage integrity.',
    ),
    case_closed: t(
      'أعد فتح القضية قبل التعديل.',
      'Reopen the case before changing records.',
    ),
    evidence_case_mismatch: t(
      'الدليل لا ينتمي إلى القضية الحالية.',
      'Evidence does not belong to this case.',
    ),
    revision_conflict: t(
      'تغير السجل. حدّثه قبل المراجعة مجدداً.',
      'Record changed. Refresh it before reviewing again.',
    ),
    already_reviewed: t(
      'هذه النسخة تمت مراجعتها بالفعل.',
      'This snapshot has already been reviewed.',
    ),
    report_too_large: t(
      'التقرير يتجاوز 256 KiB. اختصر محتواه مع الحفاظ على مراجع الأدلة.',
      'Report exceeds 256 KiB. Reduce content while preserving evidence references.',
    ),
    report_hash_mismatch: t(
      'بصمة التقرير غير مطابقة؛ تعذرت المراجعة.',
      'Report checksum mismatch; review rejected.',
    ),
  };
  const reload = useCallback(async () => {
    if (!caseId) return;
    const [f, i, r] = await Promise.all([
      api(`cases/${caseId}/findings`),
      api(`cases/${caseId}/imports`),
      api(`cases/${caseId}/reports`),
    ]);
    setFindings(f.items);
    setImports(i.items);
    setReports(r.items);
  }, [api, caseId]);
  useEffect(() => {
    reload().catch((e) => setError(e.message));
  }, [reload]);
  useEffect(() => {
    setPreview(null);
  }, [connector, evidenceId]);
  async function run(fn: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await fn();
      await reload();
      await onRefresh();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  const success = () => setMessage(t('تم حفظ العملية.', 'Operation saved.'));
  if (!caseId)
    return (
      <section className="panel empty">
        {t(
          'أنشئ قضية أو اختر قضية نشطة أولاً.',
          'Create or select an active case first.',
        )}
      </section>
    );
  return (
    <section className="panel operations">
      <div className="section-title">
        <div>
          <small>
            {section === 'connectors'
              ? 'CONNECTOR HUB'
              : section === 'findings'
                ? 'FINDING WORKBENCH'
                : 'REPORT STUDIO'}
          </small>
          <h2>
            {section === 'connectors'
              ? t('موصلات النتائج', 'Results connectors')
              : section === 'findings'
                ? t('النتائج والمراجعة', 'Findings & review')
                : t('استوديو التقارير', 'Report studio')}
          </h2>
        </div>
        <span className="badge">{caseTitle}</span>
      </div>
      <div role="status" aria-live="polite">
        {busy ? t('جارٍ التنفيذ…', 'Working…') : message}
      </div>
      {error && (
        <p role="alert" className="error">
          {errors[error] ||
            t(
              'تعذر إكمال الطلب. تحقق من الحقول والصلاحية والاتصال.',
              'Request failed. Check fields, authorization and connectivity.',
            )}
        </p>
      )}
      {section === 'connectors' && (
        <>
          <p>
            {t(
              'أودع ملف النتائج في الأدلة أولاً، ثم اختر الموصل وعاين السجلات. تُحفظ النتائج المستوردة كملاحظات تحتاج مراجعة، مع مرجع الدليل وإصدار المحلل.',
              'Deposit a results file as evidence, choose its connector and preview the records. Imported observations require review and retain the evidence reference and parser version.',
            )}
          </p>
          <div className="connector-grid">
            {CONNECTORS.map((c) => (
              <button
                key={c.id}
                className={
                  'connector-card ' + (connector === c.id ? 'selected' : '')
                }
                onClick={() => setConnector(c.id)}
                aria-pressed={connector === c.id}
              >
                <PlugZap size={22} />
                <strong>{c.name}</strong>
                <span>{ar ? c.ar : c.en}</span>
                <small>{c.format}</small>
              </button>
            ))}
          </div>
          <div className="import-controls">
            <label>
              {t('ملف الدليل', 'Evidence file')}
              <Select
                value={evidenceId}
                onValueChange={(v) => setEvidenceId(v || '')}
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={t(
                      'اختر الملف المودع',
                      'Select a deposited file',
                    )}
                  />
                </SelectTrigger>
                <SelectContent>
                  {evidence.map((e) => (
                    <SelectItem value={e.id} key={e.id}>
                      {e.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>
            <Button
              disabled={busy || !evidenceId || closed}
              onClick={() =>
                run(async () =>
                  setPreview(
                    await api(`cases/${caseId}/imports/preview`, {
                      connector,
                      evidenceId,
                    }),
                  ),
                )
              }
            >
              <Search size={16} />
              {t('معاينة النتائج', 'Preview results')}
            </Button>
            <a
              className="link"
              href={`/samples/${connector}.${connector === 'nmap-xml' ? 'xml' : connector.endsWith('jsonl') ? 'jsonl' : 'json'}`}
              download
            >
              {t('ملف عينة اصطناعي', 'Synthetic sample')}
            </a>
          </div>
          {preview && (
            <div className="import-preview">
              <div className="flex">
                <h3>
                  {t('سجلات جاهزة للاستيراد', 'Records ready to import')}:{' '}
                  {preview.count}
                </h3>
                <Button
                  disabled={busy || !preview.count || closed}
                  onClick={() =>
                    run(async () => {
                      const r = await api(`cases/${caseId}/imports`, {
                        connector,
                        evidenceId,
                      });
                      setPreview(null);
                      setMessage(
                        t(
                          `تم استيراد ${r.count} سجلاً للمراجعة.`,
                          `${r.count} records imported for review.`,
                        ),
                      );
                    })
                  }
                >
                  {t('تأكيد الاستيراد', 'Confirm import')}
                </Button>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('النتيجة', 'Result')}</TableHead>
                    <TableHead>{t('الأصل', 'Asset')}</TableHead>
                    <TableHead>{t('الشدة', 'Severity')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {preview.records.slice(0, 20).map((r: any, i: number) => (
                    <TableRow key={i}>
                      <TableCell>{r.title}</TableCell>
                      <TableCell>{r.asset}</TableCell>
                      <TableCell>
                        <span className={`severity ${r.severity}`}>
                          {labels[r.severity]}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {preview.count > 20 && (
                <p>
                  {t(
                    'تعرض المعاينة أول 20 سجلاً؛ يستورد التأكيد جميع السجلات.',
                    'Preview shows the first 20 records; confirmation imports all records.',
                  )}
                </p>
              )}
              <small className="hash">SHA-256: {preview.sourceSha256}</small>
            </div>
          )}
          <h3>{t('سجل الاستيراد', 'Import history')}</h3>
          {imports.length ? (
            imports.map((i) => (
              <div className="task-row" key={i.id}>
                <div>
                  <strong>
                    {CONNECTORS.find((c) => c.id === i.connector)?.name}
                  </strong>
                  <small>
                    {i.created} · parser {i.parser_version}
                  </small>
                  <span className="hash">{i.source_sha256}</span>
                </div>
                <span className="badge">
                  {i.count} {t('سجل', 'records')}
                </span>
              </div>
            ))
          ) : (
            <div className="empty">
              {t(
                'لا توجد عمليات استيراد في هذه القضية.',
                'No imports in this case.',
              )}
            </div>
          )}
        </>
      )}
      {section === 'findings' && (
        <>
          <div className="flex">
            <label>
              {t('عرض النتائج', 'Show findings')}
              <Select
                value={filter}
                onValueChange={(v) => setFilter(v || 'all')}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">
                    {t('كل النتائج', 'All findings')}
                  </SelectItem>
                  {['pending', 'confirmed', 'dismissed'].map((s) => (
                    <SelectItem key={s} value={s}>
                      {labels[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>
            <a className="link" href={`/api/lab/cases/${caseId}/findings/csv`}>
              <Download size={16} />
              {t('تنزيل CSV', 'Export CSV')}
            </a>
          </div>
          <div className="split finding-layout">
            <div className="finding-list">
              {findings
                .filter((f) => filter === 'all' || f.status === filter)
                .map((f) => (
                  <button
                    className={
                      'finding-card ' +
                      (selected?.id === f.id ? 'selected' : '')
                    }
                    key={f.id}
                    onClick={() => setSelected(f)}
                  >
                    <div className="flex">
                      <span className={`severity ${f.severity}`}>
                        {labels[f.severity]}
                      </span>
                      <small>{labels[f.status]}</small>
                    </div>
                    <strong>{f.title}</strong>
                    <span>{f.asset}</span>
                  </button>
                ))}
              {!findings.length && (
                <div className="empty">
                  {t(
                    'استورد نتائج أداة أو أضف نتيجة يدوياً.',
                    'Import tool results or add a finding manually.',
                  )}
                </div>
              )}
            </div>
            <div>
              {selected ? (
                <div className="finding-detail">
                  <div className="section-title">
                    <h3>{selected.title}</h3>
                    <Button variant="ghost" onClick={() => setSelected(null)}>
                      {t('نتيجة جديدة', 'New finding')}
                    </Button>
                  </div>
                  <p className="prewrap">{selected.description}</p>
                  <p>
                    {t('المعالجة', 'Remediation')}:{' '}
                    {selected.recommendation || '—'}
                  </p>
                  <small className="hash">
                    {t('مرجع الدليل', 'Evidence')}:{' '}
                    {selected.evidence_id || '—'}
                  </small>
                  {selected.review_note && (
                    <blockquote>{selected.review_note}</blockquote>
                  )}
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      const f = new FormData(e.currentTarget),
                        state =
                          (
                            e.nativeEvent as SubmitEvent
                          ).submitter?.getAttribute('data-state') || 'pending';
                      run(async () => {
                        await api(`findings/${selected.id}`, {
                          status: state,
                          note: f.get('note'),
                          revision: selected.revision,
                        });
                        setSelected(null);
                        success();
                      });
                    }}
                  >
                    <label>
                      {t(
                        'ملاحظة التحقق والمراجعة',
                        'Validation and review note',
                      )}
                      <Textarea name="note" required maxLength={4000} />
                    </label>
                    <div className="flex">
                      <Button
                        type="submit"
                        data-state="confirmed"
                        disabled={busy || closed}
                      >
                        {t('تأكيد النتيجة', 'Confirm finding')}
                      </Button>
                      <Button
                        type="submit"
                        data-state="dismissed"
                        variant="outline"
                        disabled={busy || closed}
                      >
                        {t('استبعاد مع سبب', 'Dismiss with reason')}
                      </Button>
                      <Button
                        type="submit"
                        data-state="pending"
                        variant="ghost"
                        disabled={busy || closed}
                      >
                        {t('إعادة للمراجعة', 'Reopen review')}
                      </Button>
                    </div>
                  </form>
                </div>
              ) : (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const form = e.currentTarget,
                      f = new FormData(form);
                    run(async () => {
                      await api(`cases/${caseId}/findings`, {
                        title: f.get('title'),
                        asset: f.get('asset'),
                        description: f.get('description'),
                        recommendation: f.get('recommendation'),
                        severity: level,
                        evidenceId: linked === 'none' ? null : linked,
                      });
                      form.reset();
                      success();
                    });
                  }}
                >
                  <h3>{t('إضافة نتيجة يدوية', 'Add manual finding')}</h3>
                  <label>
                    {t('العنوان', 'Title')}
                    <Input name="title" required maxLength={300} />
                  </label>
                  <label>
                    {t('الأصل المتأثر', 'Affected asset')}
                    <Input name="asset" maxLength={1000} />
                  </label>
                  <label>
                    {t('الشدة', 'Severity')}
                    <Select
                      value={level}
                      onValueChange={(v) => setLevel(v || 'info')}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {['critical', 'high', 'medium', 'low', 'info'].map(
                          (s) => (
                            <SelectItem value={s} key={s}>
                              {labels[s]}
                            </SelectItem>
                          ),
                        )}
                      </SelectContent>
                    </Select>
                  </label>
                  <label>
                    {t(
                      'الوصف والدليل الداعم',
                      'Description and supporting evidence',
                    )}
                    <Textarea name="description" required maxLength={6000} />
                  </label>
                  <label>
                    {t('التوصية', 'Recommendation')}
                    <Textarea name="recommendation" maxLength={4000} />
                  </label>
                  <label>
                    {t('ربط بدليل محفوظ', 'Link to stored evidence')}
                    <Select
                      value={linked}
                      onValueChange={(v) => setLinked(v || 'none')}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">
                          {t('دون ربط', 'No link')}
                        </SelectItem>
                        {evidence.map((e) => (
                          <SelectItem key={e.id} value={e.id}>
                            {e.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </label>
                  <Button type="submit" disabled={busy || closed}>
                    {t('حفظ للمراجعة', 'Save for review')}
                  </Button>
                </form>
              )}
            </div>
          </div>
        </>
      )}
      {section === 'reports' && (
        <>
          <p>
            {t(
              'ستة أنواع تقارير، بالعربية والإنجليزية. تحفظ كل عملية إصدار نسخة مستقلة ببصمة SHA-256؛ ويمكن فتح النسخ السابقة ومراجعتها وتنزيلها.',
              'Six report types in Arabic and English. Each save creates a separate SHA-256 snapshot; previous snapshots can be reopened, reviewed and downloaded.',
            )}
          </p>
          <div className="report-kinds">
            {REPORT_KINDS.map((k) => (
              <button
                key={k.id}
                className={kind === k.id ? 'selected' : ''}
                onClick={() => {
                  setKind(k.id);
                  setDraft('');
                  setSaved(null);
                }}
                aria-pressed={kind === k.id}
              >
                <FileCheck2 size={20} />
                {ar ? k.ar : k.en}
              </button>
            ))}
          </div>
          <div className="import-controls">
            <label>
              {t('لغة التقرير', 'Report language')}
              <Select
                value={draftLang}
                onValueChange={(v) => {
                  setDraftLang(v || 'ar');
                  setDraft('');
                  setSaved(null);
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ar">العربية</SelectItem>
                  <SelectItem value="en">English</SelectItem>
                </SelectContent>
              </Select>
            </label>
            <Button
              disabled={busy}
              onClick={() =>
                run(async () => {
                  const r = await api(
                    `cases/${caseId}/reports/draft?kind=${kind}&lang=${draftLang}`,
                  );
                  setDraft(r.markdown);
                  setReportTitle(
                    `${caseTitle} — ${REPORT_KINDS.find((k) => k.id === kind)?.[draftLang === 'ar' ? 'ar' : 'en']}`,
                  );
                  setSaved(null);
                })
              }
            >
              {t('إعداد مسودة من السجلات', 'Prepare draft from records')}
            </Button>
          </div>
          {draft && (
            <div className="report-editor">
              <label>
                {t('عنوان النسخة', 'Snapshot title')}
                <Input
                  value={reportTitle}
                  onChange={(e) => {setReportTitle(e.target.value);setSaved(null);}}
                  maxLength={300}
                />
              </label>
              <label>
                {t(
                  'محتوى التقرير — احفظ نسخة قبل مغادرة القسم',
                  'Report content — save a snapshot before leaving',
                )}
                <Textarea
                  dir={draftLang === 'ar' ? 'rtl' : 'ltr'}
                  className="report"
                  value={draft}
                  onChange={(e) => {
                    setDraft(e.target.value);
                    setSaved(null);
                  }}
                />
              </label>
              <div className="flex">
                <Button
                  disabled={busy || closed || !reportTitle.trim()}
                  onClick={() =>
                    run(async () => {
                      const r = await api(`cases/${caseId}/reports`, {
                        title: reportTitle,
                        kind,
                        language: draftLang,
                        markdown: draft,
                      });
                      setSaved(await api(`reports/${r.id}`));
                      success();
                    })
                  }
                >
                  {t('حفظ نسخة جديدة', 'Save new snapshot')}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => download(`talal-${caseId}-${kind}.md`, draft)}
                >
                  <Download size={16} />
                  Markdown
                </Button>
                {saved && (
                  <>
                    <a
                      className="link"
                      href={`/api/lab/reports/${saved.id}/html`}
                    >
                      {t('نسخة HTML للطباعة', 'Print-ready HTML')}
                    </a>
                    <Button
                      variant="ghost"
                      onClick={() =>
                        download(
                          `report-${saved.id}.json`,
                          JSON.stringify(saved, null, 2),
                          'application/json',
                        )
                      }
                    >
                      JSON
                    </Button>
                  </>
                )}
              </div>
              {saved && (
                <>
                  <p>
                    <CheckCircle2 size={18} className="inline" />{' '}
                    {saved.valid
                      ? t('بصمة النسخة مطابقة', 'Snapshot checksum verified')
                      : t(
                          'اختلاف بصمة النسخة',
                          'Snapshot checksum mismatch',
                        )}{' '}
                    · {labels[saved.status]}
                  </p>
                  <small className="hash">{saved.sha256}</small>
                  {saved.status === 'draft' && (
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        const f = new FormData(e.currentTarget);
                        run(async () => {
                          await api(`reports/${saved.id}/review`, {
                            note: f.get('note'),
                          });
                          setSaved(await api(`reports/${saved.id}`));
                          success();
                        });
                      }}
                    >
                      <label>
                        {t(
                          'ملاحظة مراجعة هذه النسخة',
                          'Review note for this snapshot',
                        )}
                        <Textarea name="note" required maxLength={4000} />
                      </label>
                      <p>
                        {t(
                          'تسجل المراجعة بهوية حسابك الحالي؛ ليست توقيعاً قضائياً أو مراجعة مستقلة من شخص آخر.',
                          'Review is attributed to your current account; it is not a legal signature or an independent second-person review.',
                        )}
                      </p>
                      <Button type="submit" disabled={busy || closed}>
                        {t('تسجيل المراجعة', 'Record review')}
                      </Button>
                    </form>
                  )}
                </>
              )}
            </div>
          )}
          <h3>{t('النسخ المحفوظة', 'Saved snapshots')}</h3>
          {reports.length ? (
            reports.map((r) => (
              <div className="task-row" key={r.id}>
                <div>
                  <strong>{r.title}</strong>
                  <small>
                    {r.created} · {r.language.toUpperCase()} ·{' '}
                    {labels[r.status]}
                  </small>
                </div>
                <Button
                  variant="outline"
                  disabled={busy}
                  onClick={() =>
                    run(async () => {
                      const record = await api(`reports/${r.id}`);
                      setSaved(record);
                      setDraft(record.markdown);
                      setDraftLang(record.language);
                      setKind(record.kind);
                      setReportTitle(record.title);
                    })
                  }
                >
                  {t('فتح النسخة', 'Open snapshot')}
                  <ArrowUpRight size={16} />
                </Button>
              </div>
            ))
          ) : (
            <div className="empty">
              {t(
                'لم تحفظ تقارير لهذه القضية بعد.',
                'No report snapshots saved for this case yet.',
              )}
            </div>
          )}
        </>
      )}
    </section>
  );
}

