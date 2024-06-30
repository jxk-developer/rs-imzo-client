import { defu } from "defu";
import { destr } from "destr";
import { $Fetch, ofetch, FetchError } from "ofetch";
import { RsPostMessageResult, RsImzoCallMethod, RsImzoClientOptions, RsImzoSignOptions, RsImzoSignature, HandshakeOptions } from '~/types'

/*
Error codes
10001 - Window closed
10002 - Fetch error
10003 - Action completed with no result
10004 - Certificate not found
*/

export class RsimzoClient {
  private readonly iframeProviderId = 'rs-imzo-provider-iframe'
  // private readonly targetOrigin = 'http://10.20.11.87:3030'
  // private readonly targetOrigin = 'http://192.168.31.243:3030'
  // private readonly targetOrigin = 'http://localhost:3030'
  private readonly targetOrigin = 'https://rs-imzo.uz'
  private readonly providerPath = `/provider`
  private readonly signPath = `${this.providerPath}/sign`
  private readonly syncPath = `${this.providerPath}/sync`
  private readonly authPath = `${this.providerPath}/auth`
  private isServer: boolean
  private availableLocales = ['ru', 'uz', 'en', 'uz-kr']

  private $fetch: $Fetch

  private options: RsImzoClientOptions = {
    baseURL: '',
    locale: 'en',
    paths: {
      fetchToken: ''
    },
    storage: true,
    instantCertsFetch: false,
    headers: {}
  }

  constructor(options?: RsImzoClientOptions) {
    this.isServer = typeof window === 'undefined'
    this.options = defu(options, this.options)
    console.log(this.options, 'this.options');
    this.options.locale = this.getValidatedLocale(this.options.locale!)

    this.$fetch = ofetch.create({ baseURL: this.options.baseURL || window.location.origin, headers: options?.headers });
  }

  get certificates(): RsImzoSignature[] {
    return destr<RsImzoSignature[]>(this.getFromLocalStorage('certificates')) || [];
  }

  private getValidatedLocale(locale: string) {
    if (!this.availableLocales.includes(locale)) {
      console.warn(`Invalid locale '${this.options.locale}'. Defaulting to 'en'.`);
      return 'en';
    }

    return locale
  }

  private async appendProviderIframe(): Promise<HTMLIFrameElement | null> {
    let providerIframe = document.getElementById(this.iframeProviderId) as HTMLIFrameElement | null

    if (providerIframe) { return Promise.resolve(providerIframe) }

    providerIframe = document.createElement('iframe')
    providerIframe.id = this.iframeProviderId
    providerIframe.src = this.buildUrl(this.providerPath)
    providerIframe.style.display = 'none'

    document.body.appendChild(providerIframe)

    if (await this.checkWindowLoadedViaHandshake(providerIframe!.contentWindow!)) {
      return providerIframe
    }

    return null
  }

  private async callMethod<T>({ method, data, targetWindow }: RsImzoCallMethod): Promise<RsPostMessageResult<T>> {
    if (this.isServer || !targetWindow) {
      console.error('callMethod: Environment or target window not available.')
      return { data: null, error: null }
    }

    let token: string | null = null

    if (method !== 'ready') {
      try {
        token = await this.fetchToken()
      } catch (error: any) {
        const err = error as any as FetchError
        return Promise.resolve({ data: null, error: { errorCode: 10002, errorMessage: 'Fetch error', rawError: err.response?._data } } as RsPostMessageResult<T>)
      }
    }

    return new Promise((resolve) => {
      try {
        const channel = new MessageChannel()
        channel.port1.onmessage = (event: MessageEvent<RsPostMessageResult<T>>) => {
          if (!event.data) {
            return resolve({ data: null, error: { errorCode: 10003, errorMessage: 'Action completed with no result' } })
          }

          if (!event.data.success) {
            return resolve({ data: null, error: event.data.error })
          }

          return resolve(event.data)
        }

        const postData = {
          method,
          ...(data && { data }),
          ...(token && { token })
        }

        targetWindow.postMessage(postData, this.targetOrigin, [channel.port2])
      } catch (e) {
        console.error('callMethod error: ', e)
        resolve({ data: null, error: null })
      }
    })
  }

