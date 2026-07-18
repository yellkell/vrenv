/**
 * panel.ts
 *
 * Wires the welcome panel: fills in the current environment's title/blurb and
 * hooks the button up to enter/exit the immersive XR session. Adapted from
 * the IWSDK starter template.
 */

import {
  createSystem,
  eq,
  PanelDocument,
  PanelUI,
  UIKit,
  UIKitDocument,
  VisibilityState,
} from '@iwsdk/core';

import { currentEnvironment } from './environments/registry.js';

export class PanelSystem extends createSystem({
  welcomePanel: {
    required: [PanelUI, PanelDocument],
    where: [eq(PanelUI, 'config', './ui/welcome.json')],
  },
}) {
  init() {
    this.queries.welcomePanel.subscribe('qualify', (entity) => {
      const document = PanelDocument.data.document[entity.index] as UIKitDocument;
      if (!document) {
        return;
      }

      const env = currentEnvironment();
      const title = document.getElementById('env-title') as UIKit.Text;
      title?.setProperties({ text: env.title });
      const blurb = document.getElementById('env-blurb') as UIKit.Text;
      blurb?.setProperties({ text: env.blurb });

      const xrButton = document.getElementById('xr-button') as UIKit.Text;
      xrButton.addEventListener('click', () => {
        if (this.world.visibilityState.value === VisibilityState.NonImmersive) {
          this.world.launchXR();
        } else {
          this.world.exitXR();
        }
      });
      this.world.visibilityState.subscribe((visibilityState) => {
        if (visibilityState === VisibilityState.NonImmersive) {
          xrButton.setProperties({ text: 'Enter XR' });
        } else {
          xrButton.setProperties({ text: 'Exit to Browser' });
        }
      });
    });
  }
}
