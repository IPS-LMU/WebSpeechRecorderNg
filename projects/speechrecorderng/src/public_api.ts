/*
 * Public API Surface of speechrecorderng
 */

export {AudioModule} from './lib/audio/audio.module'

export {AudioClip} from './lib/audio/persistor'
export {AudioPlayer, AudioPlayerListener, AudioPlayerEvent, EventType} from './lib/audio/playback/player'
export {AudioClipUIContainer} from './lib/audio/ui/container'
export {AudioDisplayScrollPane} from "./lib/audio/ui/audio_display_scroll_pane";
export {AudioContextProvider} from "./lib/audio/context";

export {SpeechrecorderngModule} from './lib/speechrecorderng.module'
export {VERSION} from './lib/spr.module.version'

export {Action} from "./lib/action/action";

export {ProjectService} from './lib/speechrecorder/project/project.service'
export {Session} from './lib/speechrecorder/session/session'
export {SessionService} from './lib/speechrecorder/session/session.service'
export {ScriptService} from './lib/speechrecorder/script/script.service'
export {Script,Section,Group,PromptItem,Mediaitem,PromptPhase,Mode} from './lib/speechrecorder/script/script'
export {RecordingService} from './lib/speechrecorder/recordings/recordings.service'
export {SpeechRecorderConfig,ApiType} from './lib/spr.config'
export {SpeechrecorderngComponent} from './lib/speechrecorderng.component'
