export abstract class AudioSourceNode extends AudioWorkletNode {
  static readonly QUANTUM_FRAME_LEN = 128;
  public abstract start(when?: number | undefined,offset?: number | undefined,duration?: number | undefined): void;
  public abstract stop():void;
  onended: (() => void) | null = null;
}
