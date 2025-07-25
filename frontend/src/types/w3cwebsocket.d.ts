declare module 'w3cwebsocket' {
  export default class W3CWebSocket {
    constructor(url: string, protocols?: string | string[]);
    onopen: ((this: WebSocket, ev: Event) => any) | null;
    onmessage: ((this: WebSocket, ev: MessageEvent) => any) | null;
    onerror: ((this: WebSocket, ev: Event) => any) | null;
    onclose: ((this: WebSocket, ev: CloseEvent) => any) | null;
    close(): void;
    send(data: string): void;
  }
}