import {Routes} from "@angular/router";
import {SessionsComponent} from "./session/sessions";
import {AudioDisplayPlayer} from "../../projects/speechrecorderng/src/lib/audio/audio_player";
import {StartComponent} from "./start/start";
import {SPR_ROUTES} from "../../projects/speechrecorderng/src/lib/speechrecorderng.module";

export const appRoutes=SPR_ROUTES.concat([

  { path: 'session',
    component: SessionsComponent
  },
  { path: 'test',
    redirectTo: 'session/',
    pathMatch: 'full'
  },
  { path: 'audio_display', component: AudioDisplayPlayer
  },
  { path: '**', component: StartComponent  },

]);

