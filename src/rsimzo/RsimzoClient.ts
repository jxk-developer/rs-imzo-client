import { Hookable } from 'hookable'
import { defu } from "defu";
import { $Fetch, ofetch } from "ofetch";
import { RsPostMessageResult, RsImzoCallMethod, HookTypes, RsImzoClientOptions, RsImzoLocale, RsImzoSignOptions, RsImzoSignature, HandshakeOptions } from '~/types'

export class RsimzoClient extends Hookable<HookTypes> {

  //test commit

  private readonly iframeProviderId = 'rs-imzo-provider-iframe'
  // private readonly targetOrigin = 'http://10.20.11.87:3030'
  // private readonly targetOrigin = 'http://192.168.31.243:3030'
  private readonly targetOrigin = 'http://localhost:3030'
  // private readonly targetOrigin = 'https://rs-imzo.uz'
  private readonly providerPath = `/provider`
  private readonly signPath = `${this.providerPath}/sign`
  private readonly syncPath = `${this.providerPath}/sync`
  private readonly authPath = `${this.providerPath}/auth`
  private isServer: boolean

  private $fetch: $Fetch

  private options: RsImzoClientOptions = {
    baseURL: '',
    locale: 'en',
    paths: {
      generateToken: '/api/v2/client/generate-token'
    },
    headers: {}
  }

  constructor(options?: RsImzoClientOptions) {
    super()
    this.isServer = typeof window === 'undefined'
    this.options = defu(options, this.options)

    this.$fetch = ofetch.create({ baseURL: this.options.baseURL || window.location.origin, headers: options?.headers });
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

  public async callMethod<T>({ method, data, targetWindow }: RsImzoCallMethod): Promise<RsPostMessageResult<T>> {
    if (this.isServer || !targetWindow) {
      console.error('callMethod: Environment or target window not available.')
      return { data: null, error: null }
    }

    let token: string | null = null

    if (method !== 'ready') {
      token = await this.generateToken()
    }

    return new Promise((resolve) => {
      try {
        const channel = new MessageChannel()
        channel.port1.onmessage = (event: MessageEvent<RsPostMessageResult<T>>) => {
          if (!event.data) {
            console.log('callMethod: event.data is not available')
            return resolve({ data: null, error: null })
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

  public async parsePkcs7(pkcs12: string) {
    const iframe = await this.appendProviderIframe()

    if (!iframe) {
      return { data: null, error: null }
    }

    const data = this.callMethod<string>({ method: 'parse_pkcs7', data: { pkcs12 }, targetWindow: iframe.contentWindow })
    this.cleanup(iframe)

    return data
  }

  public async getCertificates(locale: RsImzoLocale = 'uz') {
    const syncWindow = await this.openWindow(this.buildUrl(this.syncPath, locale), 'RsImzoSync', 320, 420)

    const windowClosedPromise: Promise<{ data: null, error: null }> = new Promise((resolve) => {
      const interval = setInterval(() => {
        if (syncWindow.closed) {
          this.callHook('certificates_window_close')
          clearInterval(interval)
          resolve({ data: null, error: null })
        }
      }, 500)
    })

    const dataPromise = this.callMethod<RsImzoSignature[]>({
      method: 'certificates_info',
      targetWindow: syncWindow
    })

    // Wait for either the window to close or the data to be returned
    const result = await Promise.race([windowClosedPromise, dataPromise])

    // Ensure the signWindow is closed
    if (!syncWindow.closed) {
      syncWindow.close()
    }

    return result
  }

  public async sign(serialNumber: string, content: string, options?: RsImzoSignOptions) {
    const signWindow = await this.openWindow(this.buildUrl(this.signPath, options?.locale), 'RsImzoSign', 280, 320)

    const windowClosedPromise: Promise<{ data: null, error: null }> = new Promise((resolve) => {
      const interval = setInterval(() => {
        if (signWindow.closed) {
          this.callHook('sign_window_close')
          clearInterval(interval)
          resolve({ data: null, error: null })
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

  public async auth(locale: RsImzoLocale = 'uz') {
    const signWindow = await this.openWindow(this.buildUrl(this.authPath, locale), 'RsImzoAuth', 320, 420)

    const windowClosedPromise: Promise<{ data: null, error: null }> = new Promise(() => {
      const interval = setInterval(() => {
        if (signWindow.closed) {
          this.callHook('sign_window_close')
          clearInterval(interval)
          return
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

  private buildUrl(path: string, locale?: RsImzoLocale): string {
    const l = locale || this.options.locale
    return `${this.targetOrigin}${l === 'uz' ? '' : `/${l}`}${path}`
  }

  private async generateToken() {
    const res = await this.$fetch<{ token: string }>(this.options.paths!.generateToken!)
    return res.token
  }

  public cleanup(iframe: HTMLIFrameElement): void {
    if (iframe && iframe.parentElement) {
      iframe.parentElement.removeChild(iframe)
    }
  }
}
