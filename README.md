# proxy-multi-registries

A from-scratch rework of [proxy-registry](https://github.com/npm/proxy-registry "npm/proxy-registry") to fetch packages from multiple registries.

``` console
$ npx github:xymopen/proxy-multi-registries
Using registries: https://registry.npmjs.com/
Listening on: http://localhost:22000
To use: npm config set registry http://localhost:22000
^C to close server
```

## OPTIONS

``` console
Options:
  --help, -h        show help                                          [boolean]
  --version, -v     show version number                                [boolean]
  --address, -a     the address to bind to       [string] [default: "localhost"]
  --port, -p        the port to listen on              [number] [default: 22000]
  --registries, -r  the backend registries                               [array]
  --default, -d     the registry used other than fetching packages      [string]
```

## TODO

* Packuments merge strategy is far from perfect.
