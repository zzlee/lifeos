import { Command } from 'commander';
import chalk from 'chalk';
import { config } from './config';
import { api } from './api';

const program = new Command();

program
  .name('lifeos')
  .description('LifeOS CLI for managing your digital life')
  .version('1.0.0');

// --- Auth Commands ---
const auth = program.command('auth').description('Authentication management');

auth.command('login')
  .description('Login using an API Key')
  .argument('<key>', 'Your LifeOS API Key')
  .action((key) => {
    config.set('apiKey', key);
    console.log(chalk.green('Successfully logged in!'));
  });

auth.command('logout')
  .description('Logout and remove API Key')
  .action(() => {
    config.set('apiKey', '');
    console.log(chalk.yellow('Logged out.'));
  });

auth.command('status')
  .description('Check authentication status')
  .action(async () => {
    try {
      const res = await api.get('/api/session');
      if (res.data.authenticated) {
        console.log(chalk.green(`Authenticated as: ${res.data.user.name} (${res.data.user.email})`));
      } else {
        console.log(chalk.red('Not authenticated. Please run "lifeos auth login <key>"'));
      }
    } catch (e: any) {
      console.log(chalk.red(`Error: ${e.response?.data?.error || e.message}`));
    }
  });

// --- Log Command ---
program.command('log')
  .description('Quickly log data using natural language')
  .argument('<text>', 'Log text')
  .action(async (text) => {
    try {
      const res = await api.post('/api/agent', { command: text });
      console.log(chalk.green('✓ Logged successfully!'));
      console.log(chalk.dim(`Mutation: ${res.data.mutation.kind}`));
    } catch (e: any) {
      console.log(chalk.red(`Error: ${e.response?.data?.error || e.message}`));
    }
  });

// --- List Command ---
program.command('ls')
  .description('List entries for a module')
  .argument('<module>', 'Module to list (finance, journals, health, vault)')
  .action(async (module) => {
    try {
      const res = await api.get('/api/dashboard');
      const data = res.data.data[module];
      if (!data) {
        console.log(chalk.red(`Unknown module: ${module}`));
        return;
      }
      console.log(chalk.bold(`\n--- ${module.toUpperCase()} ---`));
      console.table(data);
    } catch (e: any) {
      console.log(chalk.red(`Error: ${e.response?.data?.error || e.message}`));
    }
  });

// --- Vault Command ---
const vault = program.command('vault').description('Vault management');

vault.command('get')
  .description('Retrieve a secret from the vault')
  .argument('<id>', 'Vault item ID')
  .action(async (id) => {
    try {
      const res = await api.get(`/api/vault/${id}/secret`);
      console.log(chalk.green(`Secret: ${res.data.secret}`));
    } catch (e: any) {
      console.log(chalk.red(`Error: ${e.response?.data?.error || e.message}`));
    }
  });

program.parse();
