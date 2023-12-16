import {SPEECHRECORDER_ENVIRONMENT_DEFAULTS} from "speechrecorderng";

export const environment = {
  ...SPEECHRECORDER_ENVIRONMENT_DEFAULTS,

  production: true,
  apiType: 'normal',
  apiEndPoint: 'api/v1',
  apiVersion:1,
  enableDownloadRecordings:false,
  enableUploadRecordings: true
};
