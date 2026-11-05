/* One audio clock; existing instruments are never restarted at a phase boundary. */
(() => {
  'use strict';
  class TaanAudio {
    constructor(manifest) {
      this.manifest = manifest;
      this.context = null;
      this.nodes = [];
      this.upload = null;
      this.uploadNodes = new Set();
      this.epoch = null;
      this.mode = 'score';
      this.muted = false;
      this.revision = 0;
      this.fileBuffers = new WeakMap();
      this.raw = this.fetchStems().catch(() => null);
    }
    async fetchStems() {
      const buffers = [];
      // Limit simultaneous downloads so the local preview server can also
      // serve fonts and artwork without dropping audio connections.
      for (let i = 0; i < this.manifest.stems.length; i += 2) {
        buffers.push(...await Promise.all(this.manifest.stems.slice(i, i + 2).map(async stem => {
          const response = await fetch('assets/quiet-current/' + stem.file);
          if (!response.ok) throw new Error('The soundtrack could not be loaded.');
          return response.arrayBuffer();
        })));
      }
      return buffers;
    }
    ensureContext() {
      if (this.context) return this.context;
      const Context = globalThis.AudioContext || globalThis.webkitAudioContext;
      this.context = new Context({latencyHint:'playback'});
      this.master = this.context.createGain();
      this.master.gain.value = this.muted ? 0 : 1;
      this.master.connect(this.context.destination);
      this.scoreBus = this.context.createGain();
      this.scoreBus.connect(this.master);
      return this.context;
    }
    async prepare() {
      const context = this.ensureContext();
      // This call runs synchronously in the click handler, before loading files.
      const resumed = context.resume();
      if (!this.decoded) {
        this.decoded = (async () => {
          const raw = await this.raw || await this.fetchStems();
          return Promise.all(raw.map(bytes => context.decodeAudioData(bytes.slice(0))));
        })().catch(error => { this.decoded = null; throw error; });
      }
      await resumed;
      return this.decoded;
    }
    ramp(param, value, seconds = .85, at = this.context.currentTime) {
      const now = this.context.currentTime;
      if (at > now) { param.cancelScheduledValues(at); param.setValueAtTime(param.value, at); }
      else if (param.cancelAndHoldAtTime) param.cancelAndHoldAtTime(now);
      else { const current = param.value; param.cancelScheduledValues(now); param.setValueAtTime(current, now); }
      param.linearRampToValueAtTime(value, at + seconds);
    }
    nextBoundary(notBefore = this.context.currentTime) {
      const earliest = Math.max(notBefore, this.context.currentTime + .025);
      if (this.epoch === null) return earliest;
      const bars = Math.ceil((earliest - this.epoch) / this.manifest.loopSeconds - 1e-9);
      return this.epoch + Math.max(0, bars) * this.manifest.loopSeconds;
    }
    async playScore(layers, notBefore) {
      const revision = this.revision;
      const buffers = await this.prepare();
      if (revision !== this.revision) return;
      const context = this.context;
      const at = this.nextBoundary(notBefore);
      if (!this.nodes.length) {
        // All six sources start on exactly the same sample and keep running,
        // including muted layers. Later phases change only their gain.
        this.epoch ??= at;
        this.nodes = buffers.map((buffer, index) => {
          const source = context.createBufferSource(), gain = context.createGain();
          source.buffer = buffer;
          source.loop = true;
          source.loopStart = 0;
          source.loopEnd = this.manifest.loopSeconds;
          gain.gain.value = 0;
          source.connect(gain).connect(this.scoreBus);
          source.start(at);
          const audible = index < layers;
          gain.gain.setValueAtTime(0, at);
          gain.gain.linearRampToValueAtTime(audible ? 1 : 0, at + .12);
          return {source, gain, audible};
        });
      } else this.setLayers(layers, at);
      this.mode = 'score';
      this.ramp(this.scoreBus.gain, 1, .85, at);
      if (this.upload) this.ramp(this.upload.gain.gain, 0, .85, at);
      return at;
    }
    setLayers(layers, at) {
      this.nodes.forEach((node, index) => {
        const audible = index < layers;
        if (node.audible === audible) return;
        node.audible = audible;
        // Hold every new instrument at zero until the exact musical boundary.
        this.ramp(node.gain.gain, audible ? 1 : 0, .85, at);
      });
    }
    async prepareUpload(file) {
      const context = this.ensureContext();
      if (!this.fileBuffers.has(file)) {
        const promise = file.arrayBuffer().then(bytes => context.decodeAudioData(bytes))
          .then(buffer => this.smoothUpload(buffer))
          .catch(error => { this.fileBuffers.delete(file); throw error; });
        this.fileBuffers.set(file, promise);
      }
      return this.fileBuffers.get(file);
    }
    smoothUpload(buffer) {
      // Loop the full reference, with an overlapped seam, instead of seeking
      // to its beginning every eight seconds. Never mutate the user's file.
      const overlap = Math.min(Math.round(buffer.sampleRate * .2), Math.floor(buffer.length / 8));
      if (overlap < 2) return buffer;
      const length = buffer.length - overlap;
      const result = this.context.createBuffer(buffer.numberOfChannels, length, buffer.sampleRate);
      for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
        const input = buffer.getChannelData(channel), output = result.getChannelData(channel);
        output.set(input.subarray(overlap));
        for (let frame = 0; frame < overlap; frame++) {
          const t = frame / (overlap - 1);
          const blend = t * t * (3 - 2 * t);
          output[length - overlap + frame] = input[length + frame] * (1 - blend) + input[frame] * blend;
        }
      }
      return result;
    }
    async playUpload(file, notBefore) {
      const revision = this.revision;
      const context = this.ensureContext();
      await context.resume();
      const buffer = await this.prepareUpload(file);
      if (revision !== this.revision) return;
      const at = this.nextBoundary(notBefore);
      if (this.upload?.file !== file) {
        const old = this.upload;
        const source = context.createBufferSource(), gain = context.createGain();
        source.buffer = buffer; source.loop = true; gain.gain.value = 0;
        source.connect(gain).connect(this.master);
        source.start(at);
        this.epoch ??= at;
        this.upload = {file, source, gain};
        const node = this.upload;
        this.uploadNodes.add(node);
        source.onended = () => { source.disconnect(); gain.disconnect(); this.uploadNodes.delete(node); };
        if (old) { this.ramp(old.gain.gain, 0, .85, at); old.source.stop(at + .9); }
      }
      this.mode = 'upload';
      this.ramp(this.scoreBus.gain, 0, .85, at);
      this.ramp(this.upload.gain.gain, 1, .85, at);
      return at;
    }
    setMuted(value) {
      this.muted = value;
      if (this.master) this.ramp(this.master.gain, value ? 0 : 1, .035);
    }
    pause() { return this.context?.suspend(); }
    resume() { return this.context?.resume(); }
    get playing() { return this.epoch !== null && this.context?.state === 'running'; }
    get time() { return this.context?.currentTime ?? 0; }
    get position() { return this.epoch === null ? 0 : Math.max(0, this.context.currentTime - this.epoch) % this.manifest.loopSeconds; }
    reset() {
      this.revision++;
      for (const {source, gain} of this.nodes) { source.stop(); source.disconnect(); gain.disconnect(); }
      for (const node of this.uploadNodes) { node.source.stop(); node.source.disconnect(); node.gain.disconnect(); }
      this.uploadNodes.clear();
      this.nodes = []; this.upload = null; this.epoch = null; this.mode = 'score';
      this.pause();
    }
  }
  globalThis.TaanAudio = TaanAudio;
  if (typeof module !== 'undefined') module.exports = TaanAudio;
})();
