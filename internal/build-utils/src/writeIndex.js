import { promises } from 'fs';

const { writeFile } = promises;

export async function writeIndex(
  /**
   * @type {string}
   */
  moduleName
) {
  await writeFile(
    'dist/index.js',
    `'use strict'
if (process.env.NODE_ENV === "production") {
module.exports = require('./${moduleName}.cjs.production.min.js')
} else {
module.exports = require('./${moduleName}.cjs.development.js')
}
`
  );
}
