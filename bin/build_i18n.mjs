#!/usr/bin/env node
/**
 * Generates `src/assets/i18n/<lang>.json` from two sources:
 *
 *   * the library's `SPR_STRINGS` (English) — the recorder's own strings, section by section;
 *   * `APP_STRINGS` / `APP_STRINGS_SV` below — the shell's strings and the Swedish wording.
 *
 * Swedish values live here rather than in the generated files so a missing translation is
 * reported instead of shipping as English. Run `node bin/build_i18n.mjs` after adding a key to
 * the library, then `node bin/validate_i18n.mjs` (the validator is the guard that runs in CI).
 */
import {readFileSync, writeFileSync, mkdirSync} from 'node:fs';

const SPR_FILE = 'projects/speechrecorderng/src/lib/i18n/translate.ts';
const OUT_DIR = 'src/assets/i18n';

/** The shell's own strings. */
const APP_STRINGS = {
  'app.title': 'Cavox — Capture your voice',
  'app.shortTitle': 'Cavox',
  'app.menu': 'Menu',
  'app.menuHelp': 'Help',
  'app.language': 'Language',
  'app.languageName.en': 'English',
  'app.languageName.sv': 'Svenska',
  'app.help.lead': 'Records speech against scripted prompts.',
  'app.help.controls': 'Controls',
  'app.help.startStopNextTitle': 'Start / Stop / Next',
  'app.help.startStopNext': 'begin, end, or advance the recording.',
  'app.help.pauseTitle': 'Pause',
  'app.help.pause': 'pause the current recording.',
  'app.help.stepTitle': 'Back / Forward',
  'app.help.step': 'step through prompts.',
  'app.help.nextRecordingTitle': 'Next recording',
  'app.help.nextRecording': 'jump to the next unrecorded prompt.',
  'app.help.keyboard': 'Keyboard',
  'app.help.key': 'Key',
  'app.help.action': 'Action',
  'app.start.badge': 'Umeå University · Cavox',
  'app.start.titleLine1': 'Record speech,',
  'app.start.titleLine2': 'against scripted prompts.',
  'app.start.lead': 'Cavox runs a recording session in the browser: it presents the prompts of the loaded script, captures audio from the selected device, and keeps every recording with its metadata.',
  'app.start.openRecorder': 'Open the recorder',
  'app.session.title': 'Session',
  'app.session.lead': 'Enter the session id to load its script and recordings.',
  'app.session.id': 'Session ID',
  'app.session.idPlaceholder': 'e.g. 1234',
  'app.session.pickConfiguration': 'Choose a stored configuration to try out',
  'app.session.open': 'Open',
  'app.session.orEnterId': '…or enter a session id',
  'app.session.noConfigurations': 'No stored configurations found. Enter a session id to continue.',
};

