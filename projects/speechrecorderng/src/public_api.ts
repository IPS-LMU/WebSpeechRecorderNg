/*
 * Public API Surface of speechrecorderng
 */


import {AudioDisplayControl} from "./lib/audio/ui/audio_display_control";

export {SpeechrecorderngModule} from './lib/speechrecorderng.module'
export {VERSION} from './lib/spr.module.version'
export {SPEECHRECORDER_CONFIG} from './lib/spr.config'

export {UUID} from "./lib/utils/utils"
export {Action} from "./lib/action/action";

export {MessageDialog} from "./lib/ui/message_dialog"

export {AudioClip,Selection} from './lib/audio/persistor'
export {AudioPlayer, AudioPlayerListener, AudioPlayerEvent, EventType} from './lib/audio/playback/player'
export {AudioDisplayPlayer} from './lib/audio/audio_player'
export {AudioClipUIContainer} from './lib/audio/ui/container'
export {AudioDisplayScrollPane} from "./lib/audio/ui/audio_display_scroll_pane";
export {AudioContextProvider} from "./lib/audio/context";
export {AudioDisplayControl} from "./lib/audio/ui/audio_display_control"

export {ProjectService} from './lib/speechrecorder/project/project.service'
export {Session} from './lib/speechrecorder/session/session'
export {SessionService} from './lib/speechrecorder/session/session.service'
export {ScriptService} from './lib/speechrecorder/script/script.service'
export {Script,Section,Group,PromptItem,Mediaitem,PromptPhase,Mode} from './lib/speechrecorder/script/script'
export {RecordingService} from './lib/speechrecorder/recordings/recordings.service'
export {RecordingFile} from './lib/speechrecorder/session/recordingfile/recording-file'
export {RecordingFileService} from './lib/speechrecorder/session/recordingfile/recordingfile-service'
export {RecordingFileViewComponent} from './lib/speechrecorder/session/recordingfile/recording-file-view.component'
export {RecordingFileUI} from './lib/speechrecorder/session/recordingfile/recording-file-u-i.component'
export {SpeechRecorderConfig,ApiType} from './lib/spr.config'
export {SpeechrecorderngComponent} from './lib/speechrecorderng.component'
