'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const {API_PATHS, validKey, externalUrl, panelBounds, bubbleBounds} = require('../desktop/security.cjs');

test('desktop bridge never accepts arbitrary remote destinations', () => {
  assert.equal(API_PATHS.has('https://example.com'), false);
  assert.equal(API_PATHS.has('/api/desktop/key'), false);
  assert.equal(API_PATHS.has('/api/verify'), true);
  for (const url of ['javascript:alert(1)', 'file:///etc/passwd', 'https://user:secret@example.com']) assert.equal(externalUrl(url), null);
  assert.equal(externalUrl('https://www.insee.fr/'), 'https://www.insee.fr/');
});
test('panel and bubble remain within the selected display', () => {
  for (const area of [{x: 0, y: 0, width: 1440, height: 900}, {x: -1920, y: 0, width: 1920, height: 1080}]) {
    for (const box of [panelBounds(area), bubbleBounds(area)]) {
      assert.ok(box.x >= area.x && box.y >= area.y);
      assert.ok(box.x + box.width <= area.x + area.width);
      assert.ok(box.y + box.height <= area.y + area.height);
    }
  }
});
test('key entry accepts a value without exposing or coercing another type', () => {
  assert.equal(validKey('fake-project-key-for-tests'), true);
  assert.equal(validKey('short'), false);
  assert.equal(validKey({toString: () => 'fake-project-key-for-tests'}), false);
  assert.equal(validKey('fake key containing spaces'), false);
});
function recorderHarness(transcribe, onText, onError) {
  let clock = 0, stopped = 0;
  class FakeRecorder {
    static isTypeSupported() { return true; }
    start() { this.state = 'recording'; }
    stop() {
      this.state = 'inactive';
      queueMicrotask(() => { this.ondataavailable({data: new Blob(['audio'])}); this.onstop(); });
    }
  }
  const globals = {window: {}, Blob, MediaRecorder: FakeRecorder, navigator: {mediaDevices: {getUserMedia: async () => ({getTracks: () => [{stop: () => stopped++}]})}}, Date: {now: () => clock}, setTimeout: () => 1, clearTimeout() {}};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../static/capture.js'), 'utf8'), globals);
  return {capture: new globals.window.InterpreteMicrophone({transcribe, onText, onError}), advance: () => { clock += 1000; }, stopped: () => stopped};
}
test('ending an interview waits for the final audio transcription', async () => {
  const texts = []; let release;
  const gate = new Promise(resolve => { release = resolve; });
  const h = recorderHarness(async () => { await gate; return {text: 'La dernière phrase.'}; }, text => texts.push(text), error => assert.fail(error));
  await h.capture.start(); h.advance();
  let complete = false;
  const completion = h.capture.stop().then(() => { complete = true; });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(complete, false);
  assert.equal(h.stopped(), 1);
  release(); await completion;
  assert.deepEqual(texts, ['La dernière phrase.']);
});
test('transcription failure is visible and does not hang the export', async () => {
  const errors = [];
  const h = recorderHarness(async () => { throw new Error('Service indisponible.'); }, () => assert.fail('No transcript expected'), error => errors.push(error));
  await h.capture.start(); h.advance(); await h.capture.stop();
  assert.equal(errors.length, 1);
  assert.match(errors[0], /Service indisponible/);
});
