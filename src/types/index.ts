export type RsAction = 'signature_list' | 'sign' | 'ready' | 'parse_pkcs7' | 'certificates_info' | 'auth'
export type Locale = 'ru' | 'en' | 'uz'
export interface RsOptions {
  locale?: Locale
  publicKey: string
  targetOrigin?: string
}

export type RsResolvedOptions =
  Omit<Required<RsOptions>, 'publicKey'> & Pick<RsOptions, 'publicKey'>

export interface RsSignOptions {
  locale?: string
  attached?: boolean
}

export interface RsAuthOptions {
  locale?: string
}

export interface RsCertificatesOptions {
  locale?: string
}

export interface RsSignatureInfo {
  serial: string
  fullName: string
  createdAt: number
  expireAt: number
  country: string
  orgName?: string
  pin?: string // Personal Identification Number
  tin?: string
  isLegalEntity: boolean
  isExpired: boolean
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
