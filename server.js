#!/usr/bin/env node
"use strict"

const yargs = require( "yargs" );

const http = require( "http" )
const URL = require( "url" ).URL;

const fetch = require( "node-fetch" )

const Koa = require( "koa" )
const Router = require( 'koa-router' );
const compress = require( "koa-compress" )
const logger = require( "koa-logger" )
const error = require( "koa-json-error" )

// The server use HTTP 308 for redirect
// so lockfile will have real registry instead of proxy
// See https://developer.mozilla.org/en-US/docs/Web/HTTP/Redirections

// See https://github.com/npm/registry/blob/master/docs/responses/package-metadata.md for Packument type

/**
 * succeed if at least one promise resolved,
 * fail if all promises rejected
 * @param {Promise<any>[]} promises
 * @returns {Promise<any[] & { errors: Error[] }>}}
 * @throws {Error[]}
 */
const some = async promises => {
  /**
   * @type {any[] & { errors?: Error[] }}
   */
  const values = [],
    /**
     * @type {Error[]}
     */
    errors = [];

  for ( const promise of promises ) {
    try {
      values.push( await promise );
    } catch ( error ) {
      errors.push( error );
    }
  }

  if ( values.length > 0 ) {
    values.errors = errors;

    return values;
  } else {
    throw errors;
  }
};

const assertJson = function () {
  const errorHandler = error()

  return ( ctx, next ) =>
    errorHandler( ctx, async () => {
      ctx.assert( ctx.request.accepts( "json" ), 406 )
      ctx.response.type = "json"
      await next()
    } )
}

/**
 * rewrite the `origin` part of the url
 * @param {URL} source - source url
 * @param {URL} destination - npm endpoint
 * @returns {URL} - redirected url
 */
const rewriteOrigin = ( source, destination ) => {
  const $source = new URL( source.toString() );

  $source.protocol = destination.protocol;
  $source.host = destination.host;
  $source.port = destination.port;

  return $source;
};

/**
 * fetch target npm registry response
 * @param {URL} source - source npm endpoint request URL
 * @param {URL} destination - destination npm registry URL
 * @param {RequestInit} init - source npm endpoint request
 * @returns {Promise<Response>} - response from corresponding target endpoint
 */
const proxy = ( source, destination, init ) =>
  fetch( rewriteOrigin( source, destination ).toString(), {
    method: init.method,
    headers: {
      ...init.headers,
      host: destination.host,
    },
    body: ( init.method === "GET" || init.method === "HEAD" ) ? undefined : init.body,
    redirect: "follow",
    compress: true,
  } );

/**
 * @param {URL[]} registries - preferred npm registries in descent order
 * @method cache - register a package and its versions from a registry
 * @method middleware - generate koa middleware
 */
const PkgCache = registries => {
  /**
   * @type {Map<string, Set<URL>>} - { [key: package@version]: Set<registry> }
   */
  const pkgs = new Map();

  return {
    /**
     *
     * @param {*} packument
     * @param {URL} registry
     */
    cache ( packument, registry ) {
      Object.keys( packument.versions ).forEach( version => {
        const tarball = `${ packument.name }@${ version } }`;

        /**
        * @type {Set<URL>}
        */
        let registries

        if ( pkgs.has( tarball ) ) {
          registries = pkgs.get( tarball );
        } else {
          registries = new Set();
          pkgs.set( tarball, registries );
        }

        registries.add( registry );
      } );
    },
    middleware: () => async ( ctx ) => {
      const { package: pkg, version } = ctx.params;
      const tarball = `${ pkg }@${ version } }`;
      const hits = pkgs.has( tarball ) ? pkgs.get( tarball ) : new Set();
      const registry = registries.find( registry => hits.has( registry ) );

      if ( registry ) {
        ctx.response.status = 308;
        ctx.set( "Location", rewriteOrigin( ctx.request.URL, registry ).toString() );
      } else {
        ctx.response.status = 404;
      }
    }
  }
};

