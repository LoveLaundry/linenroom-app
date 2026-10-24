/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_USER_API_URL?: string
  readonly VITE_BILL_API_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
