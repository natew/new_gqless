import { execSync } from 'child_process';
import { createServer } from 'http';
import killPort from 'kill-port';

Promise.all([killPort(8181), killPort(8282)])
  .catch(() => {})
  .finally(() => {
    createServer().listen(8181, () => {
      execSync('pnpm -r --filter @dish/gqless-react start:with:example', {
        stdio: 'inherit',
        shell: true,
      });
    });
  });
