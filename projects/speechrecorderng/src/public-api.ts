/*
 * Public API Surface of speechrecorderng
 */


import {AudioDisplayControl} from "./lib/audio/ui/audio_display_control";

export {SpeechrecorderngModule} from './lib/speechrecorderng.module'
export {VERSION} from './lib/spr.module.version'
export {SPEECHRECORDER_CONFIG} from './lib/spr.config'

export {UUID} from "./lib/utils/utils"
export {Action} from "./lib/action/action";
export {ClassDescriptor,PropertyDescriptor,DataType,UiFieldHint,LocalizedMessage} from './lib/reflect/class_descriptor'

export {FitToPageComponent,FitToPageUtil} from "./lib/ui/fit_to_page_comp"
export {ReadyStateProvider} from "./lib/recorder_component"
export {MessageDialog} from "./lib/ui/message_dialog"
export {ReadyStateProvider} from "./lib/recorder_component"
export {AudioClip,Selection} from './lib/audio/persistor'
export {WavWriter} from './lib/audio/impl/wavwriter'
export {RecorderComponent} from './lib/recorder_component'
export {AudioPlayer, AudioPlayerListener, AudioPlayerEvent, EventType} from './lib/audio/playback/player'
export {AudioRecorder,AudioRecorderComponent} from './lib/speechrecorder/session/audiorecorder'
export {AudioDisplay} from './lib/audio/audio_display'
export {AudioDisplayPlayer} from './lib/audio/audio_player'
export {AudioClipUIContainer} from './lib/audio/ui/container'
export {ScrollPaneHorizontal} from './lib/audio/ui/scroll_pane_horizontal'
export {AudioDisplayScrollPane} from "./lib/audio/ui/audio_display_scroll_pane";
export {AudioContextProvider} from "./lib/audio/context";
export {AudioDisplayControl} from "./lib/audio/ui/audio_display_control"
export {LevelBar} from './lib/audio/ui/livelevel'

export {BasicService} from './lib/net/basic_service'
export {Project} from './lib/speechrecorder/project/project'
export {ProjectService} from './lib/speechrecorder/project/project.service'
export {GlobSession,Session} from './lib/speechrecorder/session/session'
export {SessionService} from './lib/speechrecorder/session/session.service'
export {GlobSpeaker,Speaker} from './lib/speechrecorder/speaker/speaker'
export {SpeakerService} from './lib/speechrecorder/speaker/speaker.service'
export {ScriptService} from './lib/speechrecorder/script/script.service'
export {Script,Section,Group,PromptItem,Mediaitem,PromptPhase,Mode} from './lib/speechrecorder/script/script'
export {RecordingService} from './lib/speechrecorder/recordings/recordings.service'
export {SprRecordingFile} from './lib/speechrecorder/recording'
export {RecordingFileService} from './lib/speechrecorder/session/recordingfile/recordingfile-service'
export {RecordingFileViewComponent} from './lib/speechrecorder/session/recordingfile/recording-file-view.component'
export {RecordingFilesComponent} from './lib/speechrecorder/session/recordingfile/recording-files.component'
export {RecordingFileUI} from './lib/speechrecorder/session/recordingfile/recording-file-u-i.component'
export {SpeechRecorderConfig,ApiType} from './lib/spr.config'
export {SpeechrecorderngComponent} from './lib/speechrecorderng.component'
