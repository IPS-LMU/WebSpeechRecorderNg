export abstract class AudioSourceNode extends AudioWorkletNode {
  public abstract start(when?: number | undefined,offset?: number | undefined,duration?: number | undefined): void;
  public abstract stop():void;
  onended: (() => void) | null = null;
}
