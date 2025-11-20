import { defu } from "defu";
import { BuildUrlOptions, RsPostMessageResult, RsOptions, RsSignOptions, Locale, RsAuthOptions, RsCertificatesOptions } from '~/types'

/*
Error codes
13 - Incorrect password
10001 - Window closed
10002 - Fetch token error
10003 - Action completed with no result
10004 - Certificate not found
10005 - Invalid token
10006 - Invalid parameters received on opened window
*/

export class RsimzoClient {
  private readonly targetOrigin = 'http://localhost:3020'
  // private readonly targetOrigin = 'https://rs-imzo.uz'
  private defaultLocale: Locale = 'uz'

  private options: RsOptions = {
    locale: this.defaultLocale,
    publicKey: ''
  }

  constructor(options: RsOptions) {
    if (!options.publicKey) {
      throw new Error('Please provide public key')
    }
    this.options = defu(options, this.options)

    this.options.locale = this.getValidatedLocale(this.options.locale!)
  }

  private getValidatedLocale(locale: Locale) {
    if (!['ru', 'uz', 'en'].includes(locale)) {
      console.warn(`Invalid locale '${this.options.locale}'. Defaulting to '${this.defaultLocale}'.`);
      return this.defaultLocale
    }

    return locale
  }

  private async openWindow(url: string | URL, title: string, w: number, h: number): Promise<Window> {
    const left = (screen.width / 2) - (w / 2) + window.screenLeft
    const top = (screen.height * 0.2) + window.screenTop

    return new Promise((resolve, reject) => {
      try {
        const newWindow = window.open(url, title, `
          width=${w},
          height=${h},
          top=${top},
          left=${left},
          scrollbars=no,
          resizable=no`)

        if (!newWindow) {
          return reject({
            data: null,
            error: { errorCode: 10009, errorMessage: 'Popup blocked' }
          })
        }

        resolve(newWindow)

      } catch (e) {
        reject(new Error(`openWindow err ${e}`))
      }
    })
  }

  private buildUrl({ path, params = {}, query = {} }: BuildUrlOptions): string {
    let constructedPath = path;
    for (const key in params) {
      const value = params[key];
      constructedPath = constructedPath.replace(`{${key}}`, value);
    }

    const queryString = new URLSearchParams(query).toString();

    const url = `${this.targetOrigin}/${constructedPath}`;
    return queryString ? `${url}?${queryString}` : url;
  }

  async getCertificates(options?: RsCertificatesOptions) {

    const url = this.buildUrl({
      path: '{locale}/provider/signatures',
      params: { locale: options?.locale || this.options.locale! }
    })

    const publicToken = this.options.publicKey
    const targetOrigin = this.targetOrigin

    const iframe = document.createElement('iframe')
    iframe.src = url
    iframe.style.display = 'none'

    document.body.appendChild(iframe)

    function waitForIframeLoad(iframe: HTMLIFrameElement): Promise<HTMLIFrameElement> {
      return new Promise(resolve => {
        try {
          const doc = iframe.contentDocument || iframe.contentWindow?.document
          console.log(doc?.readyState, 'doc?.readyState')
          if (doc?.readyState === 'complete') {
            resolve(iframe)
            return
          }
        } catch (err) {
          // cross-origin, cannot read contentDocument — fallback to load event
        }

        iframe.addEventListener('DOMContentLoaded', () => resolve(iframe), { once: true })
      })
    }

    let eventListener: (event: MessageEvent<any>) => void = () => { }
    async function requestCertificates() {
      await waitForIframeLoad(iframe)
      return new Promise(resolve => {
        eventListener = (_event) => {
          if (_event.data.type === 'ready') {
            iframe.contentWindow!.postMessage({ type: 'certificates', public: publicToken }, targetOrigin)
          } else {
            iframe.remove()
            window.removeEventListener('message', eventListener);
            resolve(_event.data)
          }
        }
        window.addEventListener('message', eventListener)
      })
    }

    return await requestCertificates()

  }

