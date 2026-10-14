// Turns the backend's OpenAPI document into the list of requests k6 replays, plus every route it
// will not measure and why. A new GET route is measured with no edit here as long as its parameters
// resolve through fixture.js.
//
//   node plan.mjs <openapi.json> <context.json> <plan.json>
import { readFileSync, writeFileSync } from 'node:fs';

import { EXCLUDED, OPTIONAL_QUERY, PATH_PARAMS, QUERY_VALUES, SCRIPTED } from './fixture.js';

const METHODS = ['get', 'post', 'put', 'patch', 'delete'];

function resolvePath(template, context) {
  const segments = template.split('/');
  const out = [];
  for (let i = 0; i < segments.length; i++) {
    const match = /^\{(.+)\}$/.exec(segments[i]);
    if (!match) {
      out.push(segments[i]);
      continue;
    }
    const resolver = PATH_PARAMS[`${segments[i - 1]}/${segments[i]}`] ?? PATH_PARAMS[segments[i]];
    const value = resolver?.(context);
    if (value === undefined || value === null || value === '') {
      return { error: `no seeded value for path parameter "${match[1]}"` };
    }
    out.push(encodeURIComponent(value));
  }
  return { path: out.join('/') };
}

function resolveQuery(parameters, context) {
  const pairs = [];
  for (const p of parameters.filter((p) => p.in === 'query')) {
    const resolver = QUERY_VALUES[p.name];
    if (p.required && !resolver) return { error: `no value for required query parameter "${p.name}"` };
    if (p.required || OPTIONAL_QUERY.includes(p.name)) pairs.push([p.name, resolver(context)]);
  }
  pairs.sort(([a], [b]) => OPTIONAL_QUERY.indexOf(a) - OPTIONAL_QUERY.indexOf(b));
  return { query: new URLSearchParams(pairs).toString() };
}

function classify(route, method, parameters, template, context) {
  if (EXCLUDED[route]) return { reason: EXCLUDED[route] };
  if (method !== 'get') {
    return SCRIPTED.includes(route) ? { scripted: true } : { reason: 'mutating route outside the scripted scenario' };
  }
  const path = resolvePath(template, context);
  if (path.error) return { reason: path.error };
  const query = resolveQuery(parameters, context);
  if (query.error) return { reason: query.error };
  return { url: query.query ? `${path.path}?${query.query}` : path.path };
}

export function buildPlan(openapi, context) {
  const plan = { requests: [], scripted: [], unmeasured: [] };
  for (const [template, operations] of Object.entries(openapi.paths ?? {})) {
    for (const method of METHODS.filter((m) => operations[m])) {
      const route = `${method.toUpperCase()} ${template}`;
      const parameters = [...(operations.parameters ?? []), ...(operations[method].parameters ?? [])];
      const outcome = classify(route, method, parameters, template, context);
      if (outcome.reason) plan.unmeasured.push({ route, reason: outcome.reason });
      else if (outcome.scripted) plan.scripted.push(route);
      else plan.requests.push({ route, url: outcome.url });
    }
  }
  return plan;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [openapiPath, contextPath, out] = process.argv.slice(2);
  const plan = buildPlan(JSON.parse(readFileSync(openapiPath, 'utf8')), JSON.parse(readFileSync(contextPath, 'utf8')));
  writeFileSync(out, `${JSON.stringify(plan, null, 2)}\n`);
  console.log(
    `plan: ${plan.requests.length} GET routes, ${plan.scripted.length} scripted, ${plan.unmeasured.length} not measured`,
  );
}
