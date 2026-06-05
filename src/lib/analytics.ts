export const gaMeasurementId = import.meta.env.PUBLIC_GA_MEASUREMENT_ID ?? "";
export const isGaEnabled = import.meta.env.PROD && Boolean(gaMeasurementId);
export const analyticsFormNames = {
  campaignSignature: "campaign_signature_form"
} as const;

export const gaEventNames = {
  ctaClick: "cta_click",
  navigationClick: "navigation_click",
  socialClick: "social_click",
  sciencePaperModalOpen: "science_paper_modal_open",
  documentOpen: "document_open",
  fileDownload: "file_download",
  signatureSubmitSuccess: "signature_submit_success",
  signatureSubmitError: "signature_submit_error"
} as const;

export const keyEventRecommendations = {
  primary: gaEventNames.signatureSubmitSuccess,
  supporting: [gaEventNames.documentOpen]
} as const;
