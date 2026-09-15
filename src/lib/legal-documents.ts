export const legalDocuments = {
  terms: {
    title: "Terms of Use",
    summary: "The main agreement governing access to and use of WineBloom.",
    textFile: "terms-of-use.txt",
    downloadFile: "feelacy-terms-of-use.docx",
  },
  privacy: {
    title: "Privacy Policy",
    summary: "How WineBloom collects, uses, shares, protects, and retains personal data.",
    textFile: "privacy-policy.txt",
    downloadFile: "feelacy-privacy-policy.docx",
  },
  cookies: {
    title: "Cookie Policy",
    summary: "How WineBloom uses cookies and similar technologies, and the choices available to you.",
    textFile: "cookie-policy.txt",
    downloadFile: "feelacy-cookie-policy.docx",
  },
  policies: {
    title: "Policies",
    summary: "Rules for purchases, merchants, shipping, returns, responsible alcohol practices, and community contributions.",
    textFile: "policies.txt",
    downloadFile: "feelacy-policies.docx",
  },
  disclaimers: {
    title: "Disclaimers",
    summary: "Safeguards for AI-assisted features and WineBloom’s EU Digital Services Act process.",
    textFile: "disclaimers.txt",
    downloadFile: "feelacy-disclaimers.docx",
  },
} as const;

export type LegalDocumentSlug = keyof typeof legalDocuments;

export function isLegalDocumentSlug(value: string): value is LegalDocumentSlug {
  return value in legalDocuments;
}
