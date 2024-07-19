import { defu } from "defu";
import { destr } from "destr";
import { $Fetch, ofetch, FetchError } from "ofetch";
import { BuildUrlOptions, RsPostMessageResult, RsOptions, RsSignOptions, RsCertificate, RsAuthOptions } from '~/types'

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
  private readonly targetOrigin = 'http://localhost:3030'
  // private readonly targetOrigin = 'https://rs-imzo.uz'
  // private isServer: boolean
  private availableLocales = ['ru', 'uz', 'en', 'uz-kr']

  private $fetch: $Fetch

  private options: RsOptions = {
    baseURL: '',
    locale: 'en',
    paths: {
      fetchToken: ''
    },
    storage: true,
    instantCertsFetch: false,
    headers: {}
  }

  constructor(options?: RsOptions) {
    // this.isServer = typeof window === 'undefined'
    this.options = defu(options, this.options)

    this.options.locale = this.getValidatedLocale(this.options.locale!)

    this.$fetch = ofetch.create({ baseURL: this.options.baseURL || window.location.origin, headers: options?.headers });
  }

  get certificates(): RsCertificate[] {
    return destr<RsCertificate[]>(this.getFromLocalStorage('certificates')) || [];
  }

  private getValidatedLocale(locale: string) {
    if (!this.availableLocales.includes(locale)) {
      console.warn(`Invalid locale '${this.options.locale}'. Defaulting to 'en'.`);
      return 'en';
    }

    return locale
  }

  // private async callMethod<T>({ method, data, targetWindow }: RsCallMethod): Promise<RsPostMessageResult<T>> {
  //   if (this.isServer || !targetWindow) {
  //     console.error('callMethod: Environment or target window not available.')
  //     return { data: null, error: null }
  //   }

  //   return new Promise((resolve) => {
  //     try {
  //       const channel = new MessageChannel()
  //       channel.port1.onmessage = (event: MessageEvent<RsPostMessageResult<T>>) => {
  //         if (!event.data) {
  //           return resolve({ data: null, error: { errorCode: 10003, errorMessage: 'Action completed with no result' } })
  //         }

  //         if (!event.data.success) {
  //           return resolve({ data: null, error: event.data.error })
  //         }

  //         return resolve(event.data)
  //       }

  //       const postData = {
  //         method,
  //         ...(data && { data })
  //       }

  //       targetWindow.postMessage(postData, this.targetOrigin, [channel.port2])
  //     } catch (e) {
  //       console.error('callMethod error: ', e)
  //       resolve({ data: null, error: null })
  //     }
  //   })
  // }

  private async openWindow(url: string | URL, title: string, w: number, h: number): Promise<Window> {
    const left = (screen.width / 2) - (w / 2) + window.screenLeft
    const top = (screen.height * 0.2) + window.screenTop

    return new Promise(async (resolve, reject) => {
      try {
        const newWindow = window.open(url, title, `
          width=${w},
          height=${h},
          top=${top},
          left=${left},
          scrollbars=no,
          resizable=no`)

        if (!newWindow) {
          console.error('newWindow is not initialized')
          return reject(new Error('newWindow is not initialized'))
        }

        resolve(newWindow)
        return
        const checkIfLoaded = setInterval(() => {
          if (newWindow && newWindow.closed) {
            //'Child window closed before loading'
            clearInterval(checkIfLoaded);
            return;
          }
          try {
            // todo find new way of check if loaded
            if (newWindow && newWindow.document && newWindow.document.readyState === 'complete') {
              clearInterval(checkIfLoaded);
              newWindow.focus()
              resolve(newWindow)
            }
          } catch (e) {
            // Catch and handle cross-origin access errors
            console.log(e, 'checkIfLoaded error');
          }
        }, 200);

      } catch (e) {
        reject(new Error(`openWindow err ${e}`))
      }
    })
  }

  private getStoragePrefix(): string {
    if (typeof this.options.storage === 'boolean' && this.options.storage) {
      return 'rs.';
    } else if (typeof this.options.storage === 'object') {
      return this.options.storage.prefix ?? 'rs.';
    }
    return '';
  }

  private isLocalStorageEnabled(): boolean {
    if (typeof this.options.storage === 'boolean') {
      return this.options.storage;
    } else if (typeof this.options.storage === 'object') {
      return this.options.storage.localStorage ?? true;
    }
    return false;
  }

  private buildUrl({ path, params = {}, query = {} }: BuildUrlOptions): string {
    let constructedPath = path;
    for (const key in params) {
      const value = params[key];
      constructedPath = constructedPath.replace(`:${key}`, value);
    }

    const queryString = new URLSearchParams(query).toString();

    const url = `${this.targetOrigin}/${constructedPath}`;
    return queryString ? `${url}?${queryString}` : url;
  }

  private async fetchToken() {
    try {
      const res = await this.$fetch<{ token: string }>(this.options.paths.fetchToken)
      return { data: res.token, error: null }
    } catch (error) {
      const err = error as any as FetchError
      console.log(err, 'err');

      return Promise.resolve({ data: null, error: { errorCode: 10002, errorMessage: 'Fetch token error', rawError: err.response?._data } } as RsPostMessageResult<null>)
    }
  }

  async getCertificates(options: Partial<Pick<RsOptions, 'locale' | 'instantCertsFetch'>>) {

    const { data: token, error } = await this.fetchToken()

    if (error) { return { data: null, error } }

    let query: Record<string, string> = {
      act: token!,
      parent: encodeURIComponent(window.location.origin)
    }

    if (options.instantCertsFetch) {
      query['fetch'] = 'instant'
    }

    const url = this.buildUrl({
      path: ':locale/provider/certs',
      params: { locale: options?.locale || this.options.locale! },
      query: {
        act: token!,
        parent: encodeURIComponent(window.location.origin),
        ...(options.instantCertsFetch && { fetch: 'instant' }),
      }
    })

    const certsWindow = await this.openWindow(url, 'RsImzoCerts', 320, 420)
    console.log(certsWindow, 'certsWindow');

    let intervalId: number | undefined;
    const windowClosedPromise: Promise<RsPostMessageResult<null>> = new Promise((resolve) => {
      intervalId = window.setInterval(() => {
        if (certsWindow.closed) {
          clearInterval(intervalId);
          return resolve({
            data: null,
            error: { errorCode: 10001, errorMessage: 'window closed' }
          } as RsPostMessageResult<null>);
        }
      }, 500);
    });

    let eventListener: (event: MessageEvent<any>) => void = () => { }

    const resultPromise: Promise<RsPostMessageResult<RsCertificate[]>> = new Promise((resolve) => {
      eventListener = (event: MessageEvent<any>) => {
        console.log(event, 'event');

        if (event.origin !== this.targetOrigin) {
          // Ensure the message is coming from the expected origin
          console.warn('Received message from unexpected origin:', event.origin);
          return;
        }
        resolve(event.data as RsPostMessageResult<RsCertificate[]>);
      };

      window.addEventListener('message', eventListener);
    });
    // Wait for either the window to close or the data to be returned
    const result = await Promise.race([windowClosedPromise, resultPromise])

    // Ensure the signWindow is closed
    if (!certsWindow.closed) {
      certsWindow.close()
    }

    if (result.data) {
      this.saveToLocalStorage('certificates', JSON.stringify(result.data))
    }

    // Clean up interval and event listener
    if (intervalId !== undefined) {
      clearInterval(intervalId);
    }

    window.removeEventListener('message', eventListener);

    return result
  }

  saveToLocalStorage(key: string, value: string) {
    const prefix = this.getStoragePrefix();
    if (this.isLocalStorageEnabled() && prefix) {
      localStorage.setItem(`${prefix}${key}`, value);
    }
  }

  getFromLocalStorage(key: string): string | null {
    const prefix = this.getStoragePrefix();
    if (this.isLocalStorageEnabled() && prefix) {
      return localStorage.getItem(`${prefix}${key}`);
    }
    return null;
  }

  async sign(serialNumber: string, content: string, options?: RsSignOptions) {
    let opts: RsSignOptions = {
      locale: this.options.locale,
      attached: true
    }

    opts = defu(options, opts)

    const { data: token, error } = await this.fetchToken()

    if (error) { return { data: null, error } }

    const url = this.buildUrl({
      path: ':locale/provider/sign',
      params: { locale: opts.locale! },
      query: {
        act: token!,
        parent: encodeURIComponent(window.location.origin),
        serialNumber,
        content,
        ...(opts?.attached && { contentMode: 'attached' })
      }
    })

    const signWindow = await this.openWindow(url, 'RsImzoSign', 280, 320)

    let intervalId: number | undefined;
    const windowClosedPromise: Promise<RsPostMessageResult<null>> = new Promise((resolve) => {
      intervalId = window.setInterval(() => {
        if (signWindow.closed) {
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
        resolve(event.data as RsPostMessageResult<string>);
      };

      window.addEventListener('message', eventListener);
    });

    // Wait for either the window to close or the data to be returned
    const result = await Promise.race([windowClosedPromise, resultPromise])

    // Ensure the authWindow is closed
    if (!signWindow.closed) {
      signWindow.close()
    }

    // Clean up interval and event listener
    if (intervalId !== undefined) {
      clearInterval(intervalId);
    }

    window.removeEventListener('message', eventListener);

    return result
  }

  async auth(options?: RsAuthOptions) {

    const { data: token, error } = await this.fetchToken()

    if (error) { return { data: null, error } }

    const url = this.buildUrl({
      path: ':locale/provider/auth',
      params: { locale: options?.locale || this.options.locale! },
      query: { act: token!, parent: encodeURIComponent(window.location.origin) }
    })

    const authWindow = await this.openWindow(url, 'RsImzoAuth', 320, 420)

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
        resolve(event.data as RsPostMessageResult<string>);
      };

      window.addEventListener('message', eventListener);
    });

    // Wait for either the window to close or the data to be returned
    const result = await Promise.race([windowClosedPromise, resultPromise])

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
