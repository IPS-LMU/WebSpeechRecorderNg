export interface Speaker extends GlobSpeaker{
  personId?: string | number;
}

export interface GlobSpeaker{
  uuid:string,
  code?: string;
  name?:string;
  forename?:string;
  dateOfBirth?:Date;
}