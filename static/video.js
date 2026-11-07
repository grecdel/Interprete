'use strict';

// Interview video: the camera, or a screen or window with its sound (a broadcast, a video call).
// The whole session is recorded in one file kept in memory; transcript lines point to its timeline.
window.InterpreteVideo = class {
  static supported() { return Boolean(window.MediaRecorder && navigator.mediaDevices); }
  async open(kind) {
    const devices = navigator.mediaDevices;
    if (kind === 'screen') {
      if (!devices.getDisplayMedia) throw new Error('Ce système ne permet pas de filmer l’écran.');
      this.stream = await devices.getDisplayMedia({video: {frameRate: 24}, audio: true});
      // Without sound from the window (Linux often provides none), the microphone is mixed in.
      if (!this.stream.getAudioTracks().length) {
        try { const microphone = await devices.getUserMedia({audio: true}); microphone.getAudioTracks().forEach(track => this.stream.addTrack(track)); this.microphoneAdded = true; }
        catch { /* The video is still recorded, without transcription. */ }
      }
    } else this.stream = await devices.getUserMedia({video: {width: {ideal: 1280}, height: {ideal: 720}}, audio: true});
    this.stream.getVideoTracks()[0]?.addEventListener('ended', () => this.onEnded?.());
    return this.stream;
  }
  start() {
    const types = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm', 'video/mp4'];
    this.mimeType = types.find(type => MediaRecorder.isTypeSupported(type)) || '';
    this.chunks = []; this.startedAt = Date.now();
    this.recorder = new MediaRecorder(this.stream, this.mimeType ? {mimeType: this.mimeType, videoBitsPerSecond: 1500000} : undefined);
    this.recorder.ondataavailable = event => { if (event.data.size) this.chunks.push(event.data); };
    this.recorder.start(1000);
  }
  /** Seconds from the start of the video to a moment given in milliseconds since 1970. */
  offset(at) { return this.startedAt ? Math.max(0, (at - this.startedAt) / 1000) : null; }
  stop() {
    return new Promise(resolve => {
      const finish = () => {
        this.stream?.getTracks().forEach(track => track.stop());
        const type = (this.mimeType || 'video/webm').split(';')[0];
        resolve(this.chunks?.length ? {blob: new Blob(this.chunks, {type}), type, duration: (Date.now() - this.startedAt) / 1000, startedAt: this.startedAt} : null);
      };
      if (this.recorder?.state === 'recording') { this.recorder.onstop = finish; this.recorder.stop(); } else finish();
    });
  }
};
