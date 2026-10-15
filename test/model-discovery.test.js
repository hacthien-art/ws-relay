import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:net';
import { setTimeout as delay } from 'node:timers/promises';
import test from 'node:test';

const expectedIds = [
    'gemini-4-argon', 'gemini-3.8-flash', 'gemini-3.6-flash',
    'gemini-3.5-flash-lite', 'gemini-3.1-pro-preview',
    'gemini-3.1-pro-preview-customtools',
    'gemini-3.1-flash-lite', 'gemini-3-flash-preview',
    'gemini-2.5-pro', 'gemini-2.5-flash', 'gemini-2.5-flash-lite',
].sort();

async function unusedPort() {
    const server = createServer();
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    const { port } = server.address();
    await new Promise(resolve => server.close(resolve));
    return port;
}

async function startService(t, file, env, port) {
    const child = spawn(process.execPath, [file], {
        cwd: new URL('../', import.meta.url),
        env: { ...process.env, ...env },
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsHide: true,
    });
    let output = '';
    child.stdout.on('data', chunk => output += chunk);
    child.stderr.on('data', chunk => output += chunk);
    let spawnError;
    child.on('error', error => { spawnError = error; });
    t.after(async () => {
        if (child.exitCode === null && child.signalCode === null) {
            const exited = once(child, 'exit');
            child.kill();
            await exited;
        }
    });

    const base = `http://127.0.0.1:${port}`;
    for (let i = 0; i < 100; i++) {
        if (spawnError) throw spawnError;
        assert.equal(child.exitCode, null, output);
        try {
            const response = await fetch(`${base}/health`, { signal: AbortSignal.timeout(500) });
            if (response.ok) return base;
        } catch { /* Wait for the HTTP listener. */ }
        await delay(50);
    }
    assert.fail(`Service did not start: ${output}`);
}

for (const file of ['server.js', 'bridge.js']) {
    test(`${file}: discover current chat models without a proxy`, { timeout: 15000 }, async t => {
        const port = await unusedPort();
        const base = await startService(t, file, {
            PORT: String(port),
            BRIDGE_PORT: String(port),
            WS_RELAY: 'ws://127.0.0.1:1', // Keep tests offline.
            ROOM_CODE: 'discovery-test',
        }, port);
        const prefix = file === 'server.js' ? '/api/discovery-test' : '';

        for (const path of ['/models', '/v1/models', '/v1beta/openai/models', '/v1beta/models']) {
            await t.test(path, async () => {
                const response = await fetch(`${base}${prefix}${path}?key=unused`, {
                    signal: AbortSignal.timeout(2000),
                });
                assert.equal(response.status, 200);
                assert.equal(response.headers.get('access-control-allow-origin'), '*');
                assert.match(response.headers.get('content-type'), /application\/json/);
                const body = await response.json();
                const native = path === '/v1beta/models';
                const models = native ? body.models : body.data;
                const ids = models.map(model => native ? model.name.replace(/^models\//, '') : model.id);
                assert.deepEqual(ids.sort(), expectedIds);
                assert.equal(new Set(ids).size, ids.length);
                if (native) {
                    for (const model of models) {
                        assert.match(model.name, /^models\/gemini-/);
                        assert.ok(model.displayName);
                        assert.ok(model.inputTokenLimit > 0);
                        assert.ok(model.outputTokenLimit > 0);
                        assert.ok(model.supportedGenerationMethods.includes('generateContent'));
                    }
                } else {
                    assert.equal(body.object, 'list');
                    for (const model of models) {
                        assert.equal(model.object, 'model');
                        assert.equal(model.owned_by, 'google');
                        assert.equal(typeof model.created, 'number');
                    }
                }
            });
        }

        await t.test('CORS preflight', async () => {
            const response = await fetch(`${base}${prefix}/v1beta/models`, { method: 'OPTIONS' });
            assert.equal(response.status, 204);
            assert.equal(response.headers.get('access-control-allow-origin'), '*');
        });
    });
}
