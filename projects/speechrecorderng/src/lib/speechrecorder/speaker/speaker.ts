export interface InformedConsent{
  project:string;
  informedConsentInPaperFormSigned: boolean;
  text: string;
}

export interface InformedConsents{
  informedConsent:Array<InformedConsent>;
}

export interface Speaker extends GlobSpeaker{
  personId: string | number;
}

export interface GlobSpeaker{
  uuid:string,
  code?: string;
  name?:string;
  forename?:string;
  dateOfBirth?:Date;
  informedConsents?: InformedConsents;
}
