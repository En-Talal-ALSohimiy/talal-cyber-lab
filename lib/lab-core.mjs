// Shared Web API core: Cloudflare D1/R2 in deployment; SQLite/files in local tests.
import { extendedApi } from './extended-api.mjs';
export const MAX_FILE = 8 * 1024 * 1024;
const enc = new TextEncoder();
export async function sha256(bytes) { return [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(b=>b.toString(16).padStart(2,'0')).join(''); }
const now = () => new Date().toISOString();
const uid = () => crypto.randomUUID();
function fail(status, code) { throw Object.assign(new Error(code), {status}); }
function field(value, max=200) { if(typeof value!=='string'||!value.trim()||value.length>max||/[\u0000-\u0008]/.test(value)) fail(400,'invalid_field'); return value.trim(); }
const headers = {'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff','referrer-policy':'no-referrer'};
const json = (value,status=200) => new Response(JSON.stringify(value),{status,headers});
const p = (db,sql,...args) => db.prepare(sql).bind(...args);
async function rows(db,sql,...args) { return (await p(db,sql,...args).all()).results; }
async function audit(db,owner,action,entity,detail,transition=null) {
  const id=uid(),time=now(),payload=JSON.stringify({id,time,owner,action,entity,detail});
  const hash=await sha256(enc.encode(payload));
  return transition?p(db,'INSERT INTO events(id,owner,time,action,entity,payload,hash) SELECT ?,?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM custody WHERE id=?)',id,owner,time,action,entity,payload,hash,transition):p(db,'INSERT INTO events(id,owner,time,action,entity,payload,hash) VALUES(?,?,?,?,?,?,?)',id,owner,time,action,entity,payload,hash);
}
async function caseFor(db,owner,id,write=false) {
  const row=await p(db,'SELECT * FROM cases WHERE id=? AND owner=?',id,owner).first();
  if(!row) fail(404,'not_found');
  if(write&&row.status==='closed') fail(409,'case_closed');
  return row;
}
async function evidenceFor(db,owner,id) { const e=await p(db,'SELECT * FROM evidence WHERE id=? AND owner=?',id,owner).first();if(!e)fail(404,'not_found');return e; }
export async function readBounded(req,max) {
  if(Number(req.headers.get('content-length')||0)>max) fail(413,'file_too_large');
  if(!req.body)return new Uint8Array();
  const reader=req.body.getReader(),chunks=[];let size=0;
  try { for(;;){const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>max){await reader.cancel();fail(413,'file_too_large');}chunks.push(value);} } finally {reader.releaseLock();}
  const out=new Uint8Array(size);let offset=0;for(const c of chunks){out.set(c,offset);offset+=c.length;}return out;
}
export function reportMarkdown(c,es,ts,cs,language='ar') {
  const ar=language!=='en',t=(a,b)=>ar?a:b;
  const safe=v=>String(v??'').replace(/[|\r\n]/g,' ').replace(/[<>]/g,'');
  return `# ${t('مختبر طلال السيبراني — تقرير قضية','Talal Cyber Lab — Case report')}\n\n**${t('مسودة تحتاج مراجعة وتوقيعاً معتمداً','Draft requiring review and authorized signature')}**\n\n`+
    `${t('القضية','Case')}: ${safe(c.title)}\n\nID: ${c.id}\n\nUTC: ${now()}\n\n${t('التفويض والنطاق','Authority and scope')}: ${safe(c.scope)}\n\n`+
    `## ${t('الأدلة','Evidence')}\n\n| ID | ${t('الاسم','Name')} | Bytes | SHA-256 | ${t('الحائز','Custodian')} |\n|---|---|---:|---|---|\n`+
    es.map(e=>`|${e.id}|${safe(e.name)}|${e.size}|${e.sha256}|${safe(e.custodian)}|`).join('\n')+
    `\n\n## ${t('سلسلة الحيازة','Custody history')}\n\n| UTC | ${t('الدليل','Evidence')} | ${t('من','From')} | ${t('إلى','To')} | ${t('السبب','Reason')} |\n|---|---|---|---|---|\n`+
    cs.map(e=>`|${e.time}|${e.evidence_id}|${safe(e.from_name)}|${safe(e.to_name)}|${safe(e.reason)}|`).join('\n')+
    `\n\n## ${t('المهام','Tasks')}\n\n`+ts.map(t=>`- [${t.status==='done'?'x':' '}] ${safe(t.title)} — ${safe(t.assignee)}`).join('\n')+
    `\n\n## ${t('النتائج والمنهجية والقيود','Findings, methodology and limitations')}\n\n${t('يستكمل المحقق النتائج المثبتة وإصدار الأدوات ومراجع الأدلة والفرضيات البديلة. لا ينشئ هذا التصدير استنتاجات آلية.','The examiner must add verified findings, tool versions, evidence references and alternative explanations. This export makes no automated findings.')}\n\n`+
    `${t('المراجع والتوقيع','Reviewer and signature')}: __________________\n`;
}
export async function handleLab(req,env,owner) {
  try {
    if(!owner||typeof owner!=='string'||owner.length>250) fail(401,'sign_in_required');
    const db=env.DB,bucket=env.EVIDENCE,url=new URL(req.url),parts=url.pathname.replace(/^\/api\/lab\/?/,'').split('/').filter(Boolean),method=req.method;
    if(!db||!bucket) fail(503,'storage_unavailable');
    if(method!=='GET') {
      if(req.headers.get('x-lab-action')!=='1') fail(403,'request_rejected');
      if(req.headers.get('origin')!==url.origin) fail(403,'origin_rejected');
    }
    let body={};
    const upload=parts[0]==='cases'&&parts[2]==='evidence'&&method==='POST';
    if(method!=='GET'&&!upload) {
      if(!req.headers.get('content-type')?.startsWith('application/json'))fail(415,'json_required');
      try{body=JSON.parse(new TextDecoder().decode(await readBounded(req,512*1024)));}catch(e){if(e.status)throw e;fail(400,'invalid_json');}
      if(!body||typeof body!=='object'||Array.isArray(body))fail(400,'invalid_json');
    }
    if(parts.length===0&&method==='GET') {
      const [cases,evidence,tasks]=await Promise.all([rows(db,'SELECT * FROM cases WHERE owner=? ORDER BY created DESC',owner),rows(db,'SELECT * FROM evidence WHERE owner=? ORDER BY created DESC',owner),rows(db,'SELECT * FROM tasks WHERE owner=? ORDER BY created DESC',owner)]);
      const findingStats=await rows(db,'SELECT status,severity,COUNT(*) AS count FROM findings WHERE owner=? GROUP BY status,severity',owner);
      return json({cases,evidence,tasks,findingStats,user:owner});
    }
    const extra=await extendedApi({req,db,bucket,owner,parts,url,method,body,p,rows,audit,caseFor,evidenceFor,sha256,fail,json,field,uid,now});
    if(extra)return extra;
    if(parts[0]==='cases'&&parts.length===1&&method==='POST') {
      const id=uid(),time=now(),title=field(body.title),scope=field(body.scope,4000),type=field(body.type,20);
      if(!['forensics','pentest'].includes(type))fail(400,'invalid_type');
      await db.batch([p(db,'INSERT INTO cases(id,owner,title,scope,type,status,created) VALUES(?,?,?,?,?,?,?)',id,owner,title,scope,type,'open',time),await audit(db,owner,'case.created',id,{title,type})]);
      return json({id},201);
    }
    if(parts[0]==='cases'&&parts[1]) {
      const c=await caseFor(db,owner,parts[1],method!=='GET'&&parts[2]!=='status');
      if(parts[2]==='status'&&method==='POST') {
        if(!['open','closed'].includes(body.status))fail(400,'invalid_status');
        if(body.status==='closed'&&(await rows(db,'SELECT id FROM tasks WHERE case_id=? AND owner=? AND status=?',c.id,owner,'open')).length)fail(409,'open_tasks');
        await db.batch([p(db,'UPDATE cases SET status=? WHERE id=? AND owner=?',body.status,c.id,owner),await audit(db,owner,'case.status',c.id,{from:c.status,to:body.status})]);return json({ok:true});
      }
      if(parts[2]==='evidence'&&upload) {
        let meta;try{meta=JSON.parse(decodeURIComponent(req.headers.get('x-evidence-meta')||''));}catch{fail(400,'invalid_metadata');}
        const name=field(meta.name,240),source=field(meta.source,500),custodian=field(meta.custodian),bytes=await readBounded(req,MAX_FILE);
        if(!bytes.length)fail(400,'empty_file');
        const id=uid(),time=now(),key=`${owner}/${id}`,hash=await sha256(bytes);
        await bucket.put(key,bytes,{httpMetadata:{contentType:'application/octet-stream'}});
        try{await db.batch([
          p(db,'INSERT INTO evidence(id,owner,case_id,name,source,custodian,size,sha256,object_key,created) VALUES(?,?,?,?,?,?,?,?,?,?)',id,owner,c.id,name,source,custodian,bytes.length,hash,key,time),
          p(db,'INSERT INTO custody(id,owner,evidence_id,case_id,from_name,to_name,reason,time) VALUES(?,?,?,?,?,?,?,?)',uid(),owner,id,c.id,'',custodian,'initial_receipt',time),
          await audit(db,owner,'evidence.received',id,{caseId:c.id,sha256:hash,size:bytes.length})
        ]);}catch(e){await bucket.delete(key);throw e;}
        return json({id,sha256:hash,size:bytes.length},201);
      }
      if(parts[2]==='tasks'&&method==='POST') {
        const id=uid(),title=field(body.title,500),assignee=field(body.assignee);
        await db.batch([p(db,'INSERT INTO tasks(id,owner,case_id,title,assignee,status,created) VALUES(?,?,?,?,?,?,?)',id,owner,c.id,title,assignee,'open',now()),await audit(db,owner,'task.created',id,{caseId:c.id,title})]);return json({id},201);
      }
      if(parts[2]==='report'&&method==='GET') {
        const [es,ts,cs]=await Promise.all([rows(db,'SELECT * FROM evidence WHERE case_id=? AND owner=? ORDER BY created',c.id,owner),rows(db,'SELECT * FROM tasks WHERE case_id=? AND owner=? ORDER BY created',c.id,owner),rows(db,'SELECT * FROM custody WHERE case_id=? AND owner=? ORDER BY time,id',c.id,owner)]);
        await (await audit(db,owner,'report.exported',c.id,{language:url.searchParams.get('lang')==='en'?'en':'ar'})).run();
        return json({markdown:reportMarkdown(c,es,ts,cs,url.searchParams.get('lang'))});
      }
    }
    if(parts[0]==='evidence'&&parts[1]) {
      const e=await evidenceFor(db,owner,parts[1]);
      if(parts[2]==='download'&&method==='GET') {
        const obj=await bucket.get(e.object_key);if(!obj)fail(404,'object_missing');
        await (await audit(db,owner,'evidence.downloaded',e.id,{})).run();
        return new Response(obj.body,{headers:{...headers,'content-type':'application/octet-stream','content-disposition':`attachment; filename="evidence-${e.id}.bin"`}});
      }
      if(parts[2]==='verify'&&method==='POST') {
        const obj=await bucket.get(e.object_key);if(!obj)fail(404,'object_missing');
        const actual=await sha256(await obj.arrayBuffer()),match=actual===e.sha256;
        await (await audit(db,owner,'evidence.verified',e.id,{expected:e.sha256,actual,match})).run();return json({match,expected:e.sha256,actual});
      }
      if(parts[2]==='custody'&&method==='GET')return json({items:await rows(db,'SELECT * FROM custody WHERE evidence_id=? AND owner=? ORDER BY time,id',e.id,owner)});
      if(parts[2]==='custody'&&method==='POST') {
        await caseFor(db,owner,e.case_id,true);const to=field(body.to),reason=field(body.reason,1000);
        // Optimistic lock prevents concurrent transfers from silently overwriting the current custodian.
        if(body.from!==e.custodian)fail(409,'custody_conflict');
        const transition=uid();
        const results=await db.batch([
          p(db,'INSERT INTO custody(id,owner,evidence_id,case_id,from_name,to_name,reason,time) SELECT ?,?,?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM evidence WHERE id=? AND owner=? AND custodian=?)',transition,owner,e.id,e.case_id,e.custodian,to,reason,now(),e.id,owner,e.custodian),
          p(db,'UPDATE evidence SET custodian=? WHERE id=? AND owner=? AND EXISTS(SELECT 1 FROM custody WHERE id=?)',to,e.id,owner,transition),
          await audit(db,owner,'custody.transferred',e.id,{from:e.custodian,to,reason,transition},transition)
        ]);
        if(!results[0].meta.changes)fail(409,'custody_conflict');
        return json({ok:true});
      }
    }
    if(parts[0]==='tasks'&&parts[1]&&method==='POST') {
      const t=await p(db,'SELECT * FROM tasks WHERE id=? AND owner=?',parts[1],owner).first();if(!t)fail(404,'not_found');await caseFor(db,owner,t.case_id,true);
      if(!['open','done'].includes(body.status))fail(400,'invalid_status');
      await db.batch([p(db,'UPDATE tasks SET status=? WHERE id=? AND owner=?',body.status,t.id,owner),await audit(db,owner,'task.status',t.id,{status:body.status})]);return json({ok:true});
    }
    if(parts[0]==='audit'&&method==='GET') {
      const items=await rows(db,'SELECT * FROM events WHERE owner=? ORDER BY time,id',owner);
      let intact=true;for(const e of items){if(await sha256(enc.encode(e.payload))!==e.hash)intact=false;}
      return json({items,intact,assurance:'Individual event checksums only; no external anchor or deletion detection.'});
    }
    fail(404,'not_found');
  } catch(e) { if(e.message?.includes('LAB_CASE_CLOSED'))return json({error:'case_closed'},409);if(e.message?.includes('LAB_OPEN_TASKS'))return json({error:'open_tasks'},409);if(e.message?.includes('revision_guards.id'))return json({error:'revision_conflict'},409);if(e.message?.includes('UNIQUE constraint failed: imports.'))return json({error:'already_imported'},409);if(!e.status)console.error('Lab request failed',e?.message);return json({error:e.status?e.message:'internal_error'},e.status||500); }
}

