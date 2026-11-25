declare module 'guacamole-common-js' {
  export interface GuacamoleDisplay {
    getElement(): HTMLElement;
    getWidth(): number;
    getHeight(): number;
    scale(factor: number): void;
    onresize?: (width: number, height: number) => void;
  }

  export interface GuacamoleOutputStream {
    sendBlob(data: string): void;
    sendEnd(): void;
  }

  export class WebSocketTunnel {
    constructor(tunnelURL?: string);
  }

  export class Client {
    constructor(tunnel: WebSocketTunnel);
    connect(data?: string): void;
    disconnect(): void;
    getDisplay(): GuacamoleDisplay;
    sendMouseState(mouseState: MouseState): void;
    sendKeyEvent(pressed: number, keysym: number): void;
    createClipboardStream(mimetype: string): GuacamoleOutputStream;
    onstatechange?: (state: number) => void;
    onerror?: (status: { code: number; message?: string }) => void;
  }

  export interface MouseState {
    x: number;
    y: number;
    left: boolean;
    middle: boolean;
    right: boolean;
    up: boolean;
    down: boolean;
  }

  export class Mouse {
    constructor(element: HTMLElement);
    onmousedown: ((state: MouseState) => void) | null;
    onmouseup: ((state: MouseState) => void) | null;
    onmousemove: ((state: MouseState) => void) | null;
  }

  export class Keyboard {
    constructor(element: EventTarget);
    onkeydown: ((keysym: number) => boolean) | null;
    onkeyup: ((keysym: number) => void) | null;
  }

  export class StringWriter {
    constructor(stream: GuacamoleOutputStream);
    sendText(text: string): void;
    sendEnd(): void;
  }

  const Guacamole: {
    WebSocketTunnel: typeof WebSocketTunnel;
    Client: typeof Client;
    Mouse: typeof Mouse;
    Keyboard: typeof Keyboard;
    StringWriter: typeof StringWriter;
  };

  export default Guacamole;
}
