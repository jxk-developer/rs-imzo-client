import { defu } from "defu";
import {
  BuildUrlOptions,
  RsPostMessageResult,
  RsOptions,
  RsSignOptions,
  Locale,
  RsAuthOptions,
  RsCertificatesOptions,
  RsSignatureInfo,
  RsResolvedOptions,
} from "~/types";

/*
  Error codes:
  13    - Incorrect password
  10001 - Window closed
  10002 - Fetch token error
  10003 - Action completed with no result
  10004 - Certificate not found
  10005 - Invalid token
  10006 - Invalid parameters received on opened window
  10008 - Timeout
  10009 - Popup blocked
*/

export class RsimzoClient {
  private readonly defaultLocale: Locale = "uz";

  private readonly options: RsResolvedOptions;

  private certificatesCache: RsSignatureInfo[] | null = null;

  constructor(options: RsOptions) {
    this.options = defu(options, {
      locale: this.defaultLocale,
      publicKey: "",
      targetOrigin: "https://rs-imzo.uz",
    } as RsResolvedOptions);

    this.options.locale = this.getValidatedLocale(this.options.locale);
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  async getCertificates(
    options?: RsCertificatesOptions
  ): Promise<RsPostMessageResult<RsSignatureInfo[] | null>> {
    if (this.certificatesCache) {
      return { data: this.certificatesCache, error: null };
    }

    const url = this.buildUrl({
      path: "{locale}/provider/signatures",
      params: { locale: options?.locale ?? this.options.locale! },
    });

    const iframe = document.createElement("iframe");
    iframe.src = url;
    iframe.style.display = "none";
    document.body.appendChild(iframe);

    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    let messageHandler: ((e: MessageEvent) => void) | undefined;

    const cleanup = () => {
      clearTimeout(timeoutId);
      if (messageHandler) window.removeEventListener("message", messageHandler);
      iframe.remove();
    };

    try {
      await this.waitForIframeLoad(iframe);

      const resultPromise = new Promise<RsPostMessageResult<RsSignatureInfo[]>>(
        (resolve) => {
          messageHandler = (event: MessageEvent) => {
            if (event.origin !== this.options.targetOrigin) return;

            if (event.data?.type === "ready") {
              iframe.contentWindow!.postMessage(
                { type: "certificates", publicKey: this.options.publicKey },
                this.options.targetOrigin
              );
            } else {
              if (event.data?.data) {
                this.certificatesCache = event.data.data;
              }
              resolve(event.data);
            }
          };

          window.addEventListener("message", messageHandler);
        }
      );

      const timeoutPromise = new Promise<RsPostMessageResult<null>>((resolve) => {
        timeoutId = setTimeout(() => {
          resolve({ data: null, error: { errorCode: 10008, errorMessage: "Timeout" } });
        }, 60_000);
      });

      return await Promise.race([resultPromise, timeoutPromise]);
    } finally {
      cleanup();
    }
  }

  async sign(
    serialNumber: string,
    content: string,
    options?: RsSignOptions
  ): Promise<RsPostMessageResult<string | null>> {
    const url = this.buildUrl({
      path: "{locale}/provider/sign",
      params: { locale: options?.locale ?? this.options.locale! },
      query: { publicKey: this.options.publicKey },
    });

    return this.openWindowAndAwaitResult(url, "RsImzoSign", (win) => {
      win.postMessage({ type: "validate", serialNumber, content }, this.options.targetOrigin);
    });
  }

  async auth(
    options?: RsAuthOptions
  ): Promise<RsPostMessageResult<string | null>> {
    const url = this.buildUrl({
      path: "{locale}/provider/auth",
      params: { locale: options?.locale ?? this.options.locale! },
      query: { publicKey: this.options.publicKey },
    });

    return this.openWindowAndAwaitResult(url, "RsImzoAuth", (win) => {
      win.postMessage({ type: "validate" }, this.options.targetOrigin);
    });
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  /**
   * Shared logic for sign() and auth(): open a popup, wait for auth_ready,
   * send a payload, then race the result against window-close and timeout.
   */
  private async openWindowAndAwaitResult(
    url: string,
    title: string,
    sendPayload: (win: Window) => void
  ): Promise<RsPostMessageResult<string | null>> {
    const popup = await this.openWindow(url, title, 500, 660);

    let intervalId: ReturnType<typeof setInterval> | undefined;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    let messageHandler: ((e: MessageEvent) => void) | undefined;

    const cleanup = () => {
      clearInterval(intervalId);
      clearTimeout(timeoutId);
      if (messageHandler) window.removeEventListener("message", messageHandler);
      if (!popup.closed) popup.close();
    };

    const windowClosedPromise = new Promise<RsPostMessageResult<null>>(
      (resolve) => {
        intervalId = setInterval(() => {
          if (popup.closed) {
            resolve({
              data: null,
              error: { errorCode: 10001, errorMessage: "Window closed" },
            });
          }
        }, 200);
      }
    );

    const resultPromise = new Promise<RsPostMessageResult<string>>(
      (resolve) => {
        messageHandler = (event: MessageEvent) => {
          if (event.origin !== this.options.targetOrigin) {
            console.warn("Message from unexpected origin:", event.origin);
            return;
          }

          if (event.data?.type === "auth_ready") {
            sendPayload(popup);
          } else {
            resolve(event.data as RsPostMessageResult<string>);
          }
        };

        window.addEventListener("message", messageHandler);
      }
    );

    const timeoutPromise = new Promise<RsPostMessageResult<null>>((resolve) => {
      timeoutId = setTimeout(() => {
        resolve({ data: null, error: { errorCode: 10008, errorMessage: "Timeout" } });
      }, 60_000);
    });

    const result = await Promise.race([
      windowClosedPromise,
      resultPromise,
      timeoutPromise,
    ]);

    cleanup();
    return result;
  }

  private waitForIframeLoad(iframe: HTMLIFrameElement): Promise<void> {
    return new Promise((resolve) => {
      // Use the 'load' event on the iframe element — works cross-origin.
      iframe.addEventListener("load", () => resolve(), { once: true });
    });
  }

  private openWindow(
    url: string | URL,
    title: string,
    w: number,
    h: number
  ): Promise<Window> {
    const left = screen.width / 2 - w / 2 + window.screenLeft;
    const top = screen.height * 0.2 + window.screenTop;

    return new Promise((resolve, reject) => {
      const popup = window.open(
        url,
        title,
        `width=${w},height=${h},top=${top},left=${left},scrollbars=no,resizable=no`
      );

      if (!popup) {
        return reject({
          data: null,
          error: { errorCode: 10009, errorMessage: "Popup blocked" },
        });
      }

      resolve(popup);
    });
  }

  private buildUrl({ path, params = {}, query = {} }: BuildUrlOptions): string {
    let resolvedPath = path;

    for (const [key, value] of Object.entries(params)) {
      resolvedPath = resolvedPath.replace(`{${key}}`, value);
    }

    const qs = new URLSearchParams(query).toString();
    const base = `${this.options.targetOrigin}/${resolvedPath}`;
    return qs ? `${base}?${qs}` : base;
  }

  private getValidatedLocale(locale: Locale): Locale {
    if (!["ru", "uz", "en"].includes(locale)) {
      console.warn(
        `Invalid locale '${locale}'. Defaulting to '${this.defaultLocale}'.`
      );
      return this.defaultLocale;
    }
    return locale;
  }
}
