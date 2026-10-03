/* Capture off the UI thread; no microphone signal is routed to the speakers. */
class AvatarMicrophoneProcessor extends AudioWorkletProcessor {
  constructor() { super(); this.block = new Float32Array(1024); this.offset = 0; }
  process(inputs) {
    const channels = inputs[0];
    if (!channels?.length) return true;
    for (let i = 0; i < channels[0].length; i++) {
      let mono = 0;
      for (const channel of channels) mono += channel[i] ?? 0;
      this.block[this.offset++] = mono / channels.length;
      if (this.offset === this.block.length) {
        this.port.postMessage(this.block, [this.block.buffer]);
        this.block = new Float32Array(1024); this.offset = 0;
      }
    }
    return true;
  }
}
registerProcessor("avatar-microphone", AvatarMicrophoneProcessor);
