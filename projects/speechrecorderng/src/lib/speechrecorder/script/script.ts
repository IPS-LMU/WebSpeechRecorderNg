
export type Mode = "MANUAL" | "AUTOPROGRESS" | "AUTORECORDING";
export type PromptPhase = "IDLE" | "PRERECORDING" | "PRERECORDINGONLY" | "RECORDING";

export type Order = 'SEQUENTIAL' | 'RANDOM' | 'RANDOMIZED';

export type Decoration ='underline'
export type Style ='italic' | 'normal'
export type FontWeight='normal' | 'bold'
export type BlockType='p';
export type TextType='text' | 'font';

export interface Recinstructions{
  recinstructions:string;
}

export interface Text {
  type: TextType,
  color? : string,
  decoration? : Decoration,
  size?: string,
  weight?: FontWeight,
  style?: Style,
  text : string | Text;
}

export interface Block {
  type: BlockType,
  texts: Array<Text>
}
export interface Body{
  blocks?: Array<Block>,
}

export interface PromptDoc{
  body?: Body
}

export interface Mediaitem {
  text?: string,
  src?: string,
  promptDoc?: PromptDoc,
  mimetype?:string,
  defaultVirtualViewBox?:VirtualViewBox,
  alt?:string,
  /**
   * Start this media item (only audio is played) when its prompt is presented. A script that
   * sets `false` leaves the sound to the operator's play action. Default: true.
   */
  autoplay?: boolean,
  /**
   * Let the operator play this sound again — with the play control of the transport bar and the
   * `R` key, before a take, during one, or while a take is still waiting for the sound.
   *
   * Only meaningful for audio; `false` is what a test section wants: the stimulus is played once
   * when the take starts and cannot be repeated. Default: true.
   */
  replay?: boolean
}

/**
 * How a media item is presented. The `mimetype` decides: `text/plain` is plain text,
 * `text/x-prompt` is a decorated prompt document, `image/*` an image and `audio/*` a sound
 * that is played as the prompt. Anything else is not rendered (and logged by the stage).
 */
export type MediaitemKind = 'text' | 'prompt' | 'image' | 'audio' | 'unsupported';

/**
 * Fills a prompt item from an external source when the script is loaded.
 *
 * The item the spec is declared on is a placeholder: it is replaced by one generated
 * prompt item per entry of the chosen list. The placeholder's own recording properties
 * (`prerecdelay`, `recduration`, `postrecdelay`, ...) carry over to every generated item.
 *
 * `select: "random"` draws one list of the source per session; the drawn list is kept in
 * the session record (`Session.prefills`) so a later reload reproduces the same items.
 */
/** Where the prompt audio plays (D-V = C: the item's audio mediaitem is the source). */
export type PlaybackWhen = 'WITH_PROMPT' | 'BEFORE' | 'PRERECORDING' | 'DURING' | 'ONDEMAND';

/**
 * Optional placement modifier for the item's audio mediaitem. Absent: the shipped
 * `Mediaitem.autoplay`/`replay` behaviour applies. Present: it takes over placement, repeats and
 * the replay rule, and the mediaitem flags are ignored (a check flags an item that sets both).
 */
export interface Playback {
  /** Default `WITH_PROMPT`, i.e. today's autoplay. */
  when?: PlaybackWhen;
  /** Times the clip is played back to back. Default 1. */
  repeats?: number;
  /** Silence between repeats, ms. Default 500. */
  gap?: number;
  /** Overrides `Mediaitem.replay` when present. */
  replayable?: boolean;
  /** Cap on replays; unset means no cap. */
  maxReplays?: number;
  /** Ask the speaker to put on headphones before the section starts. */
  headphones?: boolean;
  /** Advisory clip length in ms; the server measures it on upload. */
  durationMs?: number;
}

export type DrawFixedBy = 'SESSION' | 'SPEAKER' | 'SCRIPT';
export type BankSource = 'PROJECT' | 'BUILTIN';

/** Which bank items a bank source may draw; the semantics are frozen (D-O). */
export interface DrawFilter {
  category?: string;
  /** Inclusive word-count range, e.g. [6, 12]. */
  words?: [number, number];
  /** true = only items with a model recording, false = only items without, absent = either. */
  hasAudio?: boolean;
  /** Case-insensitive substring over the item text. */
  q?: string;
  /** All listed tags must be present (AND). */
  tags?: Array<string>;
}

/**
 * The bank source of a randomised prefill (D-W). It is resolved **server-side at session
 * creation**, because the draw needs project state (what the speaker already recorded) and must be
 * reproducible across reloads. A placeholder item carries exactly one of this or a list `source`.
 */
