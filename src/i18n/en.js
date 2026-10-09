// English string table (keys are the Chinese source strings).
import { EN_WORLD } from './en-world.js';
import { EN_NPCS } from './en-npcs.js';
import { EN_UI } from './en-ui.js';

export const EN = { ...EN_WORLD, ...EN_NPCS, ...EN_UI };
