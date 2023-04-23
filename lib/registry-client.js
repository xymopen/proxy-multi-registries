const path = require('path').posix
const URL = require('url').URL

const validateNpmPackageName = require('validate-npm-package-name')
const fetch = require('node-fetch').default

/**
 * Package Registry Client Operations
 *
 * @see [Packages/1.0](http://wiki.commonjs.org/wiki/Packages/1.0 "Packages/1.0 - CommonJS Spec Wiki")
 * @see [Packages/Registry](http://wiki.commonjs.org/wiki/Packages/Registry "Packages/Registry - CommonJS Spec Wiki")
 * @see [Package Metadata](https://github.com/npm/registry/blob/master/docs/responses/package-metadata.md "registry/package-metadata.md at master · npm/registry")
 * @see [Public Registry API](https://github.com/npm/registry/blob/master/docs/REGISTRY-API.md "registry/REGISTRY-API.md at master · npm/registry")
 */
class RegistryClient {
  /**  @param {string} root */
  constructor (root) {
    const rootUrl = new URL(root)

    rootUrl.hash = ''
    rootUrl.search = ''

    this.root = rootUrl
  }

  /** @param {string} pkg - package */
  getPackageRootURL (pkg) {
    const url = new URL(this.root.toString())

    url.pathname = path.join(url.pathname, encodeURIComponent(pkg))

    return url.toString()
  }

  /**
   * @param {string} pkg - package
   * @param {string} version
   */
  getPackageVerisonURL (pkg, version) {
    const url = new URL(this.root.toString())

    url.pathname = path.join(url.pathname, encodeURIComponent(pkg), encodeURIComponent(version))

    return url.toString()
  }

  /**
   * @param {string} pkg - package
   * @returns {Promise<PackumentRoot>}
   */
  async getPackage (pkg) {
    const res = await fetch(this.getPackageRootURL(pkg))

    if (res.ok) {
      return (/** @type {PackumentRoot} */ (await res.json()))
    } else {
      throw new Error(res.statusText)
    }
  }

  /**
   * @param {string} pkg - package
   * @param {string} ver - version
   * @returns {Promise<boolean>}
   */
  async hasPackageVerison (pkg, ver) {
    const res = await fetch(this.getPackageVerisonURL(pkg, ver), {
      method: 'HEAD'
    })

    return res.ok
  }

  /**
   * @param {string} pathname
   * @returns {PackumentClass | null}
    */
  static classify (pathname) {
    const segments = pathname.split(path.sep)

    if (segments[0] !== '') {
      return null
    }

    const pkg = decodeURIComponent(segments[1])

    if (segments.length === 2 &&
      validateNpmPackageName(pkg).validForOldPackages) {
      return {
        type: 'package-root',
        package: pkg,
        version: undefined
      }
    } else if (segments.length === 3) {
      return {
        type: 'package-version',
        package: pkg,
        version: decodeURIComponent(segments[2])
      }
    } else {
      return null
    }
  }
}

exports.default = RegistryClient

/**
 * @typedef PackumentMaintainer
 * @property {string} name
 * @property {string} [email]
 * @property {string} [web]
 */

/**
 * @typedef PackumentRepository
 * @property {string} name
 * @property {string} url
 * @property {string} [path]
 */

/**
 * @typedef PackumentRoot
 * @property {string} name
 * @property {object[]} versions
 * @property {string} [mtime]
 * @property {string} [ctime]
 * @property {PackumentMaintainer[]} [maintainers]
 * @property {PackumentRepository} [repository]
 * @property {string} [url]
 * @property {string} [description]
 */

/**
 * @typedef PackumentRootClass
 * @property {'package-root'} type
 * @property {string} package
 * @property {undefined} version
 */

/**
 * @typedef PackumentVersionClass
 * @property {'package-version'} type
 * @property {string} package
 * @property {string} version
 */

/**
 * @typedef {PackumentRootClass | PackumentVersionClass} PackumentClass
 */
