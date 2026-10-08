import type { EnvironmentProbe } from '../ports/EnvironmentProbe';
import type { Store } from '../ports/Store';
import type { Workspace } from '../ports/Workspace';
import type { EventBus } from './events';

/** Dependencias que reciben los casos de uso. Todo lo externo entra por aquí. */
export interface AppContext {
  store: Store;
  workspace: Workspace;
  environment: EnvironmentProbe;
  events: EventBus;
  now: () => string;
  newId: () => string;
}
