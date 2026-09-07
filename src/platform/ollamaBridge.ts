function bridge() {
  return window.ollama;
}

export const ollamaBridge = {
  hasRequest(): boolean {
    return Boolean(bridge()?.request);
  },
  hasStreaming(): boolean {
    return Boolean(bridge()?.startStream && bridge()?.onStreamEvent);
  },
  async request(payload: { endpoint: string; method?: string; body?: unknown }) {
    return bridge()!.request(payload);
  },
  startStream(payload: { requestId: string; endpoint: string; method?: string; body?: unknown }): void {
    bridge()?.startStream?.(payload);
  },
  abortStream(requestId: string): void {
    bridge()?.abortStream?.(requestId);
  },
  onStreamEvent(
    callback: (payload: { requestId: string; type: 'data' | 'end' | 'error'; chunk?: string; error?: string }) => void
  ): () => void {
    return bridge()?.onStreamEvent?.(callback) ?? (() => {});
  },
};