export interface PrefillBankSource {
  /** Bank to draw from; `bankSource` says whether it belongs to the project or ships with the app. */
  bank: string;
  bankSource: BankSource;
  filter?: DrawFilter;
  /** Pins the filter semantics; absent means version 1. */
  filterVersion?: number;
  /** How many items are drawn, 1…999. */
  count: number;
  /** Default RANDOM: shuffled once, at resolution. */
  order?: Order;
  /** Default SESSION. */
  fixedBy?: DrawFixedBy;
  /** Skip items this speaker already recorded; the draw refills from them when it runs short. */
  skipRecordedBySpeaker?: boolean;
  /** Generated itemcodes are `${itemcodePrefix}001`, zero-padded to three digits. */
  itemcodePrefix: string;
  /** Play each drawn item's own model recording. */
  playBankAudio?: boolean;
  /** Playback settings applied to every drawn item when `playBankAudio` is set. */
  playback?: Playback;
  /** Timing applied to every drawn item. */
  itemDefaults?: Pick<PromptItem, 'prerecdelay' | 'recduration' | 'postrecdelay' | 'recinstructions'>;
}

/** An item bank, as the editor's bank browser sees it. */
export interface Bank {
  bankId: string;
  title: string;
  source: BankSource;
  /** Set for source PROJECT. */
  project?: string;
  itemCount?: number;
  /** Application release a BUILTIN bank shipped with, e.g. "3.12". */
  shippedWith?: string;
  updated?: string;
}

/** One bank item. Exactly one of text, promptDoc or src describes what is shown. */
export interface BankItem {
  bankItemId: string;
  text?: string;
  promptDoc?: PromptDoc;
  src?: string;
  mimetype?: string;
  alt?: string;
  /** Model recording, played when the bank source sets `playBankAudio`. */
  audioSrc?: string;
  audioMimetype?: string;
  category?: string;
  words?: number;
  tags?: Array<string>;
}

export interface PromptItemPrefill {
  /**
   * Resource id of the source, fetched from the script endpoint (`{apiEndPoint}script/{source}`)
   * — the same location the script itself was loaded from, so the source travels with the
   * script bank.
   */
  /** List source id — exactly one of `source` and `bank` is set. */
  source?: string;
  /** Bank source, resolved server-side at session creation (D-W). */
  bank?: PrefillBankSource;
  /** How the list is drawn. Only `"random"` is supported. */
  select?: 'random';
  /**
   * Item code of each generated item; `{n}` is replaced by the 1-based position of the entry
   * in the list (e.g. `"6.{n}"` yields `6.1` … `6.N`).
   */
  itemcodeFormat?: string;
  /** Operator instruction of every generated item. Not set: the placeholder's instruction. */
  recinstructions?: string;
  /**
   * Media items of every generated item; `{entry}` in `text`, `src` or `alt` is replaced by
   * the list entry (e.g. `{"mimetype": "text/plain", "text": "{entry}"}` shows the word).
   */
  mediaitems?: Array<Mediaitem>;
}

export interface PromptItem {
  type?:string;
  itemcode?: string,
  prerecdelay?: number,
  prerecording?: number,
  recduration?: number,
  duration?:number,
  postrecording?: number,
  postrecdelay?: number,
  recinstructions?: Recinstructions,
  mediaitems: Array<Mediaitem>,
  prefill?: PromptItemPrefill,
  /** Set by the server on an item drawn from a bank; traces it to its bank item. */
  bankItemId?: string,
  /** Optional placement modifier for the item's audio mediaitem (D-V = C). */
  playback?: Playback
}

export interface Group {
  order?:Order;
  promptItems: Array<PromptItem>;
  _shuffledPromptItems: Array<PromptItem>;
}

export interface Section {
  /** Human label, as the preview's order list shows it; unnamed sections fall back to a position (D-I). */
  name?: string;
  mode: Mode;
  promptphase: PromptPhase;
  order?: Order;
  training: boolean;
  groups: Array<Group>;
  _shuffledGroups: Array<Group>;
}

export interface VirtualViewBox{
  height:number;
}

export interface Script {
  /** Set by the editor; the recorder ignores it beyond the list view (D-I). */
  type?: string;
  scriptId?: string | number;
  /** Human label for the library list. */
  name?: string;
  /** Lowest recorder version that understands every feature used here, e.g. "3.12". */
  minRecorderVersion?: string;
  virtualViewBox?:VirtualViewBox;
  sections: Array<Section>;
}

export class PromptDocUtil{

  static toPlainTextString(promptDoc:PromptDoc):string{
    let pt="";
    let b=promptDoc.body;
    if(b!=null) {
      let blks=b.blocks
      if(blks) {
        for(let bli=0;bli<blks.length;bli++){
          let blk=blks[bli];
          let txts=blk.texts;
          for(let ti=0;ti<txts.length;ti++){
              let txtEl=txts[ti];
              let txt =txtEl.text;
            if( txtEl.type === 'font'){
              if(typeof txt === 'string'){
                pt = pt.concat(<string>txt);
              }else{
                let subTxtEl=<Text>txt;
                let subTxt=subTxtEl.text;
                if(typeof subTxt === 'string') {
                  pt=pt.concat(subTxt);
                }
              }
            }else if(typeof txt === 'string'){
              pt = pt.concat(<string>txt);
            }
          }
        }
      }
    }
    return pt;
  }
}