const mergePackuments = ( packuments ) => {
  return packuments.reduceRight( ( acc, packument ) => {
    const versions = Object.assign( {}, acc.versions, packument.versions );
    const distTags = Object.assign( {}, acc[ "dist-tags" ], packument[ "dist-tags" ] );

    return {
      versions,
      "dist-tags": distTags,
      name: packument.name ? packument.name : acc.name,
      time: packument.time ? packument.time : acc.time,
      users: Object.assign( {}, acc.users, packument.users ),
      author: Object.assign( {}, acc.author, packument.author ),
      bugs: packument.bugs ? packument.bugs : acc.bugs,
      contributors: new Set(),
      description: packument.description ? packument.description : acc.description,
      homepage: packument.homepage ? packument.homepage : acc.homepage,
      // keywords: Array.from( new Set( [ ...packument.keywords, ...acc.keywords ] ) ),
      license: packument.license ? packument.license : acc.license,
      readme: packument.readme ? packument.readme : acc.readme,
      readmeFilename: packument.readmeFilename ? packument.readmeFilename : acc.readmeFilename,
      repository: packument.repository ? packument.repository : acc.repository,
    }
  }, {} );
}

yargs.options( {
  address: {
    type: "string",
    alias: "a",
    default: "localhost",
    describe: "the address to bind to",
  },
  port: {
    type: "number",
    alias: "p",
    default: 22000,
    describe: "the port to listen on",
  },
  registries: {
    type: "array",
    alias: "r",
    default: [ "https://registry.npmjs.com/" ],
    describe: "uplink registries"
  },
  log: {
    type: "boolean",
    default: true,
    describe: "log requests",
  },
  help: {
    type: "boolean",
    alias: "h",
    describe: "show help",
  },
  version: {
    type: "boolean",
    alias: "v",
    describe: "show version number",
  },
} );

yargs.parse( process.argv.slice( 2 ), async ( err, argv, output ) => {
  // arguments validation failed
  if ( err && output ) {
    console.error( output );
    process.exitCode = 1;
    return;
  }

  // help or version info
  if ( output ) {
    console.log( output );
    return;
  }

  /**
   * @type {URL[]}
   */
  const registries = argv.registries.map( registry => new URL( registry ) );
  const defaultRegistry = registries[ 0 ];
  const pkgCache = PkgCache( registries );
  const app = new Koa()

  if ( argv.log ) app.use( logger() )
  app.use( assertJson() )
    .use( compress() )
    .use( ( new Router() )
      .get( "/:package", async ( ctx ) => {
        try {
          const packuments = await some( registries.map( async registry => {
            try {
              const response = await proxy( rewriteOrigin( ctx.request.URL, registry ), registry, {
                ...ctx.req,
                body: ctx.req,
              } );

              if ( response.ok ) {
                const packument = await response.json();
                console.log( `      fetch ${ rewriteOrigin( ctx.request.URL, registry ) } succeed` );
                pkgCache.cache( packument, registry );
                return packument;
              } else {
                throw response;
              }
            } catch ( error ) {
              console.error( `      fetch ${ rewriteOrigin( ctx.request.URL, registry ) } failed` );
              throw error;
            }
          } ) );

          ctx.response.status = 200;
          ctx.body = mergePackuments( packuments );
        } catch ( error ) {
          console.error( `            ${ error.message }` );
        }
      } )
      .get( "/:package/:version", pkgCache.middleware() )
      .middleware() )
    .use( ( ctx ) => {
      ctx.response.status = 308;
      ctx.set( "Location", rewriteOrigin( ctx.request.URL, defaultRegistry ).toString() );
    } )

  console.log( `Using registries: ${ registries.join( ', ' ) }` )
  console.log( `Listening on: http://${ argv.address }:${ argv.port }` )
  const srv = http.createServer( app.callback() ).listen( argv.port, argv.address )

  await new Promise( ( resolve, reject ) => {
    app.on( "error", reject )
    srv.on( "error", reject )
    console.log( `To use: npm config set registry http://${ argv.address }:${ argv.port }/` )
    console.log( `^C to close server` )
    process.on( "SIGINT", resolve )
  } )
  console.error( "\nShutting down" )
  srv.close()
} );
