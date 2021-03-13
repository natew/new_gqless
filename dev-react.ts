import TscWatch from 'tsc-watch/client';
import { exec } from 'shelljs';
import { ChildProcess } from 'node:child_process';

const core = new TscWatch();

const subscriptions = new TscWatch();

const react = new TscWatch();

exec(
  'rimraf packages/gqless/dist packages/gqless-react/dist packages/gqless-subscriptions/dist examples/react/last-browser-open'
);

console.log('\nStarting gqless core');
core.start('--project', 'packages/gqless/tsconfig.dev.json');

let reactExample: ChildProcess | undefined;

core.on('success', () => {
  reactExample?.kill('SIGINT');
  react.kill();
  subscriptions.kill();

  console.log('\nStarting gqless-react');
  react.start('--project', 'packages/gqless-react/tsconfig.json');

  react.on('success', () => {
    reactExample?.kill('SIGINT');
    subscriptions.kill();
    console.log('\nStarting gqless-subscriptions');
    subscriptions.start(
      '--project',
      'packages/gqless-subscriptions/tsconfig.json'
    );
    subscriptions.on('success', () => {
      reactExample?.kill('SIGINT');

      console.log('\nStarting gqless React Example');
      exec('kill-port 4141', {
        silent: true,
      });
      reactExample = exec('pnpm -r --filter gqless-react-example dev', {
        async: true,
      });
    });
  });
});
