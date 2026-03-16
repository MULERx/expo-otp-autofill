export type ExpoOtpAutofillModuleEvents = {
  onOtpReceived: (event: { message: string }) => void;
  onOtpError: (event: { message: string }) => void;
};
