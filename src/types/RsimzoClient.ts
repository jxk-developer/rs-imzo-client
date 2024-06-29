export type RsImzoAction = 'signature_list' | 'sign' | 'ready' | 'parse_pkcs7' | 'certificates_info' | 'auth'

export interface RsImzoClientOptions {
  baseURL?: string
  locale?: string
  paths?: {
    generateToken?: string
  }
  headers?: Record<string, string>
}

export interface RsImzoSignOptions {
  locale?: string
  attached?: boolean
}

export interface RsImzoSignature {
  pin?: string
  tin?: string
  address: string
  country: string
  expireAt: number
  expireFrom: number
  fullName: string
  serial: string
  uid: string
  isLegalEntity: boolean
  orgName?: string
  isExpired: boolean
}

export interface RsImzoCallMethod {
  method: RsImzoAction
  data?: any
  targetWindow?: Window | null
}

export interface RsPostMessageResult<T> {
  error?: PostMessageError | null
  data?: T | null
  method?: 'storage_access_prompt'
  success?: boolean
}

export interface PostMessageError {
  errorCode: number;
  errorMessage: string;
}

export interface HandshakeOptions {
  retryDelay?: number
  timeout?: number
}