class PackageCache {
  constructor () {
    /** @type {Map<string, Map<string, number>>} */
    this.cache = new Map()
  }

  /**
   * @param {string} pkg
   * @param {string} version
   * @returns {boolean}
   */
  hasPkgVer (pkg, version) {
    return this.cache.has(pkg) &&
      this.cache.get(pkg).has(version)
  }

  /**
   * @param {string} pkg
   * @param {string} version
   * @param {number} priority
   * @returns {void}
   */
  addPkgVer (pkg, version, priority) {
    const vers = (() => {
      if (this.cache.has(pkg)) {
        return this.cache.get(pkg)
      } else {
        const vers = new Map()

        this.cache.set(pkg, vers)

        return vers
      }
    })()

    if (!vers.has(version) ||
      vers.get(version) > priority) {
      vers.set(version, priority)
    }
  }

  /**
   * @param {string} pkg
   * @param {string} version
   * @returns {number}
   */
  getPkgVer (pkg, version) {
    if (!this.cache.has(pkg)) {
      return NaN
    } else {
      const vers = this.cache.get(pkg)

      return vers.get(version) || NaN
    }
  }

  /**
   * @param {string} pkg
   * @param {number} priority
   * @returns {void}
   */
  deletePkg (pkg, priority) {
    if (this.cache.has(pkg)) {
      this.cache.get(pkg).forEach((thisPriority, ver, vers) => {
        if (priority === thisPriority) {
          vers.delete(ver)
        }
      })
    }
  }
}

exports.default = PackageCache
