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
   -h, --help        show help                                          [boolean]
       --version     show version number                                [boolean]
   -a, --address     the address to bind to       [string] [default: "localhost"]
   -p, --port        the port to listen on              [number] [default: 22000]
   -r, --registries  the backend registries                               [array]
   -d, --default     the registry used other than fetching packages      [string]
```

## TODO

* Packuments merge strategy is far from perfect.
