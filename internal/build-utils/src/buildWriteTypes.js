import { resolve } from 'path';
import fsExtra from 'fs-extra';
const { outputFile } = fsExtra;

export async function buildWriteTypes(
  /**
   * @type {import("rollup").RollupBuild}
   */
  bundle,
  /**
   * @type {() => void}
   */
  afterFileWrite = () => {}
) {
  const { output } = await bundle.generate({
    dir: 'dist',
    sourcemap: true,
  });

  await Promise.all(
    output.map((chunkOrAsset) => {
      if (chunkOrAsset.type === 'asset') {
        return outputFile(
          resolve('./dist', chunkOrAsset.fileName),
          chunkOrAsset.source
        ).then(afterFileWrite);
      }
    })
  );
}
