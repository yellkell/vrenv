/**
 * registry.ts
 *
 * The catalog of ready-made IWSDK environments in this project. Pick one with
 * the `?env=` query parameter (e.g. `?env=cove`); the pavilion is the default.
 * Each entry carries its own spawn point and welcome-panel placement/copy so
 * `index.ts` and `panel.ts` stay environment-agnostic.
 */

import type { World } from '@iwsdk/core';

import { buildCove } from './cove.js';
import { buildFactory } from '../factory.js';
import { buildPavilion } from './pavilion.js';

export interface EnvironmentDef {
  id: string;
  title: string;
  blurb: string;
  /** Initial desktop camera position (XR spawn is driven by locomotion). */
  spawn: [number, number, number];
  panelPosition: [number, number, number];
  build: (world: World) => void;
}

export const ENVIRONMENTS: Record<string, EnvironmentDef> = {
  pavilion: {
    id: 'pavilion',
    title: 'Lakeside Sports Pavilion',
    blurb:
      'A sun-drenched glass sports hall in a toon summer valley. Step down ' +
      'into the sunken court, grab a paddle and rally over the net, or ' +
      'just watch the clouds drift past the arched roof.',
    spawn: [0, 1.6, 12.5],
    panelPosition: [0, 2.1, 9.2],
    build: buildPavilion,
  },
  cove: {
    id: 'cove',
    title: 'Lantern Cove',
    blurb:
      'Golden hour on a meadow island: still water, drifting hot-air ' +
      'balloons, a waterfall across the lake, and lanterns waking up as the ' +
      'sun sinks. Walk the dock out toward the sunset glitter path.',
    spawn: [0, 1.6, 8],
    panelPosition: [2.6, 1.9, 4.2],
    build: buildCove,
  },
  factory: {
    id: 'factory',
    title: 'Papercraft Factory Floor',
    blurb:
      'A big dilapidated industrial hall: steel catwalks, dead conveyors, ' +
      'sliding bay doors, and a wide-open work floor ready for your game.',
    spawn: [0, 1.6, 15],
    panelPosition: [0, 2.2, 11],
    build: buildFactory,
  },
};

const DEFAULT_ID = 'pavilion';

/** The environment selected via `?env=…` (falls back to the pavilion). */
export function currentEnvironment(): EnvironmentDef {
  const id = new URLSearchParams(window.location.search).get('env') ?? DEFAULT_ID;
  return ENVIRONMENTS[id] ?? ENVIRONMENTS[DEFAULT_ID];
}