export class MediaitemUtil {
  /** Mimetype of a media item, normalised; a missing one means plain text (the script default). */
  static mimeType(mediaitem: Mediaitem|null|undefined): string {
    const mimetype = mediaitem?.mimetype;
    return (mimetype === null || mimetype === undefined || mimetype.trim() === '') ? 'text/plain' : mimetype.trim();
  }

  static kind(mediaitem: Mediaitem|null|undefined): MediaitemKind {
    if (mediaitem === null || mediaitem === undefined) {
      return 'unsupported';
    }
    const mimetype = MediaitemUtil.mimeType(mediaitem);
    if (mimetype === 'text/plain') {
      return 'text';
    }
    if (mimetype === 'text/x-prompt') {
      return 'prompt';
    }
    if (mimetype.startsWith('image')) {
      return 'image';
    }
    if (mimetype.startsWith('audio')) {
      return 'audio';
    }
    return 'unsupported';
  }

  /** An audio media item that is played when its prompt is presented (unless `autoplay: false`). */
  static isAutoplayedAudio(mediaitem: Mediaitem|null|undefined): boolean {
    return MediaitemUtil.kind(mediaitem) === 'audio' && mediaitem?.autoplay !== false;
  }

  /** An audio media item the operator may play again (unless the script sets `replay: false`). */
  static isReplayableAudio(mediaitem: Mediaitem|null|undefined): boolean {
    return MediaitemUtil.kind(mediaitem) === 'audio' && mediaitem?.replay !== false;
  }

  static toPlainTextString(mediaitem: Mediaitem): string|null {

    let txt = mediaitem.text;
    let pd = mediaitem.promptDoc;
    if (txt == null) {
      let pt = null;
      if (pd != null) {
        pt = PromptDocUtil.toPlainTextString(pd);
      }
      return pt;
    } else {
      return txt;
    }
  }

  static description(mi: Mediaitem): string {
    let description = "";

    if (mi.alt != null) {
      description = description.concat(mi.alt)
    } else {
      let src = mi.src;
      let mimeType = MediaitemUtil.mimeType(mi);
      if (mimeType.startsWith("image")) {
        description = description.concat("IMAGE: ");
      } else if (mimeType.startsWith("audio")) {
        description = description.concat("AUDIO: ");
      } else if (mimeType.startsWith("video")) {
        description = description.concat("VIDEO: ");
      }
      let promptText = MediaitemUtil.toPlainTextString(mi);
      if (promptText != null) {
        description = description.concat(promptText);
      } else if (src != null) {
        let srcPn;
        try {
          let srcUrl = new URL(src);
          srcPn=srcUrl.pathname;
        }catch{
          srcPn=src;
        }

        // Get filename without extension
        let srcFnM=srcPn.match(/([^\/]*)$/);
        if(srcFnM && srcFnM.length==2){
          let srcFn=srcFnM[1];
          let srcFnNm=srcFn.replace(/[\.][^\.]*/,'');
          description = description.concat(srcFnNm);
        }
      }
    }
    return description;
  }
}

export class PromptitemUtil {
  /** The audio media item a take starts with, or `null` (`autoplay: false` leaves it to the operator). */
  static autoplayAudioitem(promptItem: PromptItem|null|undefined): Mediaitem|null {
    return PromptitemUtil.firstOfKind(promptItem, (mediaitem) => MediaitemUtil.isAutoplayedAudio(mediaitem));
  }

  /** The audio media item the operator may play, or `null` when the script does not allow a replay. */
  static replayAudioitem(promptItem: PromptItem|null|undefined): Mediaitem|null {
    return PromptitemUtil.firstOfKind(promptItem, (mediaitem) => MediaitemUtil.isReplayableAudio(mediaitem));
  }

  private static firstOfKind(promptItem: PromptItem|null|undefined, matches: (mediaitem: Mediaitem) => boolean): Mediaitem|null {
    const mediaitems = promptItem?.mediaitems;
    if (!mediaitems) {
      return null;
    }
    for (const mediaitem of mediaitems) {
      if (matches(mediaitem)) {
        return mediaitem;
      }
    }
    return null;
  }

  static toPlainTextString(promptItem: PromptItem): string {

    let mis = promptItem.mediaitems;
    let description = "";
    if (mis) {

      let misSize = mis.length;
      for (let i = 0; i < misSize; i++) {
        let mi = mis[i];
        description = description.concat(MediaitemUtil.description(mi));
        if (i + 1 < misSize) {
          // not last item
          description = description.concat(", ");
        }
      }
    }
    return description;
  }
}


