import {Inject, Injectable, InjectionToken, Optional} from "@angular/core";

/**
 * The recorder's user-facing strings, English.
 *
 * This is the fallback catalogue and the extraction source for an application's `en.json`:
 *
 *   * a consumer that provides nothing gets exactly these strings;
 *   * a consumer that translates supplies `SPEECHRECORDER_STRINGS` (see the README, "Translations"),
 *     typically from its own i18n library;
 *   * `bin/validate_i18n.mjs` fails when a locale misses one of these keys.
 *
 * Keys: `spr.<area>.<name>`. Placeholders use `{{name}}` and are documented by the string itself.
 */
export const SPR_STRINGS: Record<string, string> = {
  // Transport and status -----------------------------------------------------
  'spr.transport.start': 'Start',
  'spr.transport.stop': 'Stop',
  'spr.transport.next': 'Next',
  'spr.transport.pause': 'Pause',
  'spr.transport.forward': 'Forward',
  'spr.transport.backward': 'Backward',
  'spr.transport.nextRecording': 'Next recording',
  'spr.transport.startStopNext': 'Start / Stop / Next',
  'spr.transport.tooltip.backward': 'Backward ({{key}})',
  'spr.transport.tooltip.startStopNext': 'Start / Stop / Next ({{key}})',
  'spr.transport.tooltip.pause': 'Pause ({{key}})',
  'spr.transport.tooltip.forward': 'Forward ({{key}})',
  'spr.transport.respondent': 'Respondent display',
  'spr.transport.tooltip.respondent': 'Show the prompt stage on the second screen ({{key}})',
  'spr.transport.playPrompt': 'Prompt sound',
  'spr.transport.tooltip.playPrompt': 'Play the sound of the current prompt again ({{key}})',

  // Prompt stage --------------------------------------------------------------
  'spr.prompt.audioHint': 'Listen to the prompt.',

  // Traffic light -------------------------------------------------------------
  'spr.signal.stop': 'Stop',
  'spr.signal.getReady': 'Get ready',
  'spr.signal.recording': 'Recording',
  'spr.signal.wait': 'Wait',

  // Audio display -------------------------------------------------------------
  'spr.audio.playAll': 'Play all',
  'spr.audio.playSelection': 'Play selection',
  'spr.audio.stopPlayback': 'Stop playback',
  'spr.audio.startPlayback': 'Start playback',
  'spr.audio.autoplayOnSelect': 'Autoplay on select',
  'spr.audio.clearSelection': 'Clear selection',
  'spr.audio.play': 'Play',
  'spr.audio.zoom': 'Zoom',
  'spr.audio.selection': 'Selection',
  'spr.audio.fitToPanel': 'Fit to panel',
  'spr.audio.zoomOut': '-',
  'spr.audio.zoomIn': '+',
  'spr.audio.selected': 'Selected',
  'spr.audio.toggleDetails': 'Toggle detailed audio display',
  'spr.audio.downloadRecording': 'Download current recording',
  'spr.audio.peak': 'Peak:',
  'spr.audio.peakLevel': 'Peak level',
  'spr.audio.agc': 'AGC:',
  'spr.audio.agcTooltip': 'Auto gain control',
  'spr.audio.level': 'Peak level',
  'spr.audio.state.loading': 'Loading...',
  'spr.audio.state.rendering': 'Rendering...',
  'spr.audio.state.loadingRendering': 'Loading/Rendering...',
  'spr.audio.error.noContext': 'Could not get audio context!',
  'spr.error.unknown': 'Unknown error',
  'spr.capture.error.contextClosed': 'Error on start capture: The audio context is already closed.',
  'spr.capture.error.noScriptProcessor': 'Browser does not support audio processing (ScriptProcessor.onaudioprocess method not found)!',
  'spr.capture.error.noAudioProcessing': 'Browser does not support audio processing (neither AudioWorkletProcessor nor ScriptProcessor)!',
  'spr.capture.error.microphoneNotAllowed': 'Not allowed to use your microphone.',
  'spr.capture.advice.allowMicrophone': 'Please make sure that microphone access is allowed for this web page and reload the page.',
  'spr.capture.error.deviceRead': 'Could not read from your audio device.',
  'spr.capture.advice.checkDevice': 'Please make sure your audio device is working.',
  'spr.capture.error.handleRecordedData': 'Could not handle recorded audio data{{detail}}',
  'spr.capture.advice.recordAgain': 'Please try to record again.',
  'spr.capture.error.overconstrained': 'Overconstrained media device request error.',
  'spr.playback.error.contextClosed': 'Error: Cannot start playback. Audio context is already closed!',
  'spr.playback.error.selectionContextClosed': 'Error: Cannot start playback of selection. Audio context is already closed!',

  // Progress rail -------------------------------------------------------------
  'spr.progress.index': '#',
  'spr.progress.prompt': 'Prompt',
  'spr.progress.status': 'Status',
  'spr.progress.code': 'Code',

  // Recording list ------------------------------------------------------------
  'spr.recordings.title': 'Recording list',
  'spr.recordings.started': 'Started',
  'spr.recordings.length': 'Length',
  'spr.recordings.action': 'Action',
  'spr.recordings.select': 'Select',
  'spr.recordings.versions': 'Versions',
  'spr.recordings.navigate': 'Navigate',
  'spr.recordings.itemcode': 'Itemcode:',
  'spr.recordings.uuid': 'UUID:',
  'spr.recordings.samplerate': 'Samplerate:',
  'spr.recordings.duration': 'Duration:',
  'spr.recordings.channels': 'Channels:',
  'spr.recordings.frames': 'Frames:',
  'spr.recordings.status': 'Status:',
  'spr.recordings.peak': 'Peak:',
  'spr.recordings.tooltip.first': 'First recording file',
  'spr.recordings.tooltip.previous': 'Previous recording file',
  'spr.recordings.tooltip.next': 'Next recording file',
  'spr.recordings.tooltip.last': 'Last recording file',
  'spr.recordings.itemPosition': 'Item {{pos}} of {{count}}',
  'spr.recordings.orderedByDate': '(List ordered by date)',
  'spr.recordings.date': 'Date:',
  'spr.recordings.session': 'Session:',
  'spr.recordings.fileId': 'Recording file ID: {{id}}',
  'spr.recordings.latest': '(latest)',
  'spr.recordings.editTitle': 'Recording file editing',
  'spr.recordings.editHint': 'On export or delivery the editing selection of the recording file is cut out. If no editing selection is applied the original file is exported.',
  'spr.recordings.applySelection': 'Apply selection',
  'spr.recordings.applyCurrentSelection': 'Apply current selection as editing selection',
  'spr.recordings.cancelEditingSelection': 'Cancel out editing selection',
  'spr.recordings.selectionSaved': 'Selection edit saved successfully.',
  'spr.recordings.error.saveSelection': 'Save selection edit error',
  'spr.recordings.error.loadAudioFile': 'Could not load audio file',

  // Session and dialogs -------------------------------------------------------
  'spr.session.finishedTitle': 'Session finished',
  'spr.session.finishedBody': 'Thank you! The recording session is complete.',
  'spr.dialog.ok': 'OK',
  'spr.dialog.error': 'Error',
  'spr.dialog.recordingError': 'Recording error',
  'spr.dialog.saveSelectionError': 'Save selection edit error',
  'spr.dialog.unsupportedBrowserTitle': 'Error',
  'spr.dialog.unsupportedBrowserAdvice': 'Please use a supported browser.',
  'spr.dialog.unknownError': 'An unknown error occurred during recording.',
  'spr.dialog.retryAdvice': 'Please retry.',
  'spr.dialog.sessionSealedMsg': 'This session is sealed. Recordings cannot be added anymore.',
  'spr.dialog.sessionSealedAdvice': 'Please ask your experimenter what to do (e.g start a new session).',
  'spr.dialog.requiredAudioDeviceTitle': 'Required audio device',
  'spr.dialog.requiredAudioDeviceMsg': 'Required audio device not found',
  'spr.dialog.requiredAudioDeviceAdvice': 'Please connect a suitable audio device for this project and retry (press the browser reload button).',
  'spr.dialog.noAudioDeviceTitle': 'No audio device',
  'spr.dialog.noAudioDeviceMsg': 'No audio device found',
  'spr.dialog.noAudioDeviceAdvice': 'Please connect an audio device and retry (press the browser reload button) or try to continue anyway.',
  'spr.dialog.noAudioCaptureDeviceTitle': 'No audio capture device',
  'spr.dialog.noAudioCaptureDeviceMsg': 'No audio capture device found',
  'spr.dialog.noAudioCaptureDeviceAdvice': 'Please connect an audio capture device and retry (press the browser reload button) or try to continue anyway.',
  'spr.dialog.noAudioPlaybackDeviceTitle': 'No audio playback device',
  'spr.dialog.noAudioPlaybackDeviceMsg': 'No audio playback device found',
  'spr.dialog.noAudioPlaybackDeviceAdvice': 'Please connect an audio playback device and retry (press the browser reload button) or try to continue anyway.',
  'spr.dialog.networkAdvice': 'Please check network connection and server state.',
  'spr.dialog.networkAdviceAdmin': 'Please check network connection and server state or contact application administrator.',
  'spr.dialog.unsupportedBrowserMsg': 'Browser does not support Media/Audio API!',
  'spr.dialog.uploadFailedMsg': 'Upload failed. Recordings were not stored on the server.',
  'spr.dialog.uploadFailedAdvice': 'Please check your connection and retry.',

  // Warnings ------------------------------------------------------------------
  'spr.warning.testRecording': 'Test recording only!',
  'spr.warning.defaultDevice': 'This test uses default audio device! Regular sessions may require a particular audio device (microphone)!',

  // Status messages -----------------------------------------------------------
  'spr.status.initialize': 'Initialize...',
  'spr.status.status': 'Status',
  'spr.status.playerInitialized': 'Player initialized.',
  'spr.status.recorded': 'Recorded.',
  'spr.status.upload': 'Upload progress: {{value}}',
  'spr.status.uploadComplete': 'Upload complete',
  'spr.status.uploadPreparing': 'Preparing upload.',
  'spr.status.uploadError': 'Upload error occurred. Please check your network connection.',
  'spr.status.datasetDone': 'Audio processing and upload done. You can leave the page without data loss.',
  'spr.status.datasetPending': 'Please wait until audio processing and upload have finished. Please do not leave the page.',
  'spr.status.ready': 'Ready.',
  'spr.status.startingSession': 'Starting session...',
  'spr.status.sessionInfo': 'Received session info.',
  'spr.status.sessionSealed': 'Session sealed!',
  'spr.status.requestingAudioPermissions': 'Requesting audio permissions...',
  'spr.status.requiredAudioDeviceMissing': 'ERROR: Required audio device not available!',
  'spr.status.noAudioDeviceAvailable': 'ERROR: No audio device available!',
  'spr.status.noAudioCaptureDeviceAvailable': 'WARNING: No audio capture device available!',
  'spr.status.noAudioPlaybackDeviceAvailable': 'WARNING: No audio playback device available!',
  'spr.status.sessionClosed': 'Session closed.',
  'spr.status.fetchingScript': 'Fetching recording script...',
  'spr.status.scriptReceived': 'Received recording script.',
  'spr.status.fetchingRecordings': 'Fetching infos of recordings...',
  'spr.status.recordingsReceived': 'Received infos of recordings.',
  'spr.status.recording': 'Recording...',
  'spr.status.promptAudio': 'Playing the prompt sound...',
  'spr.status.promptAudioError': 'The prompt sound could not be played.',
  'spr.status.playerCreated': 'Player created.',
  'spr.status.audioFileLoaded': 'Audio file loaded.',
  'spr.status.playing': 'Playing...',
  'spr.status.playback': 'Playback...',
  'spr.status.playbackError': 'Playback error.',
  'spr.status.recordingError': 'ERROR: Recording.',
  'spr.status.sessionComplete': 'Session complete!',
  'spr.status.error': 'Error.',
  'spr.status.errorUpper': 'ERROR',
  'spr.status.errorPrefix': 'ERROR: {{msg}}',
  'spr.status.audioFileError': 'Error loading audio file',
  'spr.status.recordingFileLoadFailed': 'Recording file could not be loaded.',
  'spr.status.recordingFileLoadError': 'Recording file could not be loaded: {{error}}',
  'spr.status.recordingFileDecodeFailed': 'Recording file could not be decoded. Audio context unavailable.',
  'spr.status.noScript': 'No recording script is defined for this session with ID {{value}}',
  'spr.status.scriptFetchError': 'Error fetching recording script: {{value}}',
  'spr.status.uploadErrorDetail': 'Upload error: {{value}}',
  'spr.status.uploadFailed': 'Upload failed: {{value}}',
  'spr.status.uploadPartial': 'Some uploads failed. Recordings were not stored on the server.',

  // Respondent display --------------------------------------------------------
  'spr.respondent.windowTitle': 'SpeechRecorder — respondent display (session {{session}})',
  'spr.respondent.waitingTitle': 'Waiting for the recorder',
  'spr.respondent.waitingBody': 'This window shows the prompt stage of the running session. It connects as soon as the recorder window sends it.',
  'spr.respondent.unsupportedTitle': 'Respondent display not supported',
  'spr.respondent.unsupportedBody': 'This browser cannot mirror the stage into a second window. Chrome 107+, Edge 107+, Firefox 104+ and Safari 16+ can.',
  'spr.respondent.blocked': 'The browser blocked the respondent window. Allow popups for this site and try again.',
  'spr.respondent.unsupportedStatus': 'This browser cannot show the respondent display (needs Chrome 107+, Edge 107+, Firefox 104+ or Safari 16+).',

  // Capture device ------------------------------------------------------------
  'spr.capture.device': 'Recording device',
  'spr.capture.deviceTooltip': 'Microphone this session records from',
  'spr.capture.default': 'Browser default',
  'spr.capture.permissionNeeded': 'Microphone access is needed to list the devices',
  'spr.capture.grantAccess': 'List devices',
  'spr.capture.none': 'No microphone found',
  'spr.capture.missing': 'The selected device is not available',
  'spr.capture.locked': 'Fixed by the project settings',
  'spr.capture.recordingBlocked': 'Stop the recording to change the device',

  // Keyboard manual ----------------------------------------------------------
  'spr.keybinding.startStop': 'Start or stop recording',
  'spr.keybinding.pause': 'Pause recording',
  'spr.keybinding.stop': 'Stop recording and collapse the audio view',
  'spr.keybinding.play': 'Play back the recording',
  'spr.keybinding.playPrompt': 'Play the sound of the current prompt again',
  'spr.keybinding.forward': 'Go to the next prompt',
  'spr.keybinding.backward': 'Go to the previous prompt',
  'spr.keybinding.respondent': 'Open or focus the respondent display',

  // Accessibility -------------------------------------------------------------
  'spr.aria.menu': 'Menu',
  'spr.aria.nextRecording': 'Next recording',
  'spr.aria.status': 'Status',
};

/**
 * Strings supplied by the application. Keys the application does not provide fall back to
 * {@link SPR_STRINGS}, so a partial translation degrades to English instead of to a key.
 */
export const SPEECHRECORDER_STRINGS = new InjectionToken<Record<string, string>>('speechrecorder.strings');

/**
 * Looks up recorder strings. Injected into components; the application can override the
 * catalogue, and every lookup falls back to English.
 */
@Injectable()
export class SprTranslator {

  constructor(@Optional() @Inject(SPEECHRECORDER_STRINGS) private supplied?: Record<string, string>) {
  }

  /** Text for `key`, with `{{name}}` placeholders replaced from `params`. */
  t(key: string, params?: Record<string, string | number>): string {
    let text = this.supplied?.[key] ?? SPR_STRINGS[key] ?? key;
    if (params) {
      for (const [name, value] of Object.entries(params)) {
        text = text.split('{{' + name + '}}').join(String(value));
      }
    }
    return text;
  }
}
