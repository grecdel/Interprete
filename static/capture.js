'use strict';

// Standalone recordings are required: later MediaRecorder timeslices alone
// may not contain a valid WebM header for the transcription API.
window.InterpreteMicrophone = class {
  constructor({transcribe, onText, onError}) {
    this.transcribe = transcribe; this.onText = onText; this.onError = onError;
    this.queue = []; this.waiters = []; this.active = false; this.processing = false; this.stopping = false;
  }
  async start() {
    const supported = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4'].find(type => MediaRecorder.isTypeSupported(type));
    if (!supported) throw new Error('Ce système ne propose pas de format audio compatible.');
    this.stream = await navigator.mediaDevices.getUserMedia({audio: true, video: false});
    this.mimeType = supported; this.active = true; this.recordPart();
  }
  recordPart() {
    if (!this.active) return;
    const chunks = []; const started = Date.now();
    const recorder = new MediaRecorder(this.stream, {mimeType: this.mimeType}); this.recorder = recorder;
    recorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
    recorder.onerror = () => { this.stop(); this.onError('L’enregistrement a été interrompu.'); };
    recorder.onstop = () => {
      this.stopping = false;
      if (chunks.length && Date.now() - started > 350) {
        this.queue.push(new Blob(chunks, {type: this.mimeType}));
        if (this.queue.length > 3) { this.stop(); this.onError('La transcription prend du retard. L’écoute est en pause le temps de traiter les extraits.'); }
        this.pump();
      }
      if (this.active) this.recordPart();
      this.notify();
    };
    recorder.start();
    this.timer = setTimeout(() => { if (recorder.state === 'recording') recorder.stop(); }, 12000);
  }
  async pump() {
    if (this.processing) return;
    this.processing = true;
    while (this.queue.length) {
      const audio = this.queue.shift();
      try {
        const result = await this.transcribe(await audio.arrayBuffer(), this.mimeType);
        if (result.text?.trim()) this.onText(result.text.trim());
      } catch (error) {
        this.queue.length = 0;
        this.stop(); this.onError(`Un extrait n’a pas pu être transcrit. ${error.message}`);
        break;
      }
    }
    this.processing = false; this.notify();
  }
  stop() {
    this.active = false; clearTimeout(this.timer);
    if (this.recorder?.state === 'recording') { this.stopping = true; this.recorder.stop(); }
    this.stream?.getTracks().forEach(track => track.stop());
    const completion = new Promise(resolve => this.waiters.push(resolve));
    this.notify(); return completion;
  }
  notify() {
    if (!this.active && !this.processing && !this.stopping && !this.queue.length) this.waiters.splice(0).forEach(resolve => resolve());
  }
};
