import { spawn } from 'node:child_process';

const service = process.env.RAILWAY_SERVICE_NAME?.trim().toLowerCase();
const port = process.env.PORT;

const commands = {
  api: ['pnpm', ['--filter', '@nsabores/api', 'start:prod']],
  management: [
    'pnpm',
    [
      '--filter',
      '@nsabores/management',
      'exec',
      'next',
      'start',
      '--hostname',
      '0.0.0.0',
      ...(port ? ['--port', port] : []),
    ],
  ],
  website: [
    'pnpm',
    [
      '--filter',
      '@nsabores/website',
      'exec',
      'next',
      'start',
      '--hostname',
      '0.0.0.0',
      ...(port ? ['--port', port] : []),
    ],
  ],
};

if (!service || !(service in commands)) {
  console.error(
    `Unsupported or missing RAILWAY_SERVICE_NAME: ${service ?? '<unset>'}. Expected one of: api, management, website.`,
  );
  process.exit(1);
}

const [command, args] = commands[service];
console.log(
  `Starting Railway service "${service}" with: ${command} ${args.join(' ')}`,
);

const child = spawn(command, args, {
  stdio: 'inherit',
  env: process.env,
});

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 1);
});
