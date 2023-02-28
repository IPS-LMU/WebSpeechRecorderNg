export interface LocalizedMessage{
  languageCodeISO639: string,
  message: string
}

export enum DataType {String='STRING',Integer='INTEGER',Float='FLOAT',Timestamp ='TIMESTAMP',Boolean='BOOLEAN',Enum='ENUM'}
export enum UiFieldHint {TextField='TEXTFIELD',TextArea='TEXTAREA',Select='SELECT'}

export interface EnumConstantDescriptor{
  name: string,
  localizedNames: Array<LocalizedMessage>
}

 export interface PropertyDescriptor {
  name: string,
  dataType: DataType,
  uiFieldHint: UiFieldHint,
  localizedNames: Array<LocalizedMessage>,
   enumConstantDescriptors: Array<EnumConstantDescriptor>
}

export interface ClassDescriptor{
  propertyDescriptors:Array<PropertyDescriptor>;
}
