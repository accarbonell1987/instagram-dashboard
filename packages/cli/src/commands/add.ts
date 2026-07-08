/**
 * 'core add' Command
 * Adds functionality to existing applications
 * @core/cli
 */

import { Command } from 'commander';

import { createAddComponentCommand } from './add/component.js';
import { createAddPageCommand } from './add/page.js';
import { createAddRouteCommand } from './add/route.js';

/**
 * Create the 'add' command with subcommands
 */
export function createAddCommand(): Command {
  const addCmd = new Command('add')
    .description('Add functionality to existing applications')
    .addCommand(createAddRouteCommand())
    .addCommand(createAddPageCommand())
    .addCommand(createAddComponentCommand());

  return addCmd;
}
