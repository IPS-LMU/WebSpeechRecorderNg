/*
 * Public API Surface of speechrecorderng
 */


import {AudioDisplayControl} from "./lib/audio/ui/audio_display_control";

export {SpeechrecorderngModule} from './lib/speechrecorderng.module'
export {VERSION} from './lib/spr.module.version'
export {SPEECHRECORDER_ENVIRONMENT_DEFAULTS} from './lib/environment/environment.defaults'
export {SPEECHRECORDER_CONFIG} from './lib/spr.config'

export {UUID} from "./lib/utils/utils"
export {SprLogger, SprLogLevel} from "./lib/utils/logger"
export {Action} from "./lib/action/action";

export {ResponsiveComponent} from './lib/ui/responsive_component'
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

export {ProjectService} from './lib/speechrecorder/project/project.service'
export {Session} from './lib/speechrecorder/session/session'
export {SessionService} from './lib/speechrecorder/session/session.service'
export {ScriptService} from './lib/speechrecorder/script/script.service'
export {Script,Section,Group,PromptItem,Mediaitem,PromptDoc,PromptDocUtil,MediaitemUtil,PromptitemUtil} from './lib/speechrecorder/script/script'
export type {PromptPhase,Mode,Order,Playback,PlaybackWhen,PrefillBankSource,Bank,BankItem,DrawFilter,DrawFixedBy,BankSource,VirtualViewBox,Recinstructions,MediaitemKind} from './lib/speechrecorder/script/script'
export {ScriptPrefillService} from './lib/speechrecorder/script/prefill.service'
export {ScriptPrefillUtil} from './lib/speechrecorder/script/prefill'
export {DEFAULT_POST_REC_DELAY, DEFAULT_PRE_REC_DELAY, ITEM_PHASES, effectiveTiming, nextPhase, playbackPlan, playbackStart, playbackTiming, promptVisibleAt, replayAllowed, sectionNeedsHeadphones} from './lib/speechrecorder/script/phases'
export type {EffectiveTiming, ItemPhase, PlaybackPlan, PlaybackStart, PlaybackTiming} from './lib/speechrecorder/script/phases'
export {FEATURE_VERSIONS, compareVersions, featuresUsed, minRecorderVersionFor, supportsRecorderVersion} from './lib/speechrecorder/script/feature-versions'
export type {PromptItemPrefill} from './lib/speechrecorder/script/script'
export type {PrefillChoice, PrefillChoices, PrefillSource, PrefillSourceList} from './lib/speechrecorder/script/prefill'
export {RecordingService} from './lib/speechrecorder/recordings/recordings.service'
export {SprRecordingFile} from './lib/speechrecorder/recording'
export {RecordingFileService} from './lib/speechrecorder/session/recordingfile/recordingfile-service'
export {RecordingFileViewComponent} from './lib/speechrecorder/session/recordingfile/recording-file-view.component'
export {RecordingFileUI} from './lib/speechrecorder/session/recordingfile/recording-file-u-i.component'
export {SpeechRecorderConfig,ApiType} from './lib/spr.config'
export type {SprLogo, SpeechRecorderBranding} from './lib/spr.config'
export {Logos} from './lib/ui/logos'

/* Translations: English is built in, the application supplies the rest. */
export {SPR_STRINGS, SPEECHRECORDER_STRINGS, SprTranslator} from './lib/i18n/translate'
export {UploadConfig,UploadError,UploaderStatus,UploaderStatusChangeEvent} from './lib/net/uploader'
export {SpeechrecorderngComponent} from './lib/speechrecorderng.component'
export {KEY, KEY_BINDINGS, KeyBinding, keyLabel} from './lib/speechrecorder/session/keybindings'

/* Theming: semantic tokens shared by the CSS and the canvas painters.
   See `theme.scss` for the stylesheet entry point and the README for the token list. */
export {
  SCHEME_ATTRIBUTE,
  SPR_PALETTE,
  SPR_SPECTRUM_RAMP,
  buildSpectrumLut,
  invalidateSprTokens,
  sprToken,
} from './lib/theme/theme'
export type {SprTokenName} from './lib/theme/theme'
