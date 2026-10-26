import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../worker.js';

test('photo privacy events reach analytics without file contents', async () => {
  const rows = [];
  const env = { DB: { prepare: () => ({ bind: (...args) => ({ run: async () => rows.push(args) }) }) } };
  for (const e of ['exif_open', 'exif_start', 'exif_fail', 'exif_done', 'exif_copy_json', 'exif_download', 'compress']) {
    const response = await worker.fetch(new Request('https://image2base64.com/api/evt', {
      method: 'POST', headers: {'content-type': 'application/json', 'user-agent': 'Mozilla/5.0'},
      body: JSON.stringify({e, p: '/remove-photo-metadata', x1: 'cleaned'})
    }), env);
    assert.equal(response.status, 204);
    assert.equal(rows.at(-1)[0], e);
  }
  assert.equal(rows.length, 7);
  await worker.fetch(new Request('https://image2base64.com/api/evt', {method: 'POST', body: JSON.stringify({e:'unknown'})}), env);
  assert.equal(rows.length, 7);
});
