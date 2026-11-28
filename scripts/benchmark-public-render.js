const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const { execFileSync, fork } = require('node:child_process');
const { performance } = require('node:perf_hooks');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const ts = require('typescript');
const { scenario } = require('./benchmark-search-pipeline');
const ROOT = path.resolve(__dirname, '..');
const BASELINE = '50611eb151332af5af4fed5e4610eaa009d81acc';
// Isolated fixture transport only. Prepared wire payloads exclude database-side
// filtering/serialization; JSON.parse still runs for every application read.
function projectRow(row, selection, table) {
    const parts = [];
    let depth = 0, start = 0;
    for (let i = 0; i < selection.length; i++) {
        if (selection[i] === '(')
            depth++;
        if (selection[i] === ')')
            depth--;
        if (selection[i] === ',' && depth === 0) {
            parts.push(selection.slice(start, i));
            start = i + 1;
        }
    }
    parts.push(selection.slice(start));
    const result = {};
    for (const raw of parts) {
        const part = raw.trim();
        if (part === '*') {
            const virtual = { products: ['offers'], offers: ['retailer'], retailer_products: ['product_variant'] }[table] || [];
            for (const [key, value] of Object.entries(row))
                if (!virtual.includes(key))
                    result[key] = value;
        }
        else if (part.includes('(')) {
            const name = part.slice(0, part.indexOf('(')).split(':')[0].trim();
            const nested = part.slice(part.indexOf('(') + 1, part.lastIndexOf(')'));
            const value = row[name];
            result[name] = Array.isArray(value) ? value.map(v => projectRow(v, nested)) : value ? projectRow(value, nested) : null;
        }
        else if (part)
            result[part] = row[part];
    }
    return result;
}
function fixture(count = 120, category = 'Pre Workout', variantsPerProduct = 3) {
    const data = scenario({ name: 'render', products: count, category, variantsPerProduct, structuredEvery: 4 });
    const byVariant = new Map(data.variants.map(v => [v.id, v]));
    for (const v of data.variants)
        Object.assign(v, { variant_key: 'variant-' + v.id, is_active: true, is_default: v.id === data.variants.find(x => x.product_id === v.product_id).id });
    const retailerProducts = [], offers = [], history = [];
    for (const p of data.products) {
        Object.assign(p, { is_active: true, merged_into_product_id: null, merged_at: null, gtin: null, price: null, unit_count: null, unit_type: null });
        for (const o of p.offers) {
            o.id = offers.length + 30000;
            Object.assign(o, { product_id: p.id, retailer_id: o.retailer.id, retailer_product_id: o.id + 100000, total_price: o.shipping_cost === null ? null : o.price + o.shipping_cost });
            Object.assign(o.retailer, { website: 'https://example.test' });
            offers.push(o);
            retailerProducts.push({ id: o.retailer_product_id, external_options: null, product_variant: byVariant.get(o.product_variant_id) });
            for (let d = 1; d <= 28; d++)
                history.push({ offer_id: o.id, total_price: o.total_price, checked_at: new Date(Date.now() - d * 86400000).toISOString() });
        }
    }
    data.candidates.forEach((c, i) => c.id = i + 1);
    return { ...data, retailerProducts, offers, history };
}
function loadPage(data, route, { ref = null, profile = false, warmHub = true } = {}) {
    const modules = new Map(), hubs = new Map(), wires = new Map(), requestMemo = new Map(), calls = [];
    const clientTypes = new Map(), boundaryProps = [];
    const counters = { numberFormat: 0, dateTimeFormat: 0, currencyCalls: 0 };
    function database() {
        return { from(table) {
                assert.ok(['products', 'offers', 'product_variants', 'retailer_products', 'nutrition_candidates', 'price_history'].includes(table));
                const shape = { table }, conditions = [];
                let page = null, order = null, single = false;
                const b = { select: (columns, options) => { shape.select = [columns, options]; return b; }, eq: (k, v) => { conditions.push(['eq', k, v]); return b; }, is: (k, v) => { conditions.push(['eq', k, v]); return b; }, in: (k, v) => { conditions.push(['in', k, v]); return b; }, ilike: (k, v) => { conditions.push(['ilike', k, v]); return b; }, order: (k, v) => { order = [k, v]; return b; }, range: (a, z) => { page = [a, z]; return b; }, maybeSingle: () => { single = true; return b; }, then(resolve, reject) {
                        const key = JSON.stringify({ shape, conditions, page, order, single });
                        if (!wires.has(key)) {
                            let rows = ({ products: data.products, offers: data.offers, product_variants: data.variants, retailer_products: data.retailerProducts, nutrition_candidates: data.candidates, price_history: data.history })[table];
                            for (const [op, k, v] of conditions) {
                                const ids = op === 'in' ? new Set(v.map(String)) : null;
                                rows = rows.filter(r => op === 'in' ? ids.has(String(r[k])) : op === 'ilike' ? String(r[k]).toLowerCase() === String(v).toLowerCase() : v === null ? r[k] === null : String(r[k]) === String(v));
                            }
                            const count = rows.length;
                            if (order)
                                rows = [...rows].sort((a, b) => typeof a[order[0]] === 'number' ? a[order[0]] - b[order[0]] : String(a[order[0]]).localeCompare(String(b[order[0]])));
                            rows = page ? rows.slice(page[0], page[1] + 1) : rows.slice(0, 1000);
                            rows = rows.map(row => projectRow(row, shape.select[0], table));
                            const text = JSON.stringify(single ? rows[0] || null : rows);
                            wires.set(key, { text, count, rows: single ? Number(Boolean(rows[0])) : rows.length, bytes: Buffer.byteLength(text) });
                        }
                        const wire = wires.get(key);
                        calls.push({ ...shape, conditions, page, rows: wire.rows, bytes: wire.bytes });
                        return Promise.resolve({ data: JSON.parse(wire.text), error: null, count: wire.count }).then(resolve, reject);
                    } };
                return b;
            } };
    }
    ;
    const Link = ({ href, children, ...p }) => { delete p.prefetch; return React.createElement('a', { ...p, href: typeof href === 'string' ? href : href.pathname + '?' + new URLSearchParams(href.query) }, children); };
    const Image = props => { const p = { ...props }; delete p.fill; delete p.unoptimized; delete p.priority; return React.createElement('img', p); };
    const cache = fn => { const memo = new Map(); requestMemo.set(fn, memo); return (...a) => { const k = JSON.stringify(a); if (!memo.has(k))
        memo.set(k, fn(...a)); return memo.get(k); }; };
    const stub = (name) => ({ __esModule: true, default: props => React.createElement('div', { 'data-boundary': name, 'data-props': JSON.stringify(props) }) });
    function compile(file) {
        if (modules.has(file))
            return modules.get(file).exports;
        if (/supabase(Admin)?\.ts$/.test(file))
            return path.basename(file) === 'supabase.ts' ? { supabase: database() } : { supabaseAdmin: database() };
        const relative = path.relative(ROOT, file).replaceAll(path.sep, '/');
        if (relative === 'app/components/PriceHistoryChart.tsx')
            return stub('PriceHistoryChart');
        const mod = new Module(file);
        mod.filename = file;
        mod.paths = Module._nodeModulePaths(path.dirname(file));
        modules.set(file, mod);
        const native = mod.require.bind(mod);
        mod.require = request => {
            if (request === 'server-only')
                return {};
            if (request === 'react')
                return { ...React, cache };
            if (request === 'react/jsx-runtime') {
                const runtime = native(request);
                const wrap = fn => (type, props, key) => {
                    if (clientTypes.has(type))
                        boundaryProps.push({ component: clientTypes.get(type), props: JSON.parse(JSON.stringify(props, (k, v) => k === '_owner' ? undefined : typeof v === 'function' ? v.name : v)) });
                    return fn(type, props, key);
                };
                return { ...runtime, jsx: wrap(runtime.jsx), jsxs: wrap(runtime.jsxs) };
            }
            if (request === 'next/link')
                return { __esModule: true, default: Link };
            if (request === 'next/image')
                return { __esModule: true, default: Image, getImageProps: p => ({ props: p }) };
            if (request === 'next/navigation')
                return { notFound: () => { throw Error('NOT_FOUND'); }, redirect: u => { throw Error('REDIRECT ' + u); }, permanentRedirect: u => { throw Error('REDIRECT ' + u); }, usePathname: () => route, useSearchParams: () => new URLSearchParams(), useRouter: () => ({}) };
            if (request === 'next/cache')
                return { unstable_cache: (fn, parts) => (...a) => { const k = JSON.stringify([parts, a]); if (!hubs.has(k))
                        hubs.set(k, fn(...a)); return hubs.get(k); } };
            if (request.startsWith('.'))
                for (const ext of ['.ts', '.tsx']) {
                    const p = path.resolve(path.dirname(file), request + ext);
                    if (fs.existsSync(p))
                        return compile(p);
                }
            return native(request);
        };
        let source = ref ? execFileSync('git', ['show', ref + ':' + relative], { encoding: 'utf8' }) : fs.readFileSync(file, 'utf8');
        source = source.replace(/\r\n/g, '\n');
        let js = ts.transpileModule(source, { fileName: file, compilerOptions: { esModuleInterop: true, jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
        if (profile) {
            mod.__counters = counters;
            js = 'const Intl={...globalThis.Intl,NumberFormat:class extends globalThis.Intl.NumberFormat{constructor(...a){super(...a);module.__counters.numberFormat++}},DateTimeFormat:class extends globalThis.Intl.DateTimeFormat{constructor(...a){super(...a);module.__counters.dateTimeFormat++}}};\n' + js;
            if (relative === 'app/lib/pricing.ts')
                js += '\nconst __currency=exports.formatCurrency;exports.formatCurrency=(v)=>{module.__counters.currencyCalls++;return __currency(v)};';
        }
        mod._compile(js, file);
        if (/^\s*["']use client["']/.test(source))
            for (const [name, value] of Object.entries(mod.exports))
                if (typeof value === 'function')
                    clientTypes.set(value, relative + ':' + name);
        return mod.exports;
    }
    const page = compile(path.join(ROOT, 'app', route, 'page.tsx'));
    return { calls, counters, async run(params = {}) {
            calls.length = 0;
            boundaryProps.length = 0;
            Object.keys(counters).forEach(k => counters[k] = 0);
            for (const m of requestMemo.values())
                m.clear();
            if (!warmHub)
                hubs.clear();
            const args = route === 'product/[id]' ? { params: Promise.resolve({ id: data.products[4].slug }), searchParams: Promise.resolve(params) } : { searchParams: Promise.resolve(params) };
            const metadata = await page.generateMetadata(args);
            const start = performance.now();
            const tree = await page.default(args);
            const resolvedMs = performance.now() - start;
            const renderStart = performance.now();
            const html = renderToStaticMarkup(tree);
            return { metadata, html, boundaryProps: [...boundaryProps], resolvedMs, renderMs: performance.now() - renderStart };
        } };
}
const median = xs => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];
// Keep revisions in separate V8 heaps: one revision's transient Intl objects
// must not make the next revision pay for their garbage collection.
function worker() {
    const child = fork(__filename, ['--worker'], { cwd: ROOT, env: require('./quality-gate').sanitizedEnvironment('production'), stdio: ['ignore', 'ignore', 'pipe', 'ipc'] });
    let pending = null, diagnostic = '';
    child.stderr.on('data', chunk => { diagnostic += chunk.toString(); });
    child.on('message', message => { const p = pending; pending = null; if (message.error)
        p.reject(Error(message.error));
    else
        p.resolve(message.result); });
    child.on('error', error => { if (pending) {
        pending.reject(error);
        pending = null;
    } });
    child.on('exit', code => { if (pending) {
        pending.reject(Error(`Benchmark worker exited ${code}: ${diagnostic}`));
        pending = null;
    } });
    return { request: message => new Promise((resolve, reject) => { assert.equal(pending, null); pending = { resolve, reject }; child.send(message); }), close: () => child.kill() };
}
async function compare(data, route, opts = {}, samples = 15, ref = BASELINE) {
    const { params = {}, ...loadOptions } = opts;
    const workers = { before: worker(), after: worker() };
    try {
        const first = await workers.before.request({ command: 'init', data, route, params, options: { ...loadOptions, ref } });
        const second = await workers.after.request({ command: 'init', data, route, params, options: loadOptions });
        for (const key of ['metadata', 'html', 'boundaryProps', 'calls'])
            assert.deepEqual(first[key], second[key], key + ' parity');
        for (const w of Object.values(workers))
            await w.request({ command: 'warm', minimumMs: 1000 });
        const pilot = await workers.after.request({ command: 'warm', minimumMs: 200 });
        const loops = Math.max(3, Math.min(1000, Math.ceil(400 / pilot.wallMs)));
        const timings = { before: [], after: [] };
        for (let i = 0; i < samples; i++)
            for (const name of i % 2 ? ['after', 'before'] : ['before', 'after'])
                timings[name].push(await workers[name].request({ command: 'batch', loops }));
        const profiles = {};
        for (const [name, w] of Object.entries(workers))
            profiles[name] = await w.request({ command: 'profile' });
        return { route, products: data.products.length, offers: data.offers.length, warmHub: opts.warmHub !== false, params, parity: 'PASS', htmlBytes: Buffer.byteLength(first.html), clientPropJsonBytes: Buffer.byteLength(JSON.stringify(first.boundaryProps)), initialQueries: first.calls, loops, median: Object.fromEntries(Object.entries(timings).map(([k, v]) => [k, { cpuMs: median(v.map(x => x.cpuMs)), wallMs: median(v.map(x => x.wallMs)) }])), profiles, timings };
    }
    finally {
        for (const w of Object.values(workers))
            w.close();
    }
}
module.exports = { fixture, loadPage, compare };
if (require.main === module && process.argv[2] === '--worker') {
    let runner, fixtureData, route, params, options;
    process.on('disconnect', () => process.exit(0));
    process.on('message', async (message) => {
        try {
            let result;
            if (message.command === 'init') {
                ({ data: fixtureData, route, params, options } = message);
                runner = loadPage(fixtureData, route, options);
                result = { ...await runner.run(params), calls: runner.calls };
            }
            else if (message.command === 'profile') {
                const measured = loadPage(fixtureData, route, { ...options, profile: true });
                await measured.run(params);
                const measuredResult = await measured.run(params);
                result = { ...measured.counters, resolvedMs: measuredResult.resolvedMs, renderMs: measuredResult.renderMs, queries: measured.calls.map(({ table, rows, bytes }) => ({ table, rows, bytes })) };
            }
            else {
                const start = performance.now(), cpu = process.cpuUsage();
                let iterations = 0;
                do {
                    await runner.run(params);
                    iterations++;
                } while (message.command === 'warm' ? performance.now() - start < message.minimumMs : iterations < message.loops);
                const used = process.cpuUsage(cpu);
                result = { cpuMs: (used.user + used.system) / 1000 / iterations, wallMs: (performance.now() - start) / iterations };
            }
            process.send({ result });
        }
        catch (error) {
            process.send({ error: error.stack });
        }
    });
}
else if (require.main === module)
    (async () => {
        const ref = process.argv[2] || BASELINE;
        assert.match(ref, /^[a-f0-9]{40}$/);
        const out = [];
        const specs = [
            ['product/[id]', 90, 'Pre Workout', 3, true, {}],
            ['compare', 200, 'Pre Workout', 1, true, {}],
            ['compare', 200, 'Pre Workout', 1, true, { left: '10004', right: '10008' }],
            ['compare', 200, 'Pre Workout', 1, false, {}],
            ['creatine', 90, 'Creatine', 3, true, {}],
            ['creatine', 90, 'Creatine', 3, false, {}],
            ['pre-workout', 150, 'Pre Workout', 3, true, {}],
        ];
        for (const [index, [route, count, category, variants, warmHub, params]] of specs.entries())
            if (process.argv[3] === undefined || Number(process.argv[3]) === index)
                out.push(await compare(fixture(count, category, variants), route, { warmHub, params }, 15, ref));
        console.log(JSON.stringify({ baseline: ref, at: new Date().toISOString(), node: process.version, workerNodeEnv: 'production', samplesPerRevision: 15, warmupMs: 1000, pilotMs: 200, targetBatchMs: 400, separateRevisionProcesses: true, scope: 'Offline actual page/data modules and React production static SSR; synthetic fixtures, no production/network/SQL execution or full Next HTTP/Flight encoding. Only framework hooks/links/images and chart DOM are substituted. Entire HTML, metadata, client-boundary props and read shapes must match. Existing hour-bucket hub cache is simulated separately from request memoization; cold means hub-data miss, not a Vercel cold start. Revisions use separate processes, one timed at a time; formatter counters run separately from uninstrumented timings.', results: out }, null, 2));
    })().catch(e => { console.error(e.stack); process.exitCode = 1; });