/** Swedish wording. Terminology follows the sibling application's catalogue (inspelning, uppspelning, …). */
const SV = {
  // shell
  'app.title': 'Cavox',
  'app.shortTitle': 'Cavox',
  'app.menu': 'Meny',
  'app.menuHelp': 'Hjälp',
  'app.language': 'Språk',
  'app.languageName.en': 'English',
  'app.languageName.sv': 'Svenska',
  'app.help.lead': 'Spelar in tal mot manusbundna prompter.',
  'app.help.controls': 'Reglage',
  'app.help.startStopNextTitle': 'Start / Stopp / Nästa',
  'app.help.startStopNext': 'börja, avsluta eller gå vidare i inspelningen.',
  'app.help.pauseTitle': 'Paus',
  'app.help.pause': 'pausa den pågående inspelningen.',
  'app.help.stepTitle': 'Bakåt / Framåt',
  'app.help.step': 'stega genom prompterna.',
  'app.help.nextRecordingTitle': 'Nästa inspelning',
  'app.help.nextRecording': 'hoppa till nästa oinspelade prompt.',
  'app.help.keyboard': 'Tangentbord',
  'app.help.key': 'Tangent',
  'app.help.action': 'Åtgärd',
  'app.start.badge': 'Umeå universitet · Cavox',
  'app.start.titleLine1': 'Spela in tal,',
  'app.start.titleLine2': 'mot manusbundna prompter.',
  'app.start.lead': 'Cavox genomför en inspelningssession i webbläsaren: det visar prompterna i det inlästa manuset, tar upp ljud från vald enhet och bevarar varje inspelning med dess metadata.',
  'app.start.openRecorder': 'Öppna inspelaren',
  'app.session.title': 'Session',
  'app.session.lead': 'Ange sessions-id för att läsa in dess manus och inspelningar.',
  'app.session.id': 'Sessions-id',
  'app.session.idPlaceholder': 't.ex. 1234',
  'app.session.pickConfiguration': 'Välj en lagrad konfiguration att testa',
  'app.session.open': 'Öppna',
  'app.session.orEnterId': '…eller ange ett sessions-id',
  'app.session.noConfigurations': 'Inga lagrade konfigurationer hittades. Ange ett sessions-id för att fortsätta.',

  // library — transport
  'spr.transport.start': 'Starta',
  'spr.transport.stop': 'Stopp',
  'spr.transport.next': 'Nästa',
  'spr.transport.pause': 'Paus',
  'spr.transport.forward': 'Framåt',
  'spr.transport.backward': 'Bakåt',
  'spr.transport.nextRecording': 'Nästa inspelning',
  'spr.transport.startStopNext': 'Start / Stopp / Nästa',
  'spr.transport.tooltip.backward': 'Bakåt ({{key}})',
  'spr.transport.tooltip.startStopNext': 'Start / Stopp / Nästa ({{key}})',
  'spr.transport.tooltip.pause': 'Paus ({{key}})',
  'spr.transport.tooltip.forward': 'Framåt ({{key}})',

  'spr.transport.respondent': 'Respondentvy',
  'spr.transport.tooltip.respondent': 'Visa promptscenen på respondentens skärm ({{key}})',
  'spr.transport.playPrompt': 'Promptljud',
  'spr.transport.tooltip.playPrompt': 'Spela upp ljudet för aktuell prompt igen ({{key}})',
  // library — prompt stage
  'spr.prompt.audioHint': 'Lyssna på prompten.',
  // library — signal
  'spr.signal.stop': 'Stopp',
  'spr.signal.getReady': 'Gör dig beredd',
  'spr.signal.recording': 'Spelar in',
  'spr.signal.wait': 'Vänta',

  // library — audio
  'spr.audio.playAll': 'Spela upp allt',
  'spr.audio.playSelection': 'Spela upp markering',
  'spr.audio.stopPlayback': 'Stoppa uppspelning',
  'spr.audio.startPlayback': 'Starta uppspelning',
  'spr.audio.autoplayOnSelect': 'Spela upp automatiskt vid val',
  'spr.audio.clearSelection': 'Rensa markering',
  'spr.audio.play': 'Spela upp',
  'spr.audio.zoom': 'Zoom',
  'spr.audio.selection': 'Markering',
  'spr.audio.fitToPanel': 'Anpassa till panelen',
  'spr.audio.selected': 'Markerad',
  'spr.audio.toggleDetails': 'Visa/dölj detaljerad ljudvy',
  'spr.audio.downloadRecording': 'Ladda ner aktuell inspelning',
  'spr.audio.peak': 'Topp:',
  'spr.audio.peakLevel': 'Toppnivå',
  'spr.audio.agc': 'AGC:',
  'spr.audio.agcTooltip': 'Automatisk nivåkontroll',
  'spr.audio.level': 'Toppnivå',
  'spr.audio.state.loading': 'Laddar…',
  'spr.audio.state.rendering': 'Renderar…',
  'spr.audio.state.loadingRendering': 'Laddar/renderar…',
  'spr.audio.error.noContext': 'Kunde inte hämta ljudkontexten!',
  'spr.error.unknown': 'Okänt fel',
  'spr.capture.error.contextClosed': 'Fel vid start av inspelning: ljudkontexten är redan stängd.',
  'spr.capture.error.noScriptProcessor': 'Webbläsaren stöder inte ljudbearbetning (metoden ScriptProcessor.onaudioprocess hittades inte)!',
  'spr.capture.error.noAudioProcessing': 'Webbläsaren stöder inte ljudbearbetning (varken AudioWorkletProcessor eller ScriptProcessor)!',
  'spr.capture.error.microphoneNotAllowed': 'Mikrofonen får inte användas.',
  'spr.capture.advice.allowMicrophone': 'Kontrollera att åtkomst till mikrofonen är tillåten för webbsidan och ladda om sidan.',
  'spr.capture.error.deviceRead': 'Kunde inte läsa från ljudenheten.',
  'spr.capture.advice.checkDevice': 'Kontrollera att ljudenheten fungerar.',
  'spr.capture.error.handleRecordedData': 'Kunde inte hantera inspelad ljuddata{{detail}}',
  'spr.capture.advice.recordAgain': 'Försök spela in igen.',
  'spr.capture.error.overconstrained': 'Ljudenheten uppfyller inte de efterfrågade kraven.',
  'spr.playback.error.contextClosed': 'Fel: uppspelningen kan inte startas. Ljudkontexten är redan stängd!',
  'spr.playback.error.selectionContextClosed': 'Fel: uppspelningen av markeringen kan inte startas. Ljudkontexten är redan stängd!',

  // library — progress and recordings
  'spr.progress.index': '#',
  'spr.progress.prompt': 'Prompt',
  'spr.progress.status': 'Status',
  'spr.progress.code': 'Kod',
  'spr.recordings.title': 'Inspelningar',
  'spr.recordings.started': 'Startad',
  'spr.recordings.length': 'Längd',
  'spr.recordings.action': 'Åtgärd',
  'spr.recordings.select': 'Välj',
  'spr.recordings.versions': 'Versioner',
  'spr.recordings.navigate': 'Navigera',
  'spr.recordings.itemcode': 'Itemkod:',
  'spr.recordings.uuid': 'UUID:',
  'spr.recordings.samplerate': 'Samplingsfrekvens:',
  'spr.recordings.duration': 'Längd:',
  'spr.recordings.channels': 'Kanaler:',
  'spr.recordings.frames': 'Samples:',
  'spr.recordings.status': 'Status:',
  'spr.recordings.peak': 'Topp:',
  'spr.recordings.tooltip.first': 'Första inspelningsfilen',
  'spr.recordings.tooltip.previous': 'Föregående inspelningsfil',
  'spr.recordings.tooltip.next': 'Nästa inspelningsfil',
  'spr.recordings.tooltip.last': 'Sista inspelningsfilen',
  'spr.recordings.itemPosition': 'Post {{pos}} av {{count}}',
  'spr.recordings.orderedByDate': '(Listan är sorterad efter datum)',
  'spr.recordings.date': 'Datum:',
  'spr.recordings.session': 'Session:',
  'spr.recordings.fileId': 'Inspelningsfilens ID: {{id}}',
  'spr.recordings.latest': '(senaste)',
  'spr.recordings.editTitle': 'Redigering av inspelningsfil',
  'spr.recordings.editHint': 'Vid export eller leverans klipps den redigerade markeringen av inspelningsfilen bort. Om ingen redigering är tillämpad exporteras originalfilen.',
  'spr.recordings.applySelection': 'Tillämpa markering',
  'spr.recordings.applyCurrentSelection': 'Tillämpa aktuell markering som redigering',
  'spr.recordings.cancelEditingSelection': 'Ta bort redigering',
  'spr.recordings.selectionSaved': 'Redigeringen av markeringen sparades.',
  'spr.recordings.error.saveSelection': 'Kunde inte spara redigeringen av markeringen',
  'spr.recordings.error.loadAudioFile': 'Kunde inte läsa in ljudfilen',

  // library — session and dialogs
  'spr.session.finishedTitle': 'Sessionen är klar',
  'spr.session.finishedBody': 'Tack! Inspelningssessionen är slutförd.',
  'spr.session.exportRecordings': 'Exportera inspelningarna',
  'spr.session.exportInProgress': 'Exporterar inspelningar…',
  'spr.session.exportDone': 'Inspelningarna har exporterats.',
  'spr.session.exportError': 'Inspelningarna kunde inte exporteras.',
  'spr.session.exportNone': 'Det finns inga inspelningar att exportera.',
  'spr.dialog.ok': 'OK',
  'spr.dialog.error': 'Fel',
  'spr.dialog.recordingError': 'Inspelningsfel',
  'spr.dialog.saveSelectionError': 'Kunde inte spara ändringen av markeringen',
  'spr.dialog.unsupportedBrowserTitle': 'Fel',
  'spr.dialog.unsupportedBrowserAdvice': 'Använd en webbläsare som stöds.',
  'spr.dialog.unknownError': 'Ett okänt fel uppstod vid inspelningen.',
  'spr.dialog.retryAdvice': 'Försök igen.',
  'spr.dialog.sessionSealedMsg': 'Sessionen är låst. Fler inspelningar kan inte läggas till.',
  'spr.dialog.sessionSealedAdvice': 'Fråga din försöksledare vad du ska göra (till exempel starta en ny session).',
  'spr.dialog.headphonesTitle': 'Hörlurar krävs',
  'spr.dialog.headphonesMsg': 'Det här avsnittet spelar upp ljud. Sätt på hörlurar innan tagningen startar, annars fångar inspelningen högtalaren.',
  'spr.dialog.requiredAudioDeviceTitle': 'Obligatorisk ljudenhet',
  'spr.dialog.requiredAudioDeviceMsg': 'Den obligatoriska ljudenheten hittades inte',
  'spr.dialog.requiredAudioDeviceAdvice': 'Anslut en lämplig ljudenhet för projektet och försök igen (ladda om sidan i webbläsaren).',
  'spr.dialog.noAudioDeviceTitle': 'Ingen ljudenhet',
  'spr.dialog.noAudioDeviceMsg': 'Ingen ljudenhet hittades',
  'spr.dialog.noAudioDeviceAdvice': 'Anslut en ljudenhet och försök igen (ladda om sidan i webbläsaren) eller försök att fortsätta ändå.',
  'spr.dialog.noAudioCaptureDeviceTitle': 'Ingen ljudingång',
  'spr.dialog.noAudioCaptureDeviceMsg': 'Ingen ljudingång hittades',
  'spr.dialog.noAudioCaptureDeviceAdvice': 'Anslut en ljudingång och försök igen (ladda om sidan i webbläsaren) eller försök att fortsätta ändå.',
  'spr.dialog.noAudioPlaybackDeviceTitle': 'Ingen ljudutgång',
  'spr.dialog.noAudioPlaybackDeviceMsg': 'Ingen ljudutgång hittades',
  'spr.dialog.noAudioPlaybackDeviceAdvice': 'Anslut en ljudutgång och försök igen (ladda om sidan i webbläsaren) eller försök att fortsätta ändå.',
  'spr.dialog.networkAdvice': 'Kontrollera nätverksanslutningen och serverns status.',
  'spr.dialog.networkAdviceAdmin': 'Kontrollera nätverksanslutningen och serverns status eller kontakta systemadministratören.',
  'spr.dialog.unsupportedBrowserMsg': 'Webbläsaren stöder inte Media-/Audio-API:t!',
  'spr.dialog.uploadFailedMsg': 'Uppladdningen misslyckades. Inspelningarna sparades inte på servern.',
  'spr.dialog.uploadFailedAdvice': 'Kontrollera anslutningen och försök igen.',

  // library — warnings and status
  'spr.warning.testRecording': 'Endast testinspelning!',
  'spr.warning.defaultDevice': 'Testet använder standardljudenheten! Ordinarie sessioner kan kräva en särskild ljudenhet (mikrofon)!',
  'spr.status.initialize': 'Initierar…',
  'spr.status.status': 'Status',
  'spr.status.playerInitialized': 'Uppspelaren är initierad.',
  'spr.status.recorded': 'Inspelat.',
  'spr.status.upload': 'Uppladdning: {{value}}',
  'spr.status.uploadComplete': 'Uppladdningen är klar',
  'spr.status.uploadPreparing': 'Förbereder uppladdning.',
  'spr.status.uploadError': 'Uppladdningen misslyckades. Kontrollera nätverksanslutningen.',
  'spr.status.datasetDone': 'Ljudbearbetning och uppladdning är klara. Du kan lämna sidan utan att data går förlorad.',
  'spr.status.datasetPending': 'Vänta tills ljudbearbetningen och uppladdningen är klara. Lämna inte sidan.',
  'spr.status.ready': 'Redo.',
  'spr.status.startingSession': 'Startar sessionen…',
  'spr.status.sessionInfo': 'Sessionsinformationen har tagits emot.',
  'spr.status.sessionSealed': 'Sessionen är låst!',
  'spr.status.requestingAudioPermissions': 'Begär åtkomst till ljudenheten…',
  'spr.status.requiredAudioDeviceMissing': 'FEL: Den obligatoriska ljudenheten är inte tillgänglig!',
  'spr.status.noAudioDeviceAvailable': 'FEL: Ingen ljudenhet är tillgänglig!',
  'spr.status.noAudioCaptureDeviceAvailable': 'VARNING: Ingen ljudingång är tillgänglig!',
  'spr.status.noAudioPlaybackDeviceAvailable': 'VARNING: Ingen ljudutgång är tillgänglig!',
  'spr.status.sessionClosed': 'Sessionen är stängd.',
  'spr.status.fetchingScript': 'Hämtar inspelningsmanuset…',
  'spr.status.scriptReceived': 'Inspelningsmanuset har tagits emot.',
  'spr.status.fetchingRecordings': 'Hämtar information om inspelningarna…',
  'spr.status.recordingsReceived': 'Information om inspelningarna har tagits emot.',
  'spr.status.recording': 'Spelar in…',
  'spr.status.promptAudio': 'Spelar upp promptljudet…',
  'spr.status.promptAudioError': 'Promptljudet kunde inte spelas upp.',
  'spr.status.promptAudioOffline': 'Promptljudet är inte tillgängligt offline.',
  'spr.status.playerCreated': 'Uppspelaren är skapad.',
  'spr.status.audioFileLoaded': 'Ljudfilen är inläst.',
  'spr.status.playing': 'Spelar upp…',
  'spr.status.playback': 'Uppspelning…',
  'spr.status.playbackError': 'Uppspelningsfel.',
  'spr.status.recordingError': 'FEL: Inspelning.',
  'spr.status.sessionComplete': 'Sessionen är klar!',
  'spr.status.error': 'Fel.',
  'spr.status.errorUpper': 'FEL',
  'spr.status.errorPrefix': 'FEL: {{msg}}',
  'spr.status.audioFileError': 'Fel vid inläsning av ljudfil',
  'spr.status.recordingFileLoadFailed': 'Inspelningsfilen kunde inte läsas in.',
  'spr.status.recordingFileLoadError': 'Inspelningsfilen kunde inte läsas in: {{error}}',
  'spr.status.recordingFileDecodeFailed': 'Inspelningsfilen kunde inte avkodas. Ljudkontexten är inte tillgänglig.',
  'spr.status.noScript': 'Inget inspelningsmanus är definierat för sessionen med ID {{value}}',
  'spr.status.scriptFetchError': 'Kunde inte hämta inspelningsmanuset: {{value}}',
  'spr.status.scriptPrefillError': 'Fel vid upplösning av manusets förifyllnadskällor: {{value}}',
  'spr.status.uploadErrorDetail': 'Uppladdningsfel: {{value}}',
  'spr.status.uploadFailed': 'Uppladdningen misslyckades: {{value}}',
  'spr.status.uploadPartial': 'Vissa uppladdningar misslyckades. Inspelningarna sparades inte på servern.',

  // library — respondent display
  'spr.respondent.windowTitle': 'Cavox – respondentvy (session {{session}})',
  'spr.respondent.waitingTitle': 'Väntar på inspelaren',
  'spr.respondent.waitingBody': 'Det här fönstret visar promptscenen för den pågående sessionen. Det ansluter så snart inspelarfönstret skickar den.',
  'spr.respondent.unsupportedTitle': 'Respondentvyn stöds inte',
  'spr.respondent.unsupportedBody': 'Den här webbläsaren kan inte spegla scenen till ett andra fönster. Chrome 107+, Edge 107+, Firefox 104+ och Safari 16+ kan.',
  'spr.respondent.blocked': 'Webbläsaren blockerade respondentfönstret. Tillåt popup-fönster för webbplatsen och försök igen.',
  'spr.respondent.unsupportedStatus': 'Den här webbläsaren kan inte visa respondentvyn (kräver Chrome 107+, Edge 107+, Firefox 104+ eller Safari 16+).',

  // library — capture device
  'spr.capture.device': 'Inspelningsenhet',
  'spr.capture.deviceTooltip': 'Mikrofonen som sessionen spelar in från',
  'spr.capture.default': 'Webbläsarens standard',
  'spr.capture.permissionNeeded': 'Mikrofonåtkomst krävs för att visa enheterna',
  'spr.capture.grantAccess': 'Visa enheter',
  'spr.capture.none': 'Ingen mikrofon hittades',
  'spr.capture.missing': 'Vald enhet är inte tillgänglig',
  'spr.capture.locked': 'Fastställd av projektinställningarna',
  'spr.capture.recordingBlocked': 'Stoppa inspelningen för att byta enhet',

  // library — keyboard manual
  'spr.keybinding.startStop': 'Starta eller stoppa inspelningen',
  'spr.keybinding.pause': 'Pausa inspelningen',
  'spr.keybinding.stop': 'Stoppa inspelningen och fäll in ljudvyn',
  'spr.keybinding.play': 'Spela upp inspelningen',
  'spr.keybinding.playPrompt': 'Spela upp ljudet för aktuell prompt igen',
  'spr.keybinding.forward': 'Gå till nästa prompt',
  'spr.keybinding.backward': 'Gå till föregående prompt',
  'spr.keybinding.respondent': 'Öppna eller fokusera respondentfönstret',

  // library — accessibility
  'spr.aria.menu': 'Meny',
  'spr.aria.nextRecording': 'Nästa inspelning',
  'spr.aria.status': 'Status',
};

