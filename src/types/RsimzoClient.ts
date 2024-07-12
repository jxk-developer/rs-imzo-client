export type RsAction = 'signature_list' | 'sign' | 'ready' | 'parse_pkcs7' | 'certificates_info' | 'auth'

export interface RsOptions {
  baseURL?: string
  locale?: string
  instantCertsFetch: boolean
  paths: {
    fetchToken: string
  }
  storage?: boolean | RsStorageOptions
  headers?: Record<string, string>
}

export interface RsStorageOptions {
  prefix?: string
  localStorage?: boolean
}

export interface RsSignOptions {
  locale?: string
  attached?: boolean
}

export interface RsAuthOptions {
  locale?: string
}

export interface RsCertificate {
  pin?: string
  tin?: string
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

export interface RsCallMethod {
  method: RsAction
  data?: any
  targetWindow?: Window | null
}

export interface RsPostMessageResult<T> {
  error?: RsPostMessageError | null
  data?: T | null
  method?: 'storage_access_prompt'
  success?: boolean
}

export interface RsPostMessageError {
  errorCode: number;
  errorMessage: string;
  rawError?: any
}

export interface BuildUrlOptions {
  path: string
  params?: Record<string, string>
  query?: Record<string, string>
}