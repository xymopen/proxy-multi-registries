const { rewriteBase } = require('./misc.js')

/**
 * Package Registry Server Operations
 *
 * @see [Packages/Registry](http://wiki.commonjs.org/wiki/Packages/Registry "Packages/Registry - CommonJS Spec Wiki")
 * @see [Public Registry API](https://github.com/npm/registry/blob/master/docs/REGISTRY-API.md "registry/REGISTRY-API.md at master · npm/registry")
 */
const RegistryServer = {
  /**
   * @param {import("http").ServerResponse} res
   * @param {object} body
   */
  ok (res, body) {
    res.writeHead(200)
    res.write(JSON.stringify(body))
    res.end()
  },
  /**
   * @param {import("http").ServerResponse} res
   * @param {URL} reqUrl
   * @param {import('./registry-client').default} registry
   */
  redirect (res, reqUrl, registry) {
    const location = rewriteBase(reqUrl, registry.root).toString()

    res.setHeader('Location', location)
    res.writeHead(301)
    res.write(JSON.stringify({ location }))
    res.end()
  },
  /** @param {import("http").ServerResponse} res */
  notfound (res) {
    res.writeHead(404)
    res.write(JSON.stringify({ error: 'Not found' }))
    res.end()
  }
}

exports.default = RegistryServer
