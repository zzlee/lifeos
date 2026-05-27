import 'dotenv/config';
import { Command } from 'commander';
import chalk from 'chalk';
import fs from 'fs';
import { config } from './config';
import { api } from './api';
import { startMcpServer } from './mcp';

const program = new Command();

program
  .name('lifeos')
  .description('LifeOS CLI for managing your digital life')
  .version('1.0.0');

// --- MCP Command ---
program.command('mcp')
  .description('Start the MCP stdio server')
  .action(startMcpServer);

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

// Backward-compatible config command documented in older README versions.
const configCmd = program.command('config').description('Configure the LifeOS CLI');
configCmd.command('set')
  .description('Set a config value: key/apiKey or url/apiUrl')
  .argument('<field>', 'key/apiKey or url/apiUrl')
  .argument('<value>', 'Value to store')
  .action((field, value) => {
    if (['key', 'apiKey', 'api-key'].includes(field)) {
      config.set('apiKey', value);
      console.log(chalk.green('API key updated.'));
      return;
    }
    if (['url', 'apiUrl', 'api-url'].includes(field)) {
      config.set('apiUrl', value);
      console.log(chalk.green(`API URL updated to: ${value}`));
      return;
    }
    console.log(chalk.red(`Unknown config field: ${field}. Use "key" or "url".`));
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


// --- Backward-compatible List Command ---
program.command('ls')
  .description('List LifeOS data (finance|expenses|journal|journals|health|vault)')
  .argument('<resource>', 'Resource to list')
  .option('-l, --limit <number>', 'Limit number of entries', '20')
  .option('-o, --offset <number>', 'Offset for pagination', '0')
  .action(async (resource, options) => {
    try {
      const limit = options.limit;
      const offset = options.offset;
      const normalized = String(resource).toLowerCase();
      if (['finance', 'expense', 'expenses'].includes(normalized)) {
        const res = await api.get(`/api/expenses?limit=${limit}&offset=${offset}`);
        console.table(res.data.expenses || []);
        return;
      }
      if (['journal', 'journals'].includes(normalized)) {
        const res = await api.get(`/api/journals?limit=${limit}&offset=${offset}`);
        console.table(res.data.journals || []);
        return;
      }
      if (normalized === 'health') {
        const res = await api.get(`/api/health?limit=${limit}&offset=${offset}`);
        console.table(res.data.health || []);
        return;
      }
      if (normalized === 'vault') {
        const res = await api.get(`/api/vault?limit=${limit}&offset=${offset}`);
        console.table(res.data.items || []);
        return;
      }
      console.log(chalk.red(`Unknown resource: ${resource}`));
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
      const res = await api.post('/api/agent', { messages: [{ role: 'user', content: text }] });
      console.log(chalk.green('✓ LifeOS agent completed.'));
      if (res.data.reply) console.log(res.data.reply);
    } catch (e: any) {
      console.log(chalk.red(`Error: ${e.response?.data?.error || e.message}`));
    }
  });

// --- Journal Command ---
const journal = program.command('journal').description('Journal management');

journal.command('ls')
  .description('List all journals')
  .option('-l, --limit <number>', 'Limit number of entries', '20')
  .option('-o, --offset <number>', 'Offset for pagination', '0')
  .action(async (options) => {
    try {
      const res = await api.get(`/api/journals?limit=${options.limit}&offset=${options.offset}`);
      const journals = res.data.journals;
      if (!journals || journals.length === 0) {
        console.log(chalk.yellow('No journals found.'));
        return;
      }
      console.log(chalk.bold('\n--- JOURNALS ---'));
      console.table(journals);
    } catch (e: any) {
      console.log(chalk.red(`Error: ${e.response?.data?.error || e.message}`));
    }
  });

journal.command('get')
  .description('Get a journal entry by ID')
  .argument('<id>', 'Journal entry ID')
  .action(async (id) => {
    try {
      const res = await api.get('/api/dashboard');
      const journals = res.data.data.journals;
      const entry = journals.find((j: any) => j.id === Number(id));
      if (!entry) {
        console.log(chalk.red(`Journal ${id} not found.`));
        return;
      }
      console.log(chalk.bold(`\n--- JOURNAL ${id} ---`));
      console.log(chalk.dim('Date:'), entry.date);
      console.log(chalk.dim('Tags:'), entry.tags.join(', '));
      console.log(chalk.dim('\nContent:'));
      console.log(entry.content);
    } catch (e: any) {
      console.log(chalk.red(`Error: ${e.response?.data?.error || e.message}`));
    }
  });

journal.command('create')
  .description('Create a new journal entry')
  .argument('<content>', 'Journal content')
  .option('-t, --tags <tags>', 'Tags (comma separated)', '')
  .action(async (content, options) => {
    try {
      const tags = options.tags ? options.tags.split(',').map((t: string) => t.trim()) : [];
      await api.post('/api/journals', { content, tags });
      console.log(chalk.green('✓ Journal entry created successfully!'));
    } catch (e: any) {
      console.log(chalk.red(`Error: ${e.response?.data?.error || e.message}`));
    }
  });

journal.command('update')
  .description('Update a journal entry')
  .argument('<id>', 'Journal entry ID')
  .argument('<content>', 'New journal content')
  .option('-t, --tags <tags>', 'Tags (comma separated)', '')
  .action(async (id, content, options) => {
    try {
      const tags = options.tags ? options.tags.split(',').map((t: string) => t.trim()) : [];
      await api.put(`/api/journals/${id}`, { content, tags });
      console.log(chalk.green(`✓ Journal entry ${id} updated successfully!`));
    } catch (e: any) {
      console.log(chalk.red(`Error: ${e.response?.data?.error || e.message}`));
    }
  });

journal.command('delete')
  .description('Delete a journal entry')
  .argument('<id>', 'Journal entry ID')
  .action(async (id) => {
    try {
      await api.delete(`/api/journals/${id}`);
      console.log(chalk.green(`✓ Journal entry ${id} deleted successfully!`));
    } catch (e: any) {
      console.log(chalk.red(`Error: ${e.response?.data?.error || e.message}`));
    }
  });

// --- Finance Command ---
const finance = program.command('finance').description('Finance management');

finance.command('ls')
  .description('List all expenses')
  .option('-l, --limit <number>', 'Limit number of entries', '20')
  .option('-o, --offset <number>', 'Offset for pagination', '0')
  .action(async (options) => {
    try {
      const res = await api.get(`/api/expenses?limit=${options.limit}&offset=${options.offset}`);
      const expenses = res.data.expenses;
      if (!expenses || expenses.length === 0) {
        console.log(chalk.yellow('No expenses found.'));
        return;
      }
      console.log(chalk.bold('\n--- EXPENSES ---'));
      console.table(expenses);
    } catch (e: any) {
      console.log(chalk.red(`Error: ${e.response?.data?.error || e.message}`));
    }
  });

finance.command('get')
  .description('Get an expense by ID')
  .argument('<id>', 'Expense ID')
  .action(async (id) => {
    try {
      const res = await api.get('/api/dashboard');
      const expenses = res.data.data.finance;
      const entry = expenses.find((e: any) => e.id === Number(id));
      if (!entry) {
        console.log(chalk.red(`Expense ${id} not found.`));
        return;
      }
      console.log(chalk.bold(`\n--- EXPENSE ${id} ---`));
      console.log(chalk.dim('Date:'), entry.date);
      console.log(chalk.dim('Category:'), entry.category);
      console.log(chalk.dim('Amount:'), `NT$ ${entry.amount}`);
      console.log(chalk.dim('Note:'), entry.note);
    } catch (e: any) {
      console.log(chalk.red(`Error: ${e.response?.data?.error || e.message}`));
    }
  });

finance.command('create')
  .description('Create a new expense')
  .argument('<amount>', 'Amount')
  .argument('<category>', 'Category')
  .option('-n, --note <note>', 'Note', '')
  .option('-d, --date <date>', 'Date (YYYY-MM-DD)', '')
  .action(async (amount, category, options) => {
    try {
      const date = options.date || new Date().toLocaleDateString('sv-SE');
      await api.post('/api/expenses', { amount: Number(amount), category, note: options.note, date });
      console.log(chalk.green('✓ Expense created successfully!'));
    } catch (e: any) {
      console.log(chalk.red(`Error: ${e.response?.data?.error || e.message}`));
    }
  });

finance.command('update')
  .description('Update an expense')
  .argument('<id>', 'Expense ID')
  .argument('<amount>', 'New amount')
  .argument('<category>', 'New category')
  .option('-n, --note <note>', 'Note', '')
  .option('-d, --date <date>', 'Date (YYYY-MM-DD)', '')
  .action(async (id, amount, category, options) => {
    try {
      const date = options.date || new Date().toLocaleDateString('sv-SE');
      await api.put(`/api/expenses/${id}`, { amount: Number(amount), category, note: options.note, date });
      console.log(chalk.green(`✓ Expense ${id} updated successfully!`));
    } catch (e: any) {
      console.log(chalk.red(`Error: ${e.response?.data?.error || e.message}`));
    }
  });

finance.command('delete')
  .description('Delete an expense')
  .argument('<id>', 'Expense ID')
  .action(async (id) => {
    try {
      await api.delete(`/api/expenses/${id}`);
      console.log(chalk.green(`✓ Expense ${id} deleted successfully!`));
    } catch (e: any) {
      console.log(chalk.red(`Error: ${e.response?.data?.error || e.message}`));
    }
  });

// --- Health Command ---
const health = program.command('health').description('Health management');

health.command('ls')
  .description('List all health records')
  .option('-l, --limit <number>', 'Limit number of entries', '30')
  .option('-o, --offset <number>', 'Offset for pagination', '0')
  .action(async (options) => {
    try {
      const res = await api.get(`/api/health?limit=${options.limit}&offset=${options.offset}`);
      const health = res.data.health;
      if (!health || health.length === 0) {
        console.log(chalk.yellow('No health records found.'));
        return;
      }
      console.log(chalk.bold('\n--- HEALTH RECORDS ---'));
      console.table(health);
    } catch (e: any) {
      console.log(chalk.red(`Error: ${e.response?.data?.error || e.message}`));
    }
  });

health.command('create')
  .description('Create a new health record')
  .argument('<sys>', 'Systolic pressure')
  .argument('<dia>', 'Diastolic pressure')
  .argument('<hr>', 'Heart rate')
  .option('-w, --weight <weight>', 'Weight (kg)', '')
  .option('-d, --date <date>', 'Date (YYYY-MM-DD)', '')
  .action(async (sys, dia, hr, options) => {
    try {
      const date = options.date || new Date().toLocaleDateString('sv-SE');
      await api.post('/api/health', { sys: Number(sys), dia: Number(dia), hr: Number(hr), weight: options.weight ? Number(options.weight) : undefined, date });
      console.log(chalk.green('✓ Health record created successfully!'));
    } catch (e: any) {
      console.log(chalk.red(`Error: ${e.response?.data?.error || e.message}`));
    }
  });

health.command('update')
  .description('Update a health record')
  .argument('<id>', 'Health record ID (date)')
  .argument('<sys>', 'Systolic pressure')
  .argument('<dia>', 'Diastolic pressure')
  .argument('<hr>', 'Heart rate')
  .option('-w, --weight <weight>', 'Weight (kg)', '')
  .option('-d, --date <date>', 'Date (YYYY-MM-DD)', '')
  .action(async (id, sys, dia, hr, options) => {
    try {
      const date = options.date || new Date().toLocaleDateString('sv-SE');
      await api.put(`/api/health/${id}`, { sys: Number(sys), dia: Number(dia), hr: Number(hr), weight: options.weight ? Number(options.weight) : undefined, date });
      console.log(chalk.green(`✓ Health record ${id} updated successfully!`));
    } catch (e: any) {
      console.log(chalk.red(`Error: ${e.response?.data?.error || e.message}`));
    }
  });

health.command('delete')
  .description('Delete a health record')
  .argument('<id>', 'Health record ID (date)')
  .action(async (id) => {
    try {
      await api.delete(`/api/health/${id}`);
      console.log(chalk.green(`✓ Health record ${id} deleted successfully!`));
    } catch (e: any) {
      console.log(chalk.red(`Error: ${e.response?.data?.error || e.message}`));
    }
  });

// --- Vault Command ---
const vault = program.command('vault').description('Vault management');

vault.command('ls')
  .description('List all vault items')
  .action(async () => {
    try {
      const res = await api.get('/api/dashboard');
      const vaultItems = res.data.data.vault;
      if (!vaultItems || vaultItems.length === 0) {
        console.log(chalk.yellow('No vault items found.'));
        return;
      }
      console.log(chalk.bold('\n--- VAULT ---'));
      console.table(vaultItems);
    } catch (e: any) {
      console.log(chalk.red(`Error: ${e.response?.data?.error || e.message}`));
    }
  });

vault.command('get')
  .description('Retrieve a secret from the vault')
  .argument('<id>', 'Vault item ID')
  .action(async (id) => {
    try {
      const res = await api.get(`/api/vault/${id}/secret`);
      console.log(res.data.secret);
    } catch (e: any) {
      console.log(chalk.red(`Error: ${e.response?.data?.error || e.message}`));
    }
  });

vault.command('export')
  .description('Export a single vault secret to a raw text file')
  .argument('<id>', 'Vault item ID to export')
  .argument('<filename>', 'Filename to export to')
  .action(async (id, filename) => {
    try {
      console.log(chalk.blue(`Exporting secret ${id} to ${filename}...`));
      const res = await api.get(`/api/vault/${id}/secret`);
      fs.writeFileSync(filename, res.data.secret, 'utf-8');
      console.log(chalk.green(`✓ Successfully exported secret to ${filename}.`));
    } catch (e: any) {
      console.log(chalk.red(`Error exporting: ${e.response?.data?.error || e.message}`));
    }
  });

vault.command('import')
  .description('Import a single vault secret from a raw text file')
  .argument('<site>', 'The site name for this secret')
  .argument('<username>', 'The username for this secret')
  .argument('<filename>', 'Filename to import the secret from')
  .action(async (site, username, filename) => {
    try {
      if (!fs.existsSync(filename)) {
        console.log(chalk.red(`File not found: ${filename}`));
        return;
      }
      const secret = fs.readFileSync(filename, 'utf-8').trim();
      
      console.log(chalk.blue(`Importing secret for ${site} (${username})...`));
      await api.post('/api/vault', { site, username, secret });
      console.log(chalk.green(`✓ Successfully imported secret for ${site}.`));
    } catch (e: any) {
      console.log(chalk.red(`Error importing: ${e.response?.data?.error || e.message}`));
    }
  });

vault.command('revoke')
  .description('Revoke (delete) a secret from the vault')
  .argument('<id>', 'Vault item ID to revoke')
  .action(async (id) => {
    try {
      console.log(chalk.blue(`Revoking secret ${id}...`));
      await api.delete(`/api/vault/${id}`);
      console.log(chalk.green(`✓ Successfully revoked secret ${id}.`));
    } catch (e: any) {
      console.log(chalk.red(`Error revoking: ${e.response?.data?.error || e.message}`));
    }
  });

vault.command('update')
  .description('Update an existing vault secret from a raw text file')
  .argument('<id>', 'Vault item ID to update')
  .argument('<site>', 'The new site name')
  .argument('<username>', 'The new username')
  .argument('<filename>', 'Filename to import the new secret from')
  .action(async (id, site, username, filename) => {
    try {
      if (!fs.existsSync(filename)) {
        console.log(chalk.red(`File not found: ${filename}`));
        return;
      }
      const secret = fs.readFileSync(filename, 'utf-8').trim();
      
      console.log(chalk.blue(`Updating secret ${id} for ${site} (${username})...`));
      await api.put(`/api/vault/${id}`, { site, username, secret });
      console.log(chalk.green(`✓ Successfully updated secret ${id}.`));
    } catch (e: any) {
      console.log(chalk.red(`Error updating: ${e.response?.data?.error || e.message}`));
    }
  });

program.parse();
