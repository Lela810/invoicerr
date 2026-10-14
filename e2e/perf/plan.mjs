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

export function buildPlan(openapi, context) {
  const requests = [];
  const scripted = [];
  const unmeasured = [];
  for (const [template, operations] of Object.entries(openapi.paths ?? {})) {
    for (const method of METHODS) {
      const operation = operations[method];
      if (!operation) continue;
      const route = `${method.toUpperCase()} ${template}`;
      if (EXCLUDED[route]) {
        unmeasured.push({ route, reason: EXCLUDED[route] });
        continue;
      }
      if (method !== 'get') {
        if (SCRIPTED.includes(route)) scripted.push(route);
        else unmeasured.push({ route, reason: 'mutating route outside the scripted scenario' });
        continue;
      }
      const params = [...(operations.parameters ?? []), ...(operation.parameters ?? [])];
      const path = resolvePath(template, context);
      const query = path.error ? path : resolveQuery(params, context);
      if (path.error || query.error) {
        unmeasured.push({ route, reason: path.error ?? query.error });
        continue;
      }
      requests.push({ route, url: query.query ? `${path.path}?${query.query}` : path.path });
    }
  }
  return { requests, scripted, unmeasured };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [openapiPath, contextPath, out] = process.argv.slice(2);
  const plan = buildPlan(JSON.parse(readFileSync(openapiPath, 'utf8')), JSON.parse(readFileSync(contextPath, 'utf8')));
  writeFileSync(out, `${JSON.stringify(plan, null, 2)}\n`);
  console.log(
    `plan: ${plan.requests.length} GET routes, ${plan.scripted.length} scripted, ${plan.unmeasured.length} not measured`,
  );
}
