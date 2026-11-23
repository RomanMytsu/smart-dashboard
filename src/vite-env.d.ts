/// <reference types="vite/client" />

interface ViteTypeOptions {
  strictImportMetaEnv: unknown
}

interface ImportMetaEnv {
  readonly VITE_ALERT_TEST_MODE: string | undefined
  readonly VITE_VERCEL_ENV: string | undefined
}
