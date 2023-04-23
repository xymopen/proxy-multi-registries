#!/usr/bin/node

'use strict'

const http = require('http')
const URL = require('url').URL

const yargs = require('yargs')

const { mergePackuments, indexed } = require('../lib/misc.js')
const PackageCache = require('../lib/package-cache.js').default
const RegistryClient = require('../lib/registry-client.js').default
const RegistryServer = require('../lib/registry-server.js').default

/**
 * @param {{
 *  address: string,
 *  port: number,
 *  registries: RegistryClient[],
 *  default: RegistryClient
 * }} argv
 */
const startApp = async (argv) => {
  const base = `http://${argv.address}:${argv.port}/`

  const backends = argv.registries
  const df = argv.default

  const pkgCache = new PackageCache()

  const srv = http.createServer(async (req, res) => {
    const reqUrl = new URL(/** @type {string} */ (req.url), base)
    const cls = RegistryClient.classify(reqUrl.pathname)

    if (cls) {
      const { package: pkg } = cls

      /** @type {Iterable<[RegistryClient, number]>} */
      // @ts-ignore
      const indexedBackends = indexed(backends)

      if (cls.type === 'package-root') {
        const packuments = []

        console.log(`Resolving ${pkg}`)

        for (const [backend, priority] of indexedBackends) {
          try {
            const packument = await backend.getPackage(pkg)

            for (const ver of Object.keys(packument.versions)) {
              pkgCache.addPkgVer(pkg, ver, priority)
              packuments.push(packument)
            }
          } catch (ignored) {
            pkgCache.deletePkg(pkg, priority)
          }
        }

        if (packuments.length > 0) {
          console.log(`Succeed in resolving ${pkg}`)

          return RegistryServer.ok(res, mergePackuments(packuments))
        } else {
          console.error(`Fail to resolve ${pkg}. No registries has such package`)

          return RegistryServer.notfound(res)
        }
      } else if (cls.type === 'package-version') {
        const ver = cls.version
        console.log(`Resolving ${pkg}@${ver}`)

        if (pkgCache.hasPkgVer(pkg, ver)) {
          const backend = backends[pkgCache.getPkgVer(pkg, ver)]

          console.log('Cache hits')
          console.log(`Redirect ${pkg}@${ver} to ${backend.root.hostname}`)

          return RegistryServer.redirect(res, reqUrl, backend)
        } else {
          console.log('Cache misses')

          for (const [backend, priority] of indexedBackends) {
            if (await backend.hasPackageVerison(pkg, ver)) {
              pkgCache.addPkgVer(pkg, ver, priority)
              console.log(`Redirect ${pkg}@${ver} to ${backend.root.hostname}`)

              return RegistryServer.redirect(res, reqUrl, backend)
            }
          }
        }

        console.error(`Fail resolving ${pkg}@${ver}. No registries has such package`)

        return RegistryServer.notfound(res)
      }
    }

    console.log(`Redirect ${reqUrl} to ${df.root.hostname}`)

    RegistryServer.redirect(res, reqUrl, df)
  }).listen(argv.port, argv.address)

  console.log(`Using registries: ${backends.map(backend => backend.root).join(', ')}`)
  console.log(`Using default registy: ${df.root}`)
  console.log(`Listening on: ${base}`)

  console.log(`To use: npm config set registry ${base}`)
  console.log('^C to close server')

  await new Promise((resolve, reject) => {
    process.on('SIGINT', resolve)
    srv.on('error', reject)
  })

  srv.close()

  console.warn('\nShutting down')
}

yargs
  .options({
    address: {
      type: 'string',
      alias: 'a',
      default: 'localhost',
      describe: 'the address to bind to'
    },
    port: {
      type: 'number',
      alias: 'p',
      default: 22000,
      describe: 'the port to listen on'
    },
    registries: {
      type: 'array',
      alias: 'r',
      describe: 'the backend registries',
      demandOption: true,
      coerce: /** @param {string[]} registries */ registries =>
        registries.map(registry => new RegistryClient(registry))
    },
    default: {
      type: 'string',
      alias: 'd',
      describe: 'the registry used other than fetching packages',
      coerce: /** @param {string} registries */ dft =>
        new RegistryClient(dft)
    },
    help: {
      type: 'boolean',
      alias: 'h',
      describe: 'show help'
    }
  })
  .parse(process.argv.slice(2), async (err, argv, msg) => {
    // arguments validation failed
    if (err && msg) {
      console.error(msg)
      process.exitCode = 1
      return
    }

    // help or version info
    if (msg) {
      console.log(msg)
      return
    }

    if (undefined === argv.default) {
      argv.default = argv.registries[0]
    }

    try {
      await startApp(argv)
    } catch (err) {
      console.error(err.message)
    }
  })

/**
 * @typedef {import('../lib/registry-client.js').default} RegistryClient
 * @typedef {import('../lib/registry-client.js').PackumentRoot} PackumentRoot
 */
