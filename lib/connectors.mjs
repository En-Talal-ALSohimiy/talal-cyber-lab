import { XMLParser, XMLValidator } from 'fast-xml-parser';

export { CONNECTORS } from './connector-registry.mjs';
export const MAX_IMPORT_ROWS = 200;
const invalid = (code = 'invalid_connector_file') => {
  throw Object.assign(new Error(code), { status: 400 });
};
const array = (v) => (v == null ? [] : Array.isArray(v) ? v : [v]);
const plain = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const text = (v, max = 6000) =>
  String(v ?? '')
    .replace(/\u0000/g, '')
    .slice(0, max);
const severity = (v) =>
  ['critical', 'high', 'medium', 'low', 'info'].includes(
    String(v).toLowerCase(),
  )
    ? String(v).toLowerCase()
    : 'info';
const row = (
  title,
  asset,
  description,
  level = 'info',
  recommendation = '',
) => ({
  title: text(title, 300) || 'Imported observation',
  asset: text(asset, 1000),
  description: text(description),
  severity: severity(level),
  recommendation: text(recommendation, 4000),
});
function parseJson(source) {
  try {
    return JSON.parse(source);
  } catch {
    invalid();
  }
}
function jsonLines(source) {
  const lines = source.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length > MAX_IMPORT_ROWS) invalid('too_many_records');
  return lines.map(parseJson);
}
function nmap(source) {
  // Nmap's normal bare DOCTYPE is accepted. Internal/external DTDs and entities are not.
  const cleaned = source.replace(/<!DOCTYPE\s+nmaprun\s*>/i, '');
  if (/<!DOCTYPE|<!ENTITY/i.test(cleaned)) invalid('xml_entities_forbidden');
  if (XMLValidator.validate(cleaned) !== true) invalid();
  const parsed = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    processEntities: false,
    parseTagValue: false,
    parseAttributeValue: false,
  }).parse(cleaned);
  if (!plain(parsed.nmaprun)) invalid();
  const out = [];
  for (const host of array(parsed.nmaprun.host)) {
    if (!plain(host)) invalid();
    const address =
      array(host.address).find((a) =>
        ['ipv4', 'ipv6'].includes(a?.['@_addrtype']),
      )?.['@_addr'] ||
      array(host.address)[0]?.['@_addr'] ||
      '';
    for (const port of array(host.ports?.port)) {
      if (port?.state?.['@_state'] !== 'open') continue;
      const number = port['@_portid'],
        protocol = port['@_protocol'];
      if (
        !/^\d{1,5}$/.test(number) ||
        Number(number) > 65535 ||
        !['tcp', 'udp', 'sctp', 'ip'].includes(protocol)
      )
        invalid();
      const service = port.service || {};
      out.push(
        row(
          `Open ${protocol}/${number}`,
          address,
          `Service: ${text(service['@_name'])}\nProduct: ${text(service['@_product'])}\nVersion: ${text(service['@_version'])}\nAn open port alone is not a confirmed vulnerability.`,
        ),
      );
      if (out.length > MAX_IMPORT_ROWS) invalid('too_many_records');
    }
  }
  return out;
}
function zap(source) {
  const value = parseJson(source);
  if (!plain(value) || !Array.isArray(value.site)) invalid();
  const out = [];
  for (const site of value.site) {
    if (!plain(site) || !Array.isArray(site.alerts)) invalid();
    for (const alert of site.alerts) {
      if (!plain(alert) || (!alert.name && !alert.alert)) invalid();
      const instances = array(alert.instances),
        assets = instances.map((i) => text(i.uri, 1000)).filter(Boolean);
      out.push(
        row(
          alert.name || alert.alert,
          assets.join('\n') || site['@name'],
          alert.desc || alert.description,
          ['info', 'low', 'medium', 'high'][Number(alert.riskcode)] || 'info',
          alert.solution,
        ),
      );
      if (out.length > MAX_IMPORT_ROWS) invalid('too_many_records');
    }
  }
  return out;
}
function sarif(source) {
  const value = parseJson(source);
  if (!plain(value) || value.version !== '2.1.0' || !Array.isArray(value.runs))
    invalid();
  const out = [];
  for (const run of value.runs) {
    if (!plain(run) || !plain(run.tool?.driver)) invalid();
    const rules = array(run.tool.driver.rules);
    if (run.results !== undefined && !Array.isArray(run.results)) invalid();
    for (const result of run.results || []) {
      if (!plain(result) || !plain(result.message)) invalid();
      const rule = rules.find((r) => r.id === result.ruleId) || {},
        location = result.locations?.[0]?.physicalLocation;
      const uri = location?.artifactLocation?.uri || '',
        line = location?.region?.startLine;
      const score = Number(
        result.properties?.['security-severity'] ??
          rule.properties?.['security-severity'],
      );
      const level = Number.isFinite(score)
        ? score >= 9
          ? 'critical'
          : score >= 7
            ? 'high'
            : score >= 4
              ? 'medium'
              : score > 0
                ? 'low'
                : 'info'
        : { error: 'high', warning: 'medium', note: 'info', none: 'info' }[
            result.level || rule.defaultConfiguration?.level
          ] || 'info';
      out.push(
        row(
          rule.shortDescription?.text || result.ruleId || 'SARIF result',
          uri + (line ? `:${line}` : ''),
          result.message.text || result.message.markdown,
          level,
          rule.help?.text || rule.help?.markdown,
        ),
      );
      if (out.length > MAX_IMPORT_ROWS) invalid('too_many_records');
    }
  }
  return out;
}
function zeek(source) {
  return jsonLines(source).map((r) => {
    if (
      !plain(r) ||
      !r.uid ||
      !r['id.orig_h'] ||
      !r['id.resp_h'] ||
      !Number.isFinite(Number(r.ts))
    )
      invalid();
    const time = new Date(Number(r.ts) * 1000);
    if (!Number.isFinite(time.getTime())) invalid();
    return row(
      `Connection ${text(r.uid, 100)}`,
      `${r['id.orig_h']} → ${r['id.resp_h']}:${r['id.resp_p'] ?? ''}`,
      `UTC: ${time.toISOString()}\nProtocol: ${text(r.proto)}\nService: ${text(r.service)}\nState: ${text(r.conn_state)}\nOriginal bytes: ${text(r.orig_bytes)}\nResponse bytes: ${text(r.resp_bytes)}`,
    );
  });
}
function volatility(source) {
  const data = parseJson(source);
  if (!Array.isArray(data)) invalid();
  const out = [];
  function walk(items, depth = 0) {
    if (depth > 16) invalid('nested_data_too_deep');
    for (const r of items) {
      if (!plain(r)) invalid();
      const values = Object.entries(r).filter(([k]) => k !== '__children');
      if (!values.length) invalid();
      out.push(
        row(
          r.ImageFileName ||
            r.Name ||
            (r.PID && `Process ${r.PID}`) ||
            'Memory observation',
          r.PID ? `PID ${r.PID}` : 'Memory image',
          values
            .map(
              ([k, v]) =>
                `${k}: ${text(plain(v) || Array.isArray(v) ? JSON.stringify(v) : v, 1000)}`,
            )
            .join('\n'),
        ),
      );
      if (out.length > MAX_IMPORT_ROWS) invalid('too_many_records');
      if (r.__children !== undefined) {
        if (!Array.isArray(r.__children)) invalid();
        walk(r.__children, depth + 1);
      }
    }
  }
  walk(data);
  return out;
}
function nuclei(source) {
  return jsonLines(source).map((r) => {
    if (!plain(r) || !r['template-id'] || !plain(r.info) || !r.info.name)
      invalid();
    return row(
      r.info.name,
      r['matched-at'] || r.host,
      `Template: ${text(r['template-id'])}\n${text(r.info.description)}\nMatcher: ${text(r['matcher-name'])}`,
      r.info.severity,
      r.info.remediation,
    );
  });
}
export function parseConnector(id, source) {
  if (typeof source !== 'string' || source.length > 2 * 1024 * 1024)
    invalid('connector_file_too_large');
  const parser = {
    'nmap-xml': nmap,
    'zap-json': zap,
    sarif: sarif,
    'zeek-jsonl': zeek,
    'volatility-json': volatility,
    'nuclei-jsonl': nuclei,
  }[id];
  if (!parser) invalid('unsupported_connector');
  let result;
  try {
    result = parser(source.replace(/^\uFEFF/, ''));
  } catch (e) {
    if (e.status) throw e;
    invalid();
  }
  if (result.length > MAX_IMPORT_ROWS) invalid('too_many_records');
  return {
    connector: id,
    version: '1.0.0',
    records: result,
    count: result.length,
  };
}

