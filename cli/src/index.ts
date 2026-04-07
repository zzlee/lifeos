import { Command } from 'commander';
import chalk from 'chalk';
import fs from 'fs';
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

auth.command('set-url')
  .description('Update the API base URL')
  .argument('<url>', 'The new API base URL')
  .action((url) => {
    config.set('apiUrl', url);
    console.log(chalk.green(`API URL updated to: ${url}`));
  });

const keyMgmt = auth.command('key').description('Manage API keys');

keyMgmt.command('create')
  .description('Create a new API key')
  .option('-n, --name <name>', 'Name for the API key', 'New API Key')
  .action(async (options) => {
    try {
      const res = await api.post('/api/auth/keys', { name: options.name });
      console.log(chalk.green('\n✓ API Key created successfully!'));
      console.log(chalk.bold.cyan(`\nYour API Key: ${res.data.key}`));
      console.log(chalk.dim('\nPlease save this key securely. It will not be shown again.'));
      console.log(chalk.dim(`\nTo use this key, run: ${chalk.bold('lifeos auth login <key>')}\n`));
    } catch (e: any) {
      console.log(chalk.red(`Error creating API key: ${e.response?.data?.error || e.message}`));
    }
  });

keyMgmt.command('list')
  .description('List all your API keys')
  .action(async () => {
    try {
      const res = await api.get('/api/auth/keys');
      const keys = res.data.keys;
      if (!keys || keys.length === 0) {
        console.log(chalk.yellow('No API keys found.'));
        return;
      }
      console.log(chalk.bold(`\nYour API Keys:`));
      console.table(keys);
    } catch (e: any) {
      console.log(chalk.red(`Error listing API keys: ${e.response?.data?.error || e.message}`));
    }
  });

keyMgmt.command('delete')
  .description('Delete an API key')
  .argument('<id>', 'ID of the API key to delete')
  .action(async (id) => {
    try {
      await api.delete(`/api/auth/keys/${id}`);
      console.log(chalk.green(`✓ API key ${id} has been revoked.`));
    } catch (e: any) {
      console.log(chalk.red(`Error deleting API key: ${e.response?.data?.error || e.message}`));
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

vault.command('export')
  .description('Export all vault secrets to a JSON file')
  .argument('<filename>', 'Filename to export to (e.g., secrets.json)')
  .action(async (filename) => {
    try {
      console.log(chalk.blue(`Exporting secrets to ${filename}...`));
      const res = await api.get('/api/vault/export');
      fs.writeFileSync(filename, JSON.stringify(res.data.items, null, 2));
      console.log(chalk.green(`✓ Successfully exported ${res.data.items.length} items.`));
    } catch (e: any) {
      console.log(chalk.red(`Error exporting: ${e.response?.data?.error || e.message}`));
    }
  });

vault.command('import')
  .description('Import vault secrets from a JSON file')
  .argument('<filename>', 'Filename to import from')
  .action(async (filename) => {
    try {
      if (!fs.existsSync(filename)) {
        console.log(chalk.red(`File not found: ${filename}`));
        return;
      }
      const data = JSON.parse(fs.readFileSync(filename, 'utf-8'));
      if (!Array.isArray(data)) {
        console.log(chalk.red('Invalid format: File must contain an array of vault items.'));
        return;
      }

      console.log(chalk.blue(`Importing ${data.length} items...`));
      let success = 0;
      for (const item of data) {
        try {
          await api.post('/api/vault', item);
          success++;
        } catch (err: any) {
          console.log(chalk.yellow(`! Failed to import ${item.site}: ${err.message}`));
        }
      }
      console.log(chalk.green(`✓ Successfully imported ${success}/${data.length} items.`));
    } catch (e: any) {
      console.log(chalk.red(`Error importing: ${e.message}`));
    }
  });

program.parse();
