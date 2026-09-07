'use client';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectValue,
  SelectItem,
} from '@/components/ui/select';
export function ExecutionPanel({
  ar,
  caseId,
  evidence,
  api,
  refresh,
}: {
  ar: boolean;
  caseId: string;
  evidence: { id: string; name: string }[];
  api: (p?: string, b?: unknown) => Promise<any>;
  refresh: () => Promise<void>;
}) {
  const [status, setStatus] = useState<any>(null),
    [jobs, setJobs] = useState<any[]>([]),
    [tool, setTool] = useState('hashes'),
    [input, setInput] = useState(''),
    [target, setTarget] = useState(''),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  const t = (a: string, b: string) => (ar ? a : b);
  async function load() {
    try {
      const [s, j] = await Promise.all([
        api('execution/status'),
        api(`execution/jobs?caseId=${caseId}`),
      ]);
      setStatus(s);
      setJobs(j.items);
      setError('');
    } catch (e: any) {
      setError(e.message);
    }
  }
  useEffect(() => {
    setInput('');
    void load();
    const timer = setInterval(() => void load(), 4000);
    return () => clearInterval(timer);
  }, [caseId]);
  const profile = status?.profiles.find((p: any) => p.id === tool);
  const errors: Record<string, string> = {
    worker_unavailable: t(
      'عامل التشغيل غير متصل. راجع حالة خدمة worker.',
      'Execution worker unavailable. Check the worker service.',
    ),
    tool_unavailable: t(
      'الأداة غير مثبتة داخل العامل.',
      'Tool is not installed in the worker.',
    ),
    case_closed: t(
      'أعد فتح القضية قبل التشغيل.',
      'Reopen the case before execution.',
    ),
    target_not_allowed: t(
      'الهدف غير موجود في إعداد نطاق المختبر.',
      'Target is outside the configured laboratory scope.',
    ),
    evidence_not_found: t(
      'اختر دليلاً من القضية الحالية.',
      'Select evidence from the active case.',
    ),
    queue_full: t(
      'قائمة الانتظار ممتلئة؛ انتظر اكتمال المهام.',
      'Execution queue is full; wait for jobs to complete.',
    ),
  };
  return (
    <section className="panel">
      <div className="section-title">
        <div>
          <small>LINUX EXECUTION ENGINE</small>
          <h2>{t('تشغيل الأدوات فعلياً', 'Run laboratory tools')}</h2>
        </div>
        <Button variant="outline" onClick={() => void load()}>
          {t('فحص الجاهزية', 'Check readiness')}
        </Button>
      </div>
      <p>
        {t(
          'تعمل الأدوات في حاوية معزولة عن قاعدة البيانات. تُحفظ المخرجات تلقائياً كأدلة ببصمة وسجل حيازة؛ يحول Nmap أيضاً المنافذ إلى نتائج قابلة للمراجعة.',
          'Tools run in a container isolated from the database. Outputs are deposited automatically as hashed evidence with custody history; Nmap ports also become reviewable findings.',
        )}
      </p>
      {error && (
        <p role="alert" className="error">
          {errors[error] || error}
        </p>
      )}
      {status && (
        <>
          <div className="capabilities">
            <span>
              {status.profiles.filter((p: any) => p.available).length} /{' '}
              {status.profiles.length}{' '}
              {t('ملف تشغيل جاهز', 'execution profiles ready')}
            </span>
            <span>
              {status.busy
                ? t('العامل ينفذ مهمة', 'Worker busy')
                : t('العامل متصل', 'Worker connected')}
            </span>
          </div>
          <div className="connector-grid">
            {status.profiles.map((p: any) => (
              <button
                key={p.id}
                aria-pressed={tool === p.id}
                disabled={!p.available}
                onClick={() => setTool(p.id)}
              >
                <strong>{ar ? p.ar : p.en}</strong>
                <small>
                  {p.id} ·{' '}
                  {p.available
                    ? t('جاهزة', 'Ready')
                    : t('غير مثبتة', 'Not installed')}
                </small>
              </button>
            ))}
          </div>
          <div className="import-controls">
            {profile?.input === 'target' ? (
              <label>
                {t('هدف من النطاق المعتمد', 'Configured scope target')}
                <Select
                  value={target}
                  onValueChange={(v) => setTarget(v || '')}
                >
                  <SelectTrigger>
                    <SelectValue
                      placeholder={t('اختر الهدف', 'Select target')}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {status.targets.map((v: string) => (
                      <SelectItem value={v} key={v}>
                        {v}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </label>
            ) : (
              <label>
                {t('الدليل المراد تحليله', 'Evidence to analyze')}
                <Select value={input} onValueChange={(v) => setInput(v || '')}>
                  <SelectTrigger>
                    <SelectValue
                      placeholder={t('اختر دليلاً', 'Select evidence')}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {evidence.map((e) => (
                      <SelectItem key={e.id} value={e.id}>
                        {e.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </label>
            )}
            <Button
              disabled={
                busy ||
                !profile?.available ||
                !(profile?.input === 'target' ? target : input)
              }
              onClick={async () => {
                setBusy(true);
                try {
                  await api(`execution/jobs?caseId=${caseId}`, {
                    tool,
                    evidenceId: input,
                    target,
                  });
                  await load();
                } catch (e: any) {
                  setError(e.message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              {t('تشغيل وحفظ النتائج', 'Run & preserve output')}
            </Button>
          </div>
        </>
      )}
      <h3>{t('سجل التنفيذ', 'Execution history')}</h3>
      {jobs.map((j) => (
        <article className="task-row" key={j.id}>
          <div>
            <strong>{j.tool}</strong>
            <small>
              {j.created} ·{' '}
              {
                (
                  {
                    queued: t('في الانتظار', 'Queued'),
                    running: t('قيد التنفيذ', 'Running'),
                    succeeded: t('اكتمل', 'Completed'),
                    failed: t('فشل', 'Failed'),
                  } as Record<string, string>
                )[j.status]
              }
            </small>
            {j.error && <p className="error">{j.error}</p>}
            {j.output_id && (
              <a
                className="link"
                href={`/api/lab/evidence/${j.output_id}/download`}
              >
                {t('تنزيل نتيجة التنفيذ', 'Download execution output')}
              </a>
            )}
          </div>
          {j.output_id && (
            <Button variant="outline" onClick={() => void refresh()}>
              {t('تحديث خزنة الأدلة', 'Refresh evidence vault')}
            </Button>
          )}
        </article>
      ))}
      {!jobs.length && (
        <div className="empty">
          {t(
            'لا توجد مهام تنفيذ لهذه القضية بعد.',
            'No execution jobs in this case yet.',
          )}
        </div>
      )}
      <p>
        {t(
          'الحد الحالي 8 MiB للدليل و60 ثانية للتنفيذ. نتائج التحليل تحتاج مراجعة المحقق.',
          'Current limits: 8 MiB per evidence file and 60 seconds per execution. An examiner must review analysis output.',
        )}
      </p>
    </section>
  );
}

