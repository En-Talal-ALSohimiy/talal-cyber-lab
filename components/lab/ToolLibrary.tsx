'use client';
import { useState } from 'react';
import {
  Search,
  ArrowUpRight,
  PlugZap,
  Download,
  Network,
  HardDrive,
  MemoryStick,
  Code2,
  Radar,
  Shield,
  ScanEye,
  Workflow,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import catalog from '@/lib/tool-catalog.json';
const icons: Record<string, typeof Network> = {
  disk: HardDrive,
  memory: MemoryStick,
  network: Network,
  web: Shield,
  malware: ScanEye,
  endpoint: Workflow,
  cloud: Code2,
  intel: Radar,
};
export function ToolLibrary({
  ar,
  onConnect,
  onRun,
}: {
  ar: boolean;
  onConnect: () => void;
  onRun: () => void;
}) {
  const [query, setQuery] = useState(''),
    [category, setCategory] = useState('all'),
    [connected, setConnected] = useState('all');
  const t = (a: string, b: string) => (ar ? a : b);
  const tools = catalog.tools.filter(
    (x) =>
      (category === 'all' || x.category === category) &&
      (connected === 'all' || !!x.connector) &&
      `${x.name} ${x.ar} ${x.en}`.toLowerCase().includes(query.toLowerCase()),
  );
  return (
    <section className="panel tool-library">
      <div className="section-title">
        <div>
          <small>TOOL REGISTRY / 40</small>
          <h2>
            {t('ترسانة التحليل والتحقيق', 'Analysis & investigation toolkit')}
          </h2>
        </div>
        <span className="badge">
          {tools.length} / {catalog.tools.length}
        </span>
      </div>
      <p>
        {t(
          'مكتبة مصادر تضم 40 أداة. قسم تشغيل الأدوات يفحص عامل Linux ويعرض وظائف التنفيذ المثبتة فعلياً؛ بقية الأدوات تحتاج تجهيزاً أو ترخيصاً منفصلاً.',
          'A registry of 40 tool sources. Run tools checks the Linux worker and displays installed execution profiles; other tools require separate provisioning or licenses.',
        )}
      </p>
      <Button onClick={onRun}>{t('فتح عامل التشغيل وفحص الأدوات','Open execution worker & check tools')}</Button>
      <div className="catalog-controls">
        <label>
          <span>{t('ابحث عن أداة', 'Find a tool')}</span>
          <div className="search-control">
            <Search size={18} />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Nmap, memory, الشبكات…"
            />
          </div>
        </label>
        <label>
          {t('التخصص', 'Discipline')}
          <Select
            value={category}
            onValueChange={(v) => setCategory(v || 'all')}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">
                {t('جميع التخصصات', 'All disciplines')}
              </SelectItem>
              {catalog.categories.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {ar ? c.ar : c.en}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>
        <label>
          {t('نوع التكامل', 'Integration')}
          <Select
            value={connected}
            onValueChange={(v) => setConnected(v || 'all')}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('كل الأدوات', 'All tools')}</SelectItem>
              <SelectItem value="connected">
                {t('موصل نتائج متاح', 'Results connector available')}
              </SelectItem>
            </SelectContent>
          </Select>
        </label>
      </div>
      <div className="tools">
        {tools.map((tool, i) => {
          const Icon = icons[tool.category],
            cat = catalog.categories.find((c) => c.id === tool.category);
          return (
            <article className="tool-card" key={tool.id}>
              <div className="tool-card-top">
                <Icon size={24} />
                <span className="mono">{String(i + 1).padStart(2, '0')}</span>
              </div>
              <small>{ar ? cat?.ar : cat?.en}</small>
              <h3 dir="ltr">{tool.name}</h3>
              <p>{ar ? tool.ar : tool.en}</p>
              <span
                className={
                  'tool-state ' + (tool.connector ? 'ready' : 'external')
                }
              >
                {tool.connector ? (
                  <>
                    <PlugZap size={13} />
                    {t('موصل نتائج جاهز', 'Results connector ready')}
                  </>
                ) : (
                  t('تجهيز خارجي', 'External provisioning')
                )}
              </span>
              <div className="tool-actions">
                <a
                  className="link"
                  href={tool.url}
                  target="_blank"
                  rel="noreferrer"
                >
                  {t('المصدر الرسمي', 'Official source')}
                  <ArrowUpRight size={16} />
                </a>
                {tool.connector && (
                  <Button size="sm" variant="outline" onClick={onConnect}>
                    {t('استيراد', 'Import')}
                  </Button>
                )}
              </div>
              {tool.commercial && (
                <small className="license-note">
                  {t(
                    'اختر إصداراً وترخيصاً من المورد',
                    'Select vendor edition and license',
                  )}
                </small>
              )}
            </article>
          );
        })}
      </div>
      {!tools.length && (
        <div className="empty">
          {t('لا توجد أدوات تطابق البحث.', 'No tools match your search.')}
        </div>
      )}
      <div className="lab-environment">
        <div>
          <small>ISOLATED RANGE</small>
          <h2>
            {t('بيئة المحاكاة والتحليل', 'Simulation & analysis environment')}
          </h2>
          <p>
            {t(
              'تضم حزمة Linux شبكة تدريب داخلية وهدف HTTP اصطناعياً وعامل تنفيذ. راجع قسم تشغيل الأدوات لفحص الاتصال والوظائف المتاحة.',
              'The Linux package includes an internal network, a synthetic HTTP target and an execution worker. Check Run tools for connectivity and available profiles.',
            )}
          </p>
        </div>
        <a className="link" href="/docs/VIRTUAL-LAB.md" download>
          <Download size={18} />
          {t('دليل التشغيل', 'Operating guide')}
        </a>
      </div>
    </section>
  );
}

