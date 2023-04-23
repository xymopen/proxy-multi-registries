const path = require('path').posix
const URL = require('url').URL

/**
 * rewrite the `baseURL` part of the url
 * @param {URL} source - source url
 * @param {URL} destination - npm endpoint
 * @returns {URL} - redirected url
 */
const rewriteBase = (source, destination) => {
  const srcUrl = new URL(source.toString())

  srcUrl.protocol = destination.protocol
  srcUrl.username = destination.username
  srcUrl.password = destination.password

  srcUrl.host = destination.host
  srcUrl.port = destination.port
  srcUrl.pathname = path.join(destination.pathname, srcUrl.pathname)

  return srcUrl
}

// The packument used in npm is in fact different from the CommonJs spec

/**
 * @param {any[]} packuments
 */
const mergePackuments = (packuments) => {
  return packuments.reduceRight((acc, packument) => {
    const versions = Object.assign({}, acc.versions, packument.versions)
    const distTags = Object.assign({}, acc['dist-tags'], packument['dist-tags'])

    return {
      versions,
      'dist-tags': distTags,
      name: packument.name ? packument.name : acc.name,
      time: packument.time ? packument.time : acc.time,
      users: Object.assign({}, acc.users, packument.users),
      author: Object.assign({}, acc.author, packument.author),
      bugs: packument.bugs ? packument.bugs : acc.bugs,
      contributors: new Set(),
      description: packument.description ? packument.description : acc.description,
      homepage: packument.homepage ? packument.homepage : acc.homepage,
      // keywords: Array.from( new Set( [ ...packument.keywords, ...acc.keywords ] ) ),
      license: packument.license ? packument.license : acc.license,
      readme: packument.readme ? packument.readme : acc.readme,
      readmeFilename: packument.readmeFilename ? packument.readmeFilename : acc.readmeFilename,
      repository: packument.repository ? packument.repository : acc.repository
    }
  }, (/** @type {any} */ ({})))
}

const natural = function * () {
  let i = 0

  while (true) {
    yield i
    i += 1
  }
}

/**
 * @template {any[]} T
 */
class Zip {
  /**
   * @param  {{ [P in keyof T]: Iterator<T[P]> }} iterators
   */
  constructor (...iterators) {
    this.done = false
    this.iterators = iterators
  }

  [Symbol.iterator] () {
    return this
  }

  next () {
    if (this.done) {
      return {
        value: undefined,
        done: true
      }
    } else {
      const values = []

      for (const iterator of this.iterators) {
        const { value, done } = iterator.next()

        if (done) {
          this.done = true

          return {
            value: undefined,
            done: true
          }
        } else {
          values.push(value)
        }
      }

      return {
        value: values,
        done: false
      }
    }
  }
}

/**
 * @template T
 * @param {Iterable<T>} iterable
 * @returns {Zip<[T, number]>}
 */
const indexed = iterable =>
  new Zip(iterable[Symbol.iterator](), natural())

exports.rewriteBase = rewriteBase
exports.mergePackuments = mergePackuments
exports.natural = natural
exports.Zip = Zip
exports.indexed = indexed

/**
 * @typedef {import('../lib/registry-client.js').PackumentRoot} PackumentRoot
 */