  private openWindow(url: string | URL, title: string, w: number, h: number): Promise<Window> {
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

        if (await this.checkWindowLoadedViaHandshake(newWindow)) {
          newWindow.focus()
          resolve(newWindow)
        }

      } catch (e) {
        reject(new Error(`openWindow err ${e}`))
      }
    })
  }

  private checkWindowLoadedViaHandshake(window: Window, options: HandshakeOptions = {}): Promise<boolean> {
    const { retryDelay = 200, timeout = 10000 } = options
    const callTotal = Math.floor(timeout / retryDelay)
    let callCount = 0

    return new Promise((resolve) => {
      const interval = setInterval(async () => {
        const { data } = await this.callMethod<boolean>({ method: 'ready', targetWindow: window })
        if (data) {
          clearInterval(interval)
          resolve(data)
        }
        if (callCount >= callTotal) {
          clearInterval(interval)
          resolve(false)
        }
        callCount++
      }, retryDelay)
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

  private buildUrl(path: string, locale?: string): string {
    const l = this.getValidatedLocale(locale || this.options.locale!)
    return `${this.targetOrigin}${l === 'uz' ? '/uz' : `/${l}`}${path}`
  }

  private async fetchToken() {
    try {
      const res = await this.$fetch<{ token: string }>(this.options.paths.fetchToken)
      return res.token
    } catch (error) {
      throw error
    }
  }

  async parsePkcs7(pkcs12: string) {
    const iframe = await this.appendProviderIframe()

    if (!iframe) {
      return { data: null, error: null }
    }

    const data = this.callMethod<string>({ method: 'parse_pkcs7', data: { pkcs12 }, targetWindow: iframe.contentWindow })
    this.removeProviderIframe(iframe)

    return data
  }

  async getCertificates(locale: string = 'uz') {
    const syncWindow = await this.openWindow(this.buildUrl(this.syncPath, locale), 'RsImzoSync', 320, 420)

    const windowClosedPromise: Promise<RsPostMessageResult<null>> = new Promise((resolve) => {
      const interval = setInterval(() => {
        if (syncWindow.closed) {
          clearInterval(interval)
          return resolve({ data: null, error: { errorCode: 10001, errorMessage: 'window closed' } } as RsPostMessageResult<null>)
        }
      }, 500)
    })

    const dataPromise = this.callMethod<RsImzoSignature[]>({
      method: 'certificates_info',
      targetWindow: syncWindow,
      data: { instantCertsFetch: this.options.instantCertsFetch }
    })

    // Wait for either the window to close or the data to be returned
    const result = await Promise.race([windowClosedPromise, dataPromise])

    // Ensure the signWindow is closed
    if (!syncWindow.closed) {
      syncWindow.close()
    }

    if (result.data) {
      this.saveToLocalStorage('certificates', JSON.stringify(result.data))
    }

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

  async sign(serialNumber: string, content: string, options?: RsImzoSignOptions) {
    const signWindow = await this.openWindow(this.buildUrl(this.signPath, options?.locale), 'RsImzoSign', 280, 320)

    const windowClosedPromise: Promise<RsPostMessageResult<null>> = new Promise((resolve) => {
      const interval = setInterval(() => {
        if (signWindow.closed) {
          clearInterval(interval)
          return resolve({ data: null, error: { errorCode: 10001, errorMessage: 'window closed' } } as RsPostMessageResult<null>)
        }
      }, 500)
    })

    const dataPromise = this.callMethod<string>({
      method: 'sign',
      targetWindow: signWindow,
      data: { serialNumber, content, attached: options?.attached }
    })

    // Wait for either the window to close or the data to be returned
    const result = await Promise.race([windowClosedPromise, dataPromise])

    // Ensure the signWindow is closed
    if (!signWindow.closed) {
      signWindow.close()
    }

    return result
  }

  async auth(locale: string = 'uz') {
    const signWindow = await this.openWindow(this.buildUrl(this.authPath, locale), 'RsImzoAuth', 320, 420)

    const windowClosedPromise: Promise<RsPostMessageResult<null>> = new Promise((resolve) => {
      const interval = setInterval(() => {
        if (signWindow.closed) {
          clearInterval(interval)
          return resolve({ data: null, error: { errorCode: 10001, errorMessage: 'window closed' } } as RsPostMessageResult<null>)
        }
      }, 500)
    })

    const dataPromise = this.callMethod<string>({
      method: 'auth',
      targetWindow: signWindow
    })

    // Wait for either the window to close or the data to be returned
    const result = await Promise.race([windowClosedPromise, dataPromise])

    // Ensure the signWindow is closed
    if (!signWindow.closed) {
      signWindow.close()
    }

    return result
  }

  removeProviderIframe(iframe: HTMLIFrameElement): void {
    if (iframe && iframe.parentElement) {
      iframe.parentElement.removeChild(iframe)
    }
  }
}
