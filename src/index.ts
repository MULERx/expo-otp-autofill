// Reexport the native module. On web, it will be resolved to ExpoOtpAutofillModule.web.ts
// and on native platforms to ExpoOtpAutofillModule.ts
export { default } from './ExpoOtpAutofillModule';
export { default as ExpoOtpAutofillView } from './ExpoOtpAutofillView';
export * from  './ExpoOtpAutofill.types';
