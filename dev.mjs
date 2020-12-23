import { spawn } from 'child_process';
import fkill from 'fkill';

const processes = ['pnpm dev:start', 'pnpm dev:test'].map((script) => {
  return spawn(script, {
    detached: true,
    shell: true,
  }).pid;
});

process.on('SIGINT', () => {
  fkill(processes, {
    force: true,
  }).catch(() => {});
});

process.on('exit', () => {
  fkill(processes, {
    force: true,
  }).catch(() => {});
});
