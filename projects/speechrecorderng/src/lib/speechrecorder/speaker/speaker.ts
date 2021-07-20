export interface InformedConsent{
  project:string;
  informedConsentInPaperFormSigned: boolean;
  text: string;
}

export interface InformedConsents{
  informedConsent:Array<InformedConsent>;
}

export interface Speaker{
  personId: string | number,
  code?: string;
  name?:string;
  forename?:string;
  dateOfBirth?:Date;
  informedConsents?: InformedConsents;
}
