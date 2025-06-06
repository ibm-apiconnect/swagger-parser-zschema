# 🛠️ About This Fork
This is a fork of @apidevtools/swagger-parser created to improve Content Security Policy (CSP) compliance for secure web environments.

# 🚨 Why Fork?
The original package uses the following JSON Schema validators:

ajv

ajv-draft-04

Both rely on dynamic code generation (new Function()), which is blocked under CSP unless unsafe-eval is allowed. This presents security concerns for browser-based applications that enforce strict CSP rules.

# ✅ What Was Changed
🔁 Replaced ajv and ajv-draft-04 with z-schema, a JSON Schema validator that does not use eval or new Function(), making it CSP-safe.

🧪 Updated the internal validation logic to work with Z-Schema.

🔒 Ensures OpenAPI (Swagger 2.0 / OAS 3.0 / 3.1) schema validation can run in environments with strict CSP (e.g., browsers without unsafe-eval).


# Swagger 2.0 and OpenAPI 3.0 parser/validator

[![Build Status](https://github.com/APIDevTools/swagger-parser/workflows/CI-CD/badge.svg?branch=master)](https://github.com/APIDevTools/swagger-parser/actions)
[![Coverage Status](https://coveralls.io/repos/github/APIDevTools/swagger-parser/badge.svg?branch=master)](https://coveralls.io/github/APIDevTools/swagger-parser)
[![Tested on APIs.guru](https://api.apis.guru/badges/tested_on.svg)](https://apis.guru/browse-apis/)

[![npm](https://img.shields.io/npm/v/@apidevtools/swagger-parser.svg)](https://www.npmjs.com/package/@apidevtools/swagger-parser)
[![Dependencies](https://david-dm.org/APIDevTools/swagger-parser.svg)](https://david-dm.org/APIDevTools/swagger-parser)
[![License](https://img.shields.io/npm/l/@apidevtools/swagger-parser.svg)](LICENSE)
[![Buy us a tree](https://img.shields.io/badge/Treeware-%F0%9F%8C%B3-lightgreen)](https://shop.protect.earth/)

[![OS and Browser Compatibility](https://apidevtools.com/img/badges/ci-badges-with-ie.svg)](https://github.com/APIDevTools/swagger-parser/actions)

## Features

- Parses Swagger specs in **JSON** or **YAML** format
- Validates against the [Swagger 2.0 schema](https://github.com/OAI/OpenAPI-Specification/blob/master/schemas/v2.0/schema.json) or [OpenAPI 3.0 Schema](https://github.com/OAI/OpenAPI-Specification/blob/master/schemas/v3.0/schema.json)
- [Resolves](https://apidevtools.com/swagger-parser/docs/swagger-parser.html#resolveapi-options-callback) all `$ref` pointers, including external files and URLs
- Can [bundle](https://apidevtools.com/swagger-parser/docs/swagger-parser.html#bundleapi-options-callback) all your Swagger files into a single file that only has _internal_ `$ref` pointers
- Can [dereference](https://apidevtools.com/swagger-parser/docs/swagger-parser.html#dereferenceapi-options-callback) all `$ref` pointers, giving you a normal JavaScript object that's easy to work with
- **[Tested](https://github.com/APIDevTools/swagger-parser/actions)** in Node.js and all modern web browsers on Mac, Windows, and Linux
- Tested on **[over 1,500 real-world APIs](https://apis.guru/browse-apis/)** from Google, Microsoft, Facebook, Spotify, etc.
- Supports [circular references](https://apidevtools.com/swagger-parser/docs/#circular-refs), nested references, back-references, and cross-references
- Maintains object reference equality &mdash; `$ref` pointers to the same value always resolve to the same object instance



## Example

```javascript
SwaggerParser.validate(myAPI, (err, api) => {
  if (err) {
    console.error(err);
  } else {
    console.log("API name: %s, Version: %s", api.info.title, api.info.version);
  }
});
```

Or use `async`/`await` or [Promise](http://javascriptplayground.com/blog/2015/02/promises/) syntax instead. The following example is the same as above:

```javascript
try {
  let api = await SwaggerParser.validate(myAPI);
  console.log("API name: %s, Version: %s", api.info.title, api.info.version);
} catch (err) {
  console.error(err);
}
```

For more detailed examples, please see the [API Documentation](https://apidevtools.com/swagger-parser/docs/)

## Installation

Install using [npm](https://docs.npmjs.com/about-npm/):

```bash
npm install @ibm-apiconnect/swagger-parser-zschema
```

## Usage

When using Swagger Parser in Node.js apps, you'll probably want to use **CommonJS** syntax:

```javascript
const SwaggerParser = require("@ibm-apiconnect/swagger-parser-zschema");
```

When using a transpiler such as [Babel](https://babeljs.io/) or [TypeScript](https://www.typescriptlang.org/), or a bundler such as [Webpack](https://webpack.js.org/) or [Rollup](https://rollupjs.org/), you can use **ECMAScript modules** syntax instead:

```javascript
import * as SwaggerParser from "@ibm-apiconnect/swagger-parser-zschema";
```

## Browser support

Swagger Parser supports recent versions of every major web browser. Older browsers may require [Babel](https://babeljs.io/) and/or [polyfills](https://babeljs.io/docs/en/next/babel-polyfill).

To use Swagger Parser in a browser, you'll need to use a bundling tool such as [Webpack](https://webpack.js.org/), [Rollup](https://rollupjs.org/), [Parcel](https://parceljs.org/), or [Browserify](http://browserify.org/). Some bundlers may require a bit of configuration, such as setting `browser: true` in [rollup-plugin-resolve](https://github.com/rollup/rollup-plugin-node-resolve).

## API Documentation

Full API documentation is available [right here](https://apidevtools.com/swagger-parser/docs/)

## Security

The library, by default, attempts to resolve any files referenced using `$ref`, without considering file extensions or the location of the files. This can result in Local File Inclusion (LFI), thus, potentially sensitive information disclosure. Developers must be cautious when working with documents from untrusted sources. See [here](SECURITY.md) for more details and information on how to mitigate LFI.


## License

Swagger Parser is 100% free and open-source, under the [MIT license](LICENSE). Use it however you want.

This package is [Treeware](http://treeware.earth). If you use it in production, then we ask that you [**buy the world a tree**](https://shop.protect.earth) to thank us for our work.

## Big Thanks To

Thanks to these awesome companies for their support of Open Source developers ❤

[![GitHub](https://apidevtools.com/img/badges/github.svg)](https://github.com/open-source)
[![NPM](https://apidevtools.com/img/badges/npm.svg)](https://www.npmjs.com/)
[![Coveralls](https://apidevtools.com/img/badges/coveralls.svg)](https://coveralls.io)