  async sign(serialNumber: string, content: string, options?: RsSignOptions) {

    const url = this.buildUrl({
      path: '{locale}/provider/sign',
      params: { locale: options?.locale || this.options.locale! },
      query: { publicKey: this.options.publicKey }
    })

    const targetOrigin = this.targetOrigin
    const authWindow = await this.openWindow(url, 'RsImzoSign', 500, 660)

    let intervalId: number | undefined;
    const windowClosedPromise: Promise<RsPostMessageResult<null>> = new Promise((resolve) => {
      intervalId = window.setInterval(() => {
        if (authWindow.closed) {
          clearInterval(intervalId);
          return resolve({
            data: null,
            error: { errorCode: 10001, errorMessage: 'window closed' }
          } as RsPostMessageResult<null>);
        }
      }, 500);
    });

    let eventListener: (event: MessageEvent<any>) => void = () => { }

    const resultPromise: Promise<RsPostMessageResult<string>> = new Promise((resolve) => {
      eventListener = (event: MessageEvent<any>) => {
        if (event.origin !== this.targetOrigin) {
          // Ensure the message is coming from the expected origin
          console.warn('Received message from unexpected origin:', event.origin);
          return;
        }

        if (event.data.type === 'auth_ready') {
          authWindow.postMessage({ type: 'validate', serialNumber, content }, targetOrigin)
        } else {
          resolve(event.data as RsPostMessageResult<string>);
        }
      };

      window.addEventListener('message', eventListener);
    });

    const timeout: Promise<RsPostMessageResult<null>> = new Promise(resolve => setTimeout(() => {
      resolve({ data: null, error: { errorCode: 10008, errorMessage: 'Timeout' } })
    }, 60000))

    // Wait for either the window to close or the data to be returned
    const result = await Promise.race([windowClosedPromise, resultPromise, timeout])

    // Ensure the authWindow is closed
    if (!authWindow.closed) {
      authWindow.close()
    }

    // Clean up interval and event listener
    if (intervalId !== undefined) {
      clearInterval(intervalId);
    }

    window.removeEventListener('message', eventListener);

    return result
  }

  async auth(options?: RsAuthOptions) {

    const url = this.buildUrl({
      path: '{locale}/provider/auth',
      params: { locale: options?.locale || this.options.locale! },
      query: { publicKey: this.options.publicKey }
    })

    const targetOrigin = this.targetOrigin
    const authWindow = await this.openWindow(url, 'RsImzoAuth', 500, 660)

    let intervalId: number | undefined;
    const windowClosedPromise: Promise<RsPostMessageResult<null>> = new Promise((resolve) => {
      intervalId = window.setInterval(() => {
        if (authWindow.closed) {
          clearInterval(intervalId);
          return resolve({
            data: null,
            error: { errorCode: 10001, errorMessage: 'window closed' }
          } as RsPostMessageResult<null>);
        }
      }, 500);
    });

    let eventListener: (event: MessageEvent<any>) => void = () => { }

    const resultPromise: Promise<RsPostMessageResult<string>> = new Promise((resolve) => {
      eventListener = (event: MessageEvent<any>) => {
        if (event.origin !== this.targetOrigin) {
          // Ensure the message is coming from the expected origin
          console.warn('Received message from unexpected origin:', event.origin);
          return;
        }

        if (event.data.type === 'auth_ready') {
          authWindow.postMessage({ type: 'validate' }, targetOrigin)
        } else {
          resolve(event.data as RsPostMessageResult<string>);
        }
      };

      window.addEventListener('message', eventListener);
    });

    const timeout: Promise<RsPostMessageResult<null>> = new Promise(resolve => setTimeout(() => {
      resolve({ data: null, error: { errorCode: 10008, errorMessage: 'Timeout' } })
    }, 60000))

    // Wait for either the window to close or the data to be returned
    const result = await Promise.race([windowClosedPromise, resultPromise, timeout])

    // Ensure the authWindow is closed
    if (!authWindow.closed) {
      authWindow.close()
    }

    // Clean up interval and event listener
    if (intervalId !== undefined) {
      clearInterval(intervalId);
    }

    window.removeEventListener('message', eventListener);

    return result
  }
}
