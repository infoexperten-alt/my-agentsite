type ReadableByteStream = ReadableStream<Uint8Array>;

export default class SwitchableStream {
  readonly readable: ReadableByteStream;
  private readonly controllerPromise: Promise<ReadableStreamDefaultController<Uint8Array>>;
  private sourceReader: ReadableStreamDefaultReader<Uint8Array> | null = null;
  private closed = false;
  private sourceVersion = 0;
  switches = 0;

  constructor() {
    let resolveController: (
      controller: ReadableStreamDefaultController<Uint8Array>,
    ) => void;
    this.controllerPromise = new Promise((resolve) => {
      resolveController = resolve;
    });
    this.readable = new ReadableStream<Uint8Array>({
      start: (controller) => resolveController(controller),
      cancel: () => {
        this.closed = true;
        void this.sourceReader?.cancel().catch(() => undefined);
      },
    });
  }

  switchSource(source: ReadableByteStream) {
    if (this.closed) return;
    this.switches += 1;
    const version = ++this.sourceVersion;
    void this.pump(source, version);
  }

  close() {
    if (this.closed) return;
    this.closed = true;
    ++this.sourceVersion;
    void this.controllerPromise.then((controller) => {
      try {
        controller.close();
      } catch {
        return;
      }
    });
    void this.sourceReader?.cancel().catch(() => undefined);
  }

  private async pump(source: ReadableByteStream, version: number) {
    const reader = source.getReader();
    this.sourceReader = reader;
    try {
      while (!this.closed && version === this.sourceVersion) {
        const result = await reader.read();
        if (result.done) return;
        const controller = await this.controllerPromise;
        if (this.closed || version !== this.sourceVersion) return;
        controller.enqueue(result.value);
      }
    } catch (error) {
      if (!this.closed && version === this.sourceVersion) {
        const controller = await this.controllerPromise;
        try {
          controller.error(error);
        } catch {
          return;
        }
        this.closed = true;
      }
    } finally {
      if (this.sourceReader === reader) this.sourceReader = null;
      await reader.cancel().catch(() => undefined);
    }
  }
}
