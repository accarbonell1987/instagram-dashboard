export { ModuleShell } from './components/module-shell';
export { ModulesSidebar } from './components/modules-sidebar';
export { ModuleNotAvailable } from './components/module-not-available';
export { useModules } from './hooks/use-modules';
export { getAccessibleModules } from './services/modules.service';
export type { AccessibleModule } from './services/modules.service';
export { resolveModuleUrl } from './lib/resolve-url';
export { HubToModuleSchema, ModuleToHubSchema } from './lib/post-message-protocol';
export type { HubToModule, ModuleToHub } from './lib/post-message-protocol';
