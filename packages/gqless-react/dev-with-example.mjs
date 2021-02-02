import { execSync } from 'child_process';
import { createServer } from 'http';
import killPort from 'kill-port';

killPort(8282)
  .catch(() => {})
  .finally(() => {
    createServer().listen(8282, () => {
      execSync(
        'tsdx watch --verbose --noClean --onSuccess "pnpm -r --filter gqless-react-example dev"',
        {
          stdio: 'inherit',
          shell: true,
        }
      );
    });
  });
