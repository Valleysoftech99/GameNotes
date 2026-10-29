import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'

const configuredBase = process.env.VITE_BASE_PATH || '/'
const base = configuredBase.endsWith('/') ? configuredBase : `${configuredBase}/`

function nativePwaPlugin(): Plugin {
  let projectRoot = process.cwd()
  return {
    name: 'notegame-native-pwa',
    apply: 'build',
    configResolved(config) {
      projectRoot = config.root
    },
    async generateBundle(_options, bundle) {
      const generatedFiles = Object.keys(bundle)
        .filter((file) => /\.(?:js|css|woff2|svg|png|webp|avif|ico)$/.test(file))
        .sort()
      const filesToPrecache = [
        'index.html',
        'manifest.webmanifest',
        'favicon.svg',
        'icons/icon-180.png',
        'icons/icon-192.png',
        'icons/icon-512.png',
        ...generatedFiles,
      ]
      const urls = [...new Set(filesToPrecache)].map((file) => `${base}${file}`)

      const digest = createHash('sha256').update(JSON.stringify(urls))
      const html = bundle['index.html']
      if (html?.type === 'asset') digest.update(html.source)
      for (const file of generatedFiles) {
        const output = bundle[file]
        digest.update(file)
        digest.update(output.type === 'chunk' ? output.code : output.source)
      }
      for (const file of [
        'public/manifest.webmanifest',
        'public/favicon.svg',
        'public/icons/icon-180.png',
        'public/icons/icon-192.png',
        'public/icons/icon-512.png',
        'src/pwa/sw.js',
      ]) {
        digest.update(await readFile(resolve(projectRoot, file)))
      }

      const cacheName = `notegame-static-${digest.digest('hex').slice(0, 16)}`
      const template = await readFile(resolve(projectRoot, 'src/pwa/sw.js'), 'utf8')
      const worker = template
        .replace('__CACHE_NAME__', JSON.stringify(cacheName))
        .replace('__PRECACHE_URLS__', JSON.stringify(urls))
      this.emitFile({ type: 'asset', fileName: 'sw.js', source: worker })
    },
  }
}

function developmentCspPlugin(): Plugin {
  const refreshPreamble = react.preambleCode.replace('__BASE__', '/')
  const refreshHash = createHash('sha256').update(refreshPreamble).digest('base64')
  return {
    name: 'notegame-dev-csp-hmr',
    apply: 'serve',
    transformIndexHtml(html) {
      return html.replace(
        "script-src 'self'",
        `script-src 'self' 'sha256-${refreshHash}'`,
      ).replace(
        "style-src 'self'",
        "style-src 'self' 'unsafe-inline'",
      ).replace(
        "connect-src 'self' https://api.rawg.io",
        "connect-src 'self' https://api.rawg.io ws://localhost:5173 ws://127.0.0.1:5173",
      )
    },
  }
}

export default defineConfig({
  base,
  plugins: [react(), nativePwaPlugin(), developmentCspPlugin()],
  server: { port: 5173, strictPort: true },
})

