export const gaMeasurementId = import.meta.env.PUBLIC_GA_MEASUREMENT_ID ?? "";
export const isGaEnabled = import.meta.env.PROD && Boolean(gaMeasurementId);

export const gaEventNames = {
  ctaClick: "cta_click",
  navigationClick: "navigation_click",
  socialClick: "social_click",
  documentOpen: "document_open",
  fileDownload: "file_download",
  signatureSubmitSuccess: "signature_submit_success",
  signatureSubmitError: "signature_submit_error"
} as const;
