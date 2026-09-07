'use client';
import { useCallback, useEffect, useState } from 'react';
import {
  ShieldCheck,
  FolderSearch,
  Fingerprint,
  Activity,
  ArrowUpRight,
  LockKeyhole,
  Download,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import {
  Table,
  TableHeader,
  TableHead,
  TableRow,
  TableBody,
  TableCell,
} from '@/components/ui/table';

import { ToolLibrary } from '@/components/lab/ToolLibrary';
import { OperationsPanel } from '@/components/lab/OperationsPanel';
import catalog from '@/lib/tool-catalog.json';
import { ExecutionPanel } from '@/components/lab/ExecutionPanel';
type Case = {
  id: string;
  title: string;
  scope: string;
  type: string;
  status: string;
  created: string;
};
type Evidence = {
  id: string;
  case_id: string;
  name: string;
  source: string;
  custodian: string;
  size: number;
  sha256: string;
  created: string;
};
type Task = {
  id: string;
  case_id: string;
  title: string;
  assignee: string;
  status: string;
};
type Data = {
  cases: Case[];
  evidence: Evidence[];
  tasks: Task[];
  user: string;
};
const empty: Data = { cases: [], evidence: [], tasks: [], user: '' };
const actions: Record<string, [string, string]> = {
  'case.created': ['إنشاء قضية', 'Case created'],
  'case.status': ['تغيير حالة القضية', 'Case status changed'],
  'task.created': ['إنشاء مهمة', 'Task created'],
  'task.status': ['تغيير حالة المهمة', 'Task status changed'],
  'evidence.received': ['استلام دليل', 'Evidence received'],
  'evidence.downloaded': ['تنزيل دليل', 'Evidence downloaded'],
  'evidence.verified': ['التحقق من البصمة', 'Hash verified'],
  'custody.transferred': ['انتقال حيازة', 'Custody transferred'],
  'report.exported': ['تصدير تقرير', 'Report exported'],
};
function saveFile(name: string, text: string, type = 'text/markdown') {
  const u = URL.createObjectURL(
    new Blob([text], { type: `${type};charset=utf-8` }),
  );
  const a = document.createElement('a');
  a.href = u;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(u), 1000);
}
async function call(path = '', body?: unknown, options?: RequestInit) {
  const r = await fetch(
    `/api/lab/${path}`,
    options || {
      method: body === undefined ? 'GET' : 'POST',
      headers:
        body === undefined
          ? {}
          : { 'content-type': 'application/json', 'x-lab-action': '1' },
      body: body === undefined ? undefined : JSON.stringify(body),
    },
  );
  const j: any = await r.json();
  if (!r.ok) throw new Error(j.error || 'internal_error');
  return j;
}
export default function Home() {
  const [ar, setAr] = useState(true),
    [data, setData] = useState<Data>(empty),
    [selected, setSelected] = useState(''),
    [tab, setTab] = useState('cases'),
    [busy, setBusy] = useState(false),
    [loaded, setLoaded] = useState(false),
    [error, setError] = useState(''),
    [message, setMessage] = useState(''),
    [query, setQuery] = useState(''),
    [kind, setKind] = useState('forensics'),
    [report, setReport] = useState(''),
    [audit, setAudit] = useState<any>(null),
    [custody, setCustody] = useState<any[]>([]),
    [transfer, setTransfer] = useState<Evidence | null>(null);
  const t = (a: string, b: string) => (ar ? a : b);
  const current = data.cases.find((c) => c.id === selected),
    es = data.evidence.filter((e) => e.case_id === selected),
    ts = data.tasks.filter((t) => t.case_id === selected);
  const refresh = useCallback(async () => {
    const d = await call();
    setData(d);
    setSelected((prev) =>
      d.cases.some((c: Case) => c.id === prev) ? prev : d.cases[0]?.id || '',
    );
    setLoaded(true);
  }, []);
  useEffect(() => {
    refresh().catch((e) => {
      setError(e.message);
      setLoaded(true);
    });
  }, [refresh]);
  useEffect(() => {
    document.documentElement.lang = ar ? 'ar' : 'en';
    document.documentElement.dir = ar ? 'rtl' : 'ltr';
  }, [ar]);
  useEffect(() => {
    setReport('');
    setTransfer(null);
    setCustody([]);
  }, [selected]);
  useEffect(() => {
    const ctx = (document as any).modelContext;
    if (!ctx?.registerTool) return;
    const controller = new AbortController();
    Promise.resolve(
      ctx.registerTool(
        {
          name: 'list_lab_cases',
          title: 'List laboratory cases',
          description:
            'Read case identifiers, titles and status visible to the current signed-in user.',
          inputSchema: {
            type: 'object',
            properties: {},
            additionalProperties: false,
          },
          annotations: { readOnlyHint: true, untrustedContentHint: true },
          async execute(input: unknown) {
            if (
              !input ||
              typeof input !== 'object' ||
              Object.keys(input).length
            )
              throw new Error('Expected an empty object');
            const d = await call();
            setData(d);
            return {
              cases: d.cases.map((c: Case) => ({
                id: c.id,
                title: c.title,
                status: c.status,
              })),
            };
          },
        },
        { signal: controller.signal },
      ),
    ).catch(() => {});
    return () => controller.abort();
  }, []);
  const errors: Record<string, string> = {
    sign_in_required: t(
      'سجل الدخول إلى نسختك المحلية.',
      'Sign in to your local installation.',
    ),
    storage_unavailable: t(
      'التخزين غير متاح. راجع إعداد البيئة والترحيل.',
      'Storage unavailable. Check bindings and migrations.',
    ),
    case_closed: t(
      'القضية مغلقة. أعد فتحها قبل التعديل.',
      'Reopen the closed case before editing.',
    ),
    open_tasks: t(
      'أكمل المهام المفتوحة قبل إغلاق القضية.',
      'Complete open tasks before closing the case.',
    ),
    file_too_large: t('الحد الأقصى للملف 8 MiB.', 'Maximum file size is 8 MiB.'),
    empty_file: t('لا يمكن إيداع ملف فارغ.', 'Empty files cannot be deposited.'),
    custody_conflict: t(
      'تغير الحائز. حدّث الصفحة وراجع الانتقال.',
      'Custodian changed. Refresh and review the transfer.',
    ),
    invalid_field: t(
      'تحقق من الحقول المطلوبة وحدود الطول.',
      'Check required fields and length limits.',
    ),
    not_found: t(
      'السجل غير موجود أو غير متاح لحسابك.',
      'Record not found or not available to your account.',
    ),
    internal_error: t(
      'تعذر إكمال العملية. حدّث البيانات قبل المحاولة مجدداً.',
      'Operation failed. Refresh data before retrying.',
    ),
    origin_rejected: t('تم رفض مصدر الطلب.', 'Request origin rejected.'),
    request_rejected: t('تم رفض الطلب.', 'Request rejected.'),
    object_missing: t(
      'ملف الدليل غير موجود في المخزن.',
      'Evidence object is missing from storage.',
    ),
  };
  async function run(fn: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await fn();
      await refresh();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  const ok = () => setMessage(t('تم حفظ العملية.', 'Operation saved.'));
  const casePicker = (
    <label>
      {t('القضية النشطة', 'Active case')}
      <Select value={selected} onValueChange={(v) => setSelected(v || '')}>
        <SelectTrigger className="w-full">
          <SelectValue placeholder={t('اختر قضية', 'Select a case')} />
        </SelectTrigger>
        <SelectContent>
          {data.cases.map((c) => (
            <SelectItem value={c.id} key={c.id}>
              {c.title}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </label>
  );
  const requireCase = (
    <div className="empty">
      {t(
        'أنشئ قضية أولاً من مساحة القضايا.',
        'Create a case in the case workspace first.',
      )}
    </div>
  );
  return (
    <main dir={ar ? 'rtl' : 'ltr'} className="lab">
      <header>
        <div className="brand">
          <img
            src="/brand/talal-cyber-mark.png"
            className="brand-mark"
            alt="Talal Cyber Lab"
          />
          <div>
            <strong>{t('مختبر طلال السيبراني', 'Talal Cyber Lab')}</strong>
            <small>FORENSICS / SECURITY OPERATIONS</small>
          </div>
        </div>
        <div className="flex">
          <span className="badge">
            <LockKeyhole size={14} className="inline" />{' '}
            {t('مساحة خاصة', 'Private workspace')}
          </span>
          <Button variant="outline" onClick={() => setAr(!ar)}>
            {ar ? 'English' : 'العربية'}
          </Button>
        </div>
      </header>
      <section className="intro">
        <img src="/brand/talal-cyber-mark.png" className="hero-mark" alt="" />
        <p className="eyebrow">TALAL CYBER LAB / LINUX EDITION</p>
        <div className="capabilities">
          <span>
            {catalog.tools.length} {t('أداة في المكتبة', 'catalog tools')}
          </span>
          <span>6 {t('موصلات نتائج', 'results connectors')}</span>
          <span>6 {t('أنواع تقارير', 'report types')}</span>
        </div>
        <h1>
          {t(
            'دقة الدليل. وضوح القرار.',
            'Evidence in focus. Decisions with clarity.',
          )}
        </h1>
        <p>
          {t(
            'من جمع الأدلة إلى مراجعة النتائج وإصدار التقارير.',
            'From evidence collection to findings review and reporting.',
          )}
        </p>
      </section>
      <div className="metrics">
        {[
          {
            Icon: FolderSearch,
            label: t('القضايا المفتوحة', 'Open cases'),
            n: data.cases.filter((c) => c.status === 'open').length,
          },
          {
            Icon: Fingerprint,
            label: t('الأدلة المحفوظة', 'Stored evidence'),
            n: data.evidence.length,
          },
          {
            Icon: Activity,
            label: t('المهام قيد العمل', 'Open tasks'),
            n: data.tasks.filter((t) => t.status === 'open').length,
          },
        ].map(({ Icon, label, n }) => (
          <article key={label}>
            <Icon />
            <span>{label}</span>
            <strong>{loaded ? n : '—'}</strong>
          </article>
        ))}
      </div>
      <div className="notice">
        {t(
          'نسخة Linux للتحليل المحدود: حد الدليل 8 MiB. افتح تشغيل الأدوات لفحص اتصال العامل وجاهزية البرامج المثبتة.',
          'Linux bounded analysis edition: evidence limit 8 MiB. Open Run tools to check worker connectivity and installed executables.',
        )}
      </div>
      {error === 'sign_in_required' && (
        <a className="link" href="/login" target="_top">
          {t('تسجيل الدخول إلى المختبر', 'Sign in to the laboratory')}
        </a>
      )}
      <div role="status" aria-live="polite">
        {busy ? t('جارٍ تنفيذ العملية…', 'Working…') : message}
      </div>
      {error && (
        <div role="alert" className="error">
          {errors[error] ||
            t(
              'تعذر إكمال الطلب. راجع الاتصال والحقول ثم أعد المحاولة.',
              'Request failed. Check the connection and fields, then retry.',
            )}
          <Button variant="ghost" disabled={busy} onClick={() => run(refresh)}>
            {t('تحديث', 'Refresh')}
          </Button>
        </div>
      )}
      <Tabs
        value={tab}
        onValueChange={(v) => {
          setTab(String(v));
          setMessage('');
        }}
      >
        <TabsList variant="line" className="lab-tabs">
          {[
            ['cases', 'القضايا', 'Cases'],
            ['evidence', 'الأدلة', 'Evidence'],
            ['tasks', 'المهام', 'Tasks'],
            ['execution', 'تشغيل الأدوات', 'Run tools'],
            ['connectors', 'الموصلات', 'Connectors'],
            ['findings', 'النتائج', 'Findings'],
            ['reports', 'التقارير', 'Reports'],
            ['tools', 'الأدوات والبيئة', 'Tools & lab'],
            ['audit', 'التدقيق', 'Audit'],
            ['guide', 'الدليل', 'Guide'],
            ['developer', 'المطور', 'Developer'],
          ].map(([v, a, b]) => (
            <TabsTrigger value={v} key={v}>
              {t(a, b)}
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value="cases">
          <div className="split">
            <section className="panel">
              <div className="flex">
                <h2>{t('مساحة القضايا', 'Case workspace')}</h2>
                <span className="badge">{data.cases.length}</span>
              </div>
              <label>
                {t('بحث في القضايا', 'Search cases')}
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={t('اسم القضية أو معرفها', 'Case title or ID')}
                />
              </label>
              <div className="case-list">
                {data.cases
                  .filter((c) =>
                    (c.title + c.id)
                      .toLowerCase()
                      .includes(query.toLowerCase()),
                  )
                  .map((c) => (
                    <button
                      key={c.id}
                      aria-pressed={selected === c.id}
                      onClick={() => setSelected(c.id)}
                    >
                      <strong>{c.title}</strong>
                      <span className="badge" style={{ marginInlineStart: 12 }}>
                        {c.status === 'open'
                          ? t('مفتوحة', 'Open')
                          : t('مغلقة', 'Closed')}
                      </span>
                      <small className="hash">{c.id}</small>
                    </button>
                  ))}
              </div>
              {!data.cases.length && (
                <div className="empty">
                  {t(
                    'لا توجد قضايا بعد. أنشئ أول قضية وحدد التفويض.',
                    'No cases yet. Create your first case and record its authorization.',
                  )}
                </div>
              )}
              {current && (
                <div style={{ marginTop: 24 }}>
                  <p>{current.scope}</p>
                  <div className="flex">
                    <Button onClick={() => setTab('evidence')}>
                      {t('فتح الأدلة', 'Open evidence')}
                      <ArrowUpRight size={16} />
                    </Button>
                    <Button
                      variant="outline"
                      disabled={busy}
                      onClick={() =>
                        run(async () => {
                          await call(`cases/${selected}/status`, {
                            status:
                              current.status === 'open' ? 'closed' : 'open',
                          });
                          ok();
                        })
                      }
                    >
                      {current.status === 'open'
                        ? t('إغلاق القضية', 'Close case')
                        : t('إعادة فتح', 'Reopen')}
                    </Button>
                  </div>
                </div>
              )}
            </section>
            <section className="panel">
              <h2>{t('إنشاء قضية', 'Create case')}</h2>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const form = e.currentTarget,
                    f = new FormData(form);
                  run(async () => {
                    const r = await call('cases', {
                      title: f.get('title'),
                      scope: f.get('scope'),
                      type: kind,
                    });
                    setSelected(r.id);
                    form.reset();
                    ok();
                  });
                }}
              >
                <label>
                  {t('عنوان القضية', 'Case title')}
                  <Input name="title" required maxLength={200} />
                </label>
                <label>
                  {t('مسار العمل', 'Workflow')}
                  <Select
                    value={kind}
                    onValueChange={(v) => setKind(v || 'forensics')}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="forensics">
                        {t('تحقيق جنائي رقمي', 'Digital forensics')}
                      </SelectItem>
                      <SelectItem value="pentest">
                        {t('اختبار أمان مصرح', 'Authorized assessment')}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </label>
                <label>
                  {t(
                    'مرجع التفويض والنطاق والاستثناءات',
                    'Authorization reference, scope and exclusions',
                  )}
                  <Textarea name="scope" required maxLength={4000} />
                </label>
                <Button type="submit" disabled={busy || !loaded || !data.user}>
                  {t('إنشاء القضية', 'Create case')}
                </Button>
              </form>
            </section>
          </div>
        </TabsContent>
        <TabsContent value="evidence">
          <section className="panel">
            <h2>{t('خزنة الأدلة', 'Evidence vault')}</h2>
            {casePicker}
            {current ? (
              <>
                <p>
                  {t(
                    'تُحسب SHA-256 على الخادم عند الإيداع. هذا لا يحل محل التصوير الجنائي ومانع الكتابة في مرحلة الجمع.',
                    'SHA-256 is computed on the server at deposit. This does not replace forensic imaging and write blocking during acquisition.',
                  )}
                </p>
                <form
                  className="upload-form"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const form = e.currentTarget,
                      f = new FormData(form),
                      file = f.get('file') as File;
                    run(async () => {
                      if (file.size > 8 * 1024 * 1024)
                        throw new Error('file_too_large');
                      await call(`cases/${selected}/evidence`, undefined, {
                        method: 'POST',
                        headers: {
                          'content-type': 'application/octet-stream',
                          'x-lab-action': '1',
                          'x-evidence-meta': encodeURIComponent(
                            JSON.stringify({
                              name: file.name,
                              source: f.get('source'),
                              custodian: f.get('custodian'),
                            }),
                          ),
                        },
                        body: file,
                      });
                      form.reset();
                      ok();
                    });
                  }}
                >
                  <label>
                    {t(
                      'ملف الدليل أو تقرير الأداة',
                      'Evidence file or tool report',
                    )}
                    <Input
                      type="file"
                      name="file"
                      required
                      disabled={current.status === 'closed'}
                    />
                  </label>
                  <label>
                    {t(
                      'مصدر الدليل / مرجع الجمع',
                      'Evidence source / acquisition reference',
                    )}
                    <Input name="source" required maxLength={500} />
                  </label>
                  <label>
                    {t('الحائز المستلم', 'Receiving custodian')}
                    <Input name="custodian" required maxLength={200} />
                  </label>
                  <Button
                    type="submit"
                    disabled={busy || current.status === 'closed'}
                  >
                    {t('إيداع وحساب البصمة', 'Deposit & hash')}
                  </Button>
                </form>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('الدليل', 'Evidence')}</TableHead>
                      <TableHead>SHA-256</TableHead>
                      <TableHead>{t('الحائز', 'Custodian')}</TableHead>
                      <TableHead>{t('الإجراءات', 'Actions')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {es.map((e) => (
                      <TableRow key={e.id}>
                        <TableCell>
                          <strong>{e.name}</strong>
                          <small>{e.size.toLocaleString()} bytes</small>
                          <small>{e.source}</small>
                        </TableCell>
                        <TableCell>
                          <span className="hash">{e.sha256}</span>
                        </TableCell>
                        <TableCell>{e.custodian}</TableCell>
                        <TableCell>
                          <div className="flex">
                            <Button
                              variant="outline"
                              disabled={busy}
                              onClick={() =>
                                run(async () => {
                                  const r = await call(
                                    `evidence/${e.id}/verify`,
                                    {},
                                  );
                                  setMessage(
                                    r.match
                                      ? t(
                                          'البصمة مطابقة للملف المحفوظ.',
                                          'Stored file hash matches.',
                                        )
                                      : t(
                                          'تحذير: البصمة غير مطابقة. أوقف التحليل وحقق في سلامة المخزن.',
                                          'Warning: hash mismatch. Stop analysis and investigate storage integrity.',
                                        ),
                                  );
                                })
                              }
                            >
                              {t('تحقق', 'Verify')}
                            </Button>
                            <a
                              className="link"
                              href={`/api/lab/evidence/${e.id}/download`}
                            >
                              {t('تنزيل', 'Download')}
                            </a>
                            <Button
                              variant="ghost"
                              disabled={busy}
                              onClick={() =>
                                run(async () => {
                                  setTransfer(e);
                                  setCustody(
                                    (await call(`evidence/${e.id}/custody`))
                                      .items,
                                  );
                                })
                              }
                            >
                              {t('الحيازة', 'Custody')}
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {!es.length && (
                  <div className="empty">
                    {t(
                      'لا توجد أدلة مودعة لهذه القضية.',
                      'No evidence deposited for this case.',
                    )}
                  </div>
                )}
                {transfer && (
                  <section className="panel">
                    <h2>
                      {t('سلسلة الحيازة', 'Chain of custody')} — {transfer.name}
                    </h2>
                    {custody.map((x) => (
                      <p key={x.id}>
                        <time>{x.time}</time> ·{' '}
                        {x.from_name || t('استلام أولي', 'Initial receipt')} →{' '}
                        {x.to_name} ·{' '}
                        {x.reason === 'initial_receipt'
                          ? t('إيداع أولي', 'Initial deposit')
                          : x.reason}
                      </p>
                    ))}
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        const form = e.currentTarget,
                          f = new FormData(form);
                        run(async () => {
                          await call(`evidence/${transfer.id}/custody`, {
                            from: transfer.custodian,
                            to: f.get('to'),
                            reason: f.get('reason'),
                          });
                          setTransfer(null);
                          setCustody([]);
                          ok();
                        });
                      }}
                    >
                      <label>
                        {t('الحائز الجديد', 'New custodian')}
                        <Input name="to" required maxLength={200} />
                      </label>
                      <label>
                        {t('سبب الانتقال', 'Transfer reason')}
                        <Textarea name="reason" required maxLength={1000} />
                      </label>
                      <Button
                        type="submit"
                        disabled={busy || current.status === 'closed'}
                      >
                        {t('تسجيل الانتقال', 'Record transfer')}
                      </Button>
                    </form>
                  </section>
                )}
              </>
            ) : (
              requireCase
            )}
          </section>
        </TabsContent>
        <TabsContent value="tasks">
          <section className="panel">
            <h2>{t('إدارة المهام', 'Task management')}</h2>
            {casePicker}
            {current ? (
              <>
                <form
                  className="upload-form"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const form = e.currentTarget,
                      f = new FormData(form);
                    run(async () => {
                      await call(`cases/${selected}/tasks`, {
                        title: f.get('title'),
                        assignee: f.get('assignee'),
                      });
                      form.reset();
                      ok();
                    });
                  }}
                >
                  <label>
                    {t('وصف المهمة', 'Task description')}
                    <Input name="title" required maxLength={500} />
                  </label>
                  <label>
                    {t('المسؤول', 'Assignee')}
                    <Input name="assignee" required maxLength={200} />
                  </label>
                  <Button
                    type="submit"
                    disabled={busy || current.status === 'closed'}
                  >
                    {t('إضافة مهمة', 'Add task')}
                  </Button>
                </form>
                {ts.map((task) => (
                  <div className="task-row" key={task.id}>
                    <div>
                      <strong>{task.title}</strong>
                      <p>
                        {task.assignee} ·{' '}
                        {task.status === 'done'
                          ? t('مكتملة', 'Completed')
                          : t('قيد العمل', 'Open')}
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      disabled={busy || current.status === 'closed'}
                      onClick={() =>
                        run(async () => {
                          await call(`tasks/${task.id}`, {
                            status: task.status === 'done' ? 'open' : 'done',
                          });
                          ok();
                        })
                      }
                    >
                      {task.status === 'done'
                        ? t('إعادة فتح', 'Reopen')
                        : t('إكمال', 'Complete')}
                    </Button>
                  </div>
                ))}
                {!ts.length && (
                  <div className="empty">
                    {t('لا توجد مهام لهذه القضية.', 'No tasks in this case.')}
                  </div>
                )}
              </>
            ) : (
              requireCase
            )}
          </section>
        </TabsContent>
        {['connectors', 'findings', 'reports'].map((section) => (
          <TabsContent value={section} key={section}>
            <div className="case-context">{casePicker}</div>
            {current ? (
              <OperationsPanel
                key={selected + section}
                ar={ar}
                caseId={selected}
                caseTitle={current.title}
                closed={current.status === 'closed'}
                section={section}
                evidence={es}
                api={call}
                onRefresh={refresh}
              />
            ) : (
              requireCase
            )}
          </TabsContent>
        ))}
        <TabsContent value="execution">
          <div className="case-context">{casePicker}</div>
          {current ? (
            <ExecutionPanel
              ar={ar}
              caseId={selected}
              evidence={es}
              api={call}
              refresh={refresh}
            />
          ) : (
            requireCase
          )}
        </TabsContent>
        <TabsContent value="tools">
          <ToolLibrary ar={ar} onConnect={() => setTab('connectors')} onRun={() => setTab('execution')} />
        </TabsContent>
        <TabsContent value="audit">
          <section className="panel">
            <h2>{t('سجل التدقيق', 'Audit trail')}</h2>
            <p>
              {t(
                'بصمات مستقلة لأحداث التطبيق. لا يكشف هذا السجل حذف أحداث بواسطة مدير قاعدة البيانات، ولا يحتوي ختماً خارجياً أو توقيعاً قضائياً.',
                'Independent checksums of application events. This log cannot detect events deleted by a database administrator and has no external anchor or legal signature.',
              )}
            </p>
            <Button
              disabled={busy}
              onClick={() =>
                run(async () => {
                  setAudit(await call('audit'));
                })
              }
            >
              {t('تحميل وفحص السجل', 'Load & verify log')}
            </Button>
            {audit && (
              <>
                <p className={audit.intact ? '' : 'error'}>
                  {audit.intact
                    ? t(
                        'بصمات الأحداث الحالية مطابقة.',
                        'Current event checksums match.',
                      )
                    : t(
                        'تم اكتشاف اختلاف في بصمات الأحداث.',
                        'Event checksum mismatch detected.',
                      )}
                </p>
                <Button
                  variant="outline"
                  onClick={() =>
                    saveFile(
                      'talal-audit.json',
                      JSON.stringify(audit, null, 2),
                      'application/json',
                    )
                  }
                >
                  {t('تصدير JSON', 'Export JSON')}
                </Button>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>UTC</TableHead>
                      <TableHead>{t('العملية', 'Action')}</TableHead>
                      <TableHead>{t('معرف السجل', 'Record ID')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {audit.items.map((a: any) => (
                      <TableRow key={a.id}>
                        <TableCell>{a.time}</TableCell>
                        <TableCell>
                          {actions[a.action]?.[ar ? 0 : 1] || a.action}
                        </TableCell>
                        <TableCell className="hash">{a.entity}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </>
            )}
          </section>
        </TabsContent>
        <TabsContent value="guide">
          <section className="panel">
            <h2>{t('دليل التشغيل', 'Operating guide')}</h2>
            <ol className="guide-list">
              {[
                [
                  'أنشئ قضية وسجل التفويض والأصول المسموحة والاستثناءات.',
                  'Create a case and record authorization, allowed assets and exclusions.',
                ],
                [
                  'أودع ملفاً تدريبياً حتى 8 MiB، وحدد المصدر والحائز.',
                  'Deposit a training file up to 8 MiB, with source and custodian.',
                ],
                [
                  'تحقق من البصمة قبل التحليل، وسجل كل انتقال للحيازة.',
                  'Verify the hash before analysis and record every custody transfer.',
                ],
                [
                  'أضف المهام وحدد المسؤول وسجل اكتمالها.',
                  'Add tasks, assign responsibility and record completion.',
                ],
                [
                  'استورد النتائج من الموصلات وراجعها، ثم أنشئ تقريراً واحفظ نسخة مستقلة قبل مغادرة القسم.',
                  'Import and review connector findings, then prepare a report and save a snapshot before leaving.',
                ],
                [
                  'راجع سجل التدقيق، وأغلق القضية بعد إكمال جميع المهام.',
                  'Review the audit log and close the case after completing all tasks.',
                ],
              ].map(([a, b]) => (
                <li key={b}>{t(a, b)}</li>
              ))}
            </ol>
            <div className="flex">
              <a className="link" href="/docs/USER-GUIDE.md" download>
                {t('الدليل العربي والإنجليزي', 'Arabic & English manual')}
              </a>
              <a className="link" href="/docs/CONNECTORS.md" download>
                {t('دليل الموصلات والتقارير', 'Connector & reporting guide')}
              </a>
              <a className="link" href="/docs/ARCHITECTURE.md" download>
                {t('التصميم الهندسي', 'Engineering design')}
              </a>
            </div>
          </section>
        </TabsContent>
        <TabsContent value="developer">
          <section className="panel developer">
            <p className="eyebrow">THE ARCHITECT / المطور</p>
            <h1>{t('م. طلال فواز السحيمي', 'Eng. Talal Fawaz Al-Suhaimi')}</h1>
            <h2>
              {t(
                'مهندس معماريات أنظمة التشغيل والمنصات السيبرانية',
                'Operating Systems & Cyber Platforms Architect',
              )}
            </h2>
            <p>
              {t(
                'مصمم ومطور أنظمة تشغيل، من بينها «تي فانتوم»، وصاحب مشروع مختبر طلال السيبراني لإدارة التحقيقات الرقمية واختبارات الأمان.',
                'Operating systems designer and developer, including T Phantom, and creator of the Talal Cyber Lab project for digital investigation and security assessment management.',
              )}
            </p>
            <a
              className="link"
              href="https://talalsuhaimi.com"
              target="_blank"
              rel="noreferrer"
            >
              talalsuhaimi.com ↗
            </a>
            <div className="contact-grid">
              <a href="mailto:talal@talalsuhaimi.com">
                <small>{t('البريد الرسمي', 'Official email')}</small>
                <strong dir="ltr">talal@talalsuhaimi.com</strong>
              </a>
              <a href="tel:0544473041">
                <small>{t('الهاتف', 'Phone')}</small>
                <strong dir="ltr">0544473041</strong>
              </a>
            </div>
          </section>
        </TabsContent>
      </Tabs>
      <footer>
        <strong>تصميم وتطوير م. طلال فواز السحيمي</strong>
        <a href="https://talalsuhaimi.com" target="_blank" rel="noreferrer">
          talalsuhaimi.com ↗
        </a>
        <form method="post" action="/auth/logout"><button type="submit">{t('تسجيل الخروج','Sign out')}</button></form><span>LINUX EDITION · © 2026</span>
      </footer>
    </main>
  );
}