const libraryStrings = readFileSync(SPR_FILE, 'utf8');
const libraryKeys = Array.from(
  libraryStrings.matchAll(/^\s*'([a-z0-9.]+)':\s*'((?:[^'\\]|\\.)*)',/gim),
  m => [m[1], m[2].replace(/\\'/g, "'")],
);
if (!libraryKeys.length) {
  console.error(`Could not read SPR_STRINGS from ${SPR_FILE}`);
  process.exit(2);
}

const english = {...APP_STRINGS, ...Object.fromEntries(libraryKeys)};
// Values without letters ('-', '+', '#') are symbols: identical in every locale.
const isSymbol = (value) => !/[\p{L}]/u.test(value);
const missingSwedish = Object.keys(english).filter(key => !(key in SV) && !isSymbol(english[key]));
if (missingSwedish.length) {
  console.error(`Missing Swedish for ${missingSwedish.length} key(s):`);
  missingSwedish.forEach(key => console.error(`  ${key} = ${JSON.stringify(english[key])}`));
  process.exit(1);
}

// A key must not be both a leaf and a namespace: `app.help` and `app.help.lead` cannot coexist.
const collisions = Object.keys(english).filter(key => Object.keys(english).some(other => other !== key && other.startsWith(key + '.')));
if (collisions.length) {
  console.error('Keys that are both a value and a namespace: ' + collisions.join(', '));
  process.exit(1);
}

const nest = (flat) => {
  const out = {};
  for (const [key, value] of Object.entries(flat)) {
    const parts = key.split('.');
    let node = out;
    for (const part of parts.slice(0, -1)) {
      node = node[part] ??= {};
    }
    node[parts[parts.length - 1]] = value;
  }
  return out;
};

mkdirSync(OUT_DIR, {recursive: true});
const swedish = Object.fromEntries(Object.keys(english).map(key => [key, SV[key] ?? english[key]]));
for (const [locale, flat] of [['en', english], ['sv', swedish]]) {
  writeFileSync(`${OUT_DIR}/${locale}.json`, JSON.stringify(nest(flat), null, 2) + '\n');
  console.log(`${OUT_DIR}/${locale}.json: ${Object.keys(flat).length} keys`);
}
