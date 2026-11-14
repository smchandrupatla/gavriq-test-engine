#!/usr/bin/env node
/**
 * Link every case that is red because of an application defect to the defect's
 * ticket, on the Test cases screen (triage: "Issue linked" + the ticket URL).
 *
 *   node scripts/link-known-defects.mjs            (TE_BASE, default http://127.0.0.1:8797)
 *
 * A case in this list asserts the DOCUMENTED behaviour and fails until the
 * application is fixed. It is never rewritten to expect the defect. When a ticket
 * is closed and the case passes, remove its line here and clear the triage.
 *
 * Triage is operator state in the engine (a reseed does not overwrite it), so
 * this script is the record of which ticket each known-defect case waits on.
 */
const TE = (process.env.TE_BASE || 'http://127.0.0.1:8797').replace(/\/$/, '');
const JIRA = 'https://gavriqlabsglobal.atlassian.net/browse';

/** ticket → the cases that wait on it */
export const KNOWN_DEFECTS = {
  'KAN-1810': ['SB-UC-roleCreate-EXC-1', 'SB-UC-roles-EXC-2'], // duplicate role name answers 500, documented 409
  'KAN-1811': ['SB-UC-roles-EXC-1'], // deleting a role that is still assigned answers 200, documented 409
  'KAN-1812': ['SB-UC-dsNew-ALT-1'], // adding a dataset item answers 500 (ALTER TABLE as the application role)
  'KAN-1813': ['SB-UC-tsNew-ALT-2', 'SB-UC-tsNew-EXC-2'], // invalid suite member list answers 500, documented 422
  'KAN-1814': ['SB-UC-msgCreateSchema-EXC-2'], // same schema under another name answers 500, documented 409
  // upstream SIT files drive the removed #screen-action form on /rule-bench-create.html (test is stale, not the application)
  'KAN-1833': [
    'BUC-BUC11-A-UTILITY-DATA-QUALITY-ENGINEER-AUTHORS-A-METER-TELEMETRY-SCHEME-STAGES-ANOMALY-RULES-FEEDS-A-',
    'BUC-BUC12-A-FRAUD-PRODUCT-MANAGER-BUILDS-A-CHECKOUT-SCHEME-STAGES-CARD-TESTING-AND-HIGH-RISK-SHIPPING-RU',
    'BUC-BUC13-A-SURVEILLANCE-RULE-OWNER-STAGES-BASELINE-OUTLIER-CONCENTRATION-CONDITIONS-IN-RULE-BENCH-BUILD',
    'BUC-BUC14-A-PROGRAMME-LEAD-IMPORTS-THE-SCHEME-S-XSD-CENTRALLY-STAGES-AN-MDR-DERIVED-RULE-PROVISIONS-TWO-',
    'BUC-BUC15-A-PSP-RELIABILITY-LEAD-BUILDS-THE-PAYMENT-INITIATION-CONTRACT-SCHEME-STAGES-CONFORMANCE-RULES-',
  ],
  // more SIT files still fill the removed #screen-action form
  'KAN-1833b': [
    'SIT-115_BUSINESS-USE-CASE-BUC16-CORE-BANKING-UAT-BENCH-IMPORT-A-PAYMENT-SCHEME-ENCODE-ITS-RULES-REGRESS-IT',
    'SIT-116_BUSINESS-USE-CASE-BUC17-AIRLINE-BOOKING-FRAUD-TESTING-MODEL-THE-PNR-SCHEME-ENCODE-FRAUD-RULES-REGR',
    'SIT-117_BUSINESS-USE-CASE-BUC18-MANUFACTURING-B2B-EDI-INTEGRATION-IMPORT-THE-BASELINE-PO-ASN-SCHEME-ENCODE',
    'SIT-118_BUSINESS-USE-CASE-BUC19-PAYROLL-SAAS-FILE-EXCHANGE-VALIDATION-BUILD-THE-EMPLOYEE-MASTER-SCHEME-BOT',
    'SIT-119_BUSINESS-USE-CASE-BUC20-MSSP-DETECTION-RULE-ASSURANCE-BUILD-THE-AUTH-LOG-SOURCE-SCHEME-ENCODE-DETE',
  ],
  // Message Designer: Publish never enables (definition name keeps its draft name); 12 cases
  'KAN-1834': [
    'SIT-101_BUSINESS_USE_CASE_CARD_PAYMENTS_FRAUD_RULE_ENGINEERING-BUC-02-CARD-PAYMENTS-FRAUD-RULE-ENGINEERING-CUSTOM-SCHEME',
    'SIT-102_BUSINESS_USE_CASE_CAPITAL_MARKETS_SECURITIES_SETTLEMENT-BUC-03-CAPITAL-MARKETS-SECURITIES-SETTLEMENT-FORMAT-UPGR',
    'SIT-103_BUSINESS_USE_CASE_INSURANCE_CLAIMS_FRAUD_RULE_TESTING-BUC-04-P-C-INSURANCE-SIU-CLAIMS-FRAUD-RULES-SCHEME-TO-EVID',
    'SIT-104_BUSINESS_USE_CASE_HEALTH_PAYER_EDI_CLAIMS_QA-BUC-05-HEALTH-PAYER-EDI-CLAIMS-ADJUDICATION-QA-SCHEME-TO-EVIDENCE-P',
    'SIT-115_BUSINESS-USE-CASE-BUC16-DEFECT-PUBLISH-CREATE-MESSAGE-DEFINITION-S-PUBLISH-ENABLES-ONCE-A-DEFINITI',
    'SIT-120_BUSINESS_USE_CASE_CORRESPONDENT_BANKING_SANCTIONS_SCREENING-BUC-01-CORRESPONDENT-BANKING-SANCTIONS-SCREENING-SCH',
    'SIT-72_SELENIUM_BUSINESS_E2E-E2E-F1-REOPEN-A-SAVED-FEEDER-CHANGE-ITS-',
    'SIT-72_SELENIUM_BUSINESS_E2E-E2E-F2-ALL-FEEDERS-FILTERS-COPIES-AND-AR',
    'SIT-72_SELENIUM_BUSINESS_E2E-E2E-J1-IMPORT-AN-XSD-DEFINE-A-MESSAGE-PU',
    'SIT-72_SELENIUM_BUSINESS_E2E-E2E-J2B-A-JSON-SCHEMA-IMPORT-CAN-BE-PUBL',
    'SIT-72_SELENIUM_BUSINESS_E2E-E2E-J3-START-FROM-A-STANDARD-ISO-MESSAGE',
    'SIT-72_SELENIUM_BUSINESS_E2E-E2E-J4-PUBLISH-ONE-PACS-008-MESSAGE-AND-',
  ],
  'KAN-1815': ['SB-VS-CORS-NOT-REFLECTED'], // CORS reflects any Origin with credentials allowed
  'KAN-1818': ['SB-PERF-DBVIEWER-ROWS-INDEX'], // audit rows stored twice, one 1 MB: row listing is slow
};

let failed = 0;
for (const [listName, keys] of Object.entries(KNOWN_DEFECTS)) {
  const ticket = listName.replace(/[a-z]$/, ''); // 'KAN-1833b' is a second list for KAN-1833
  for (const key of keys) {
    // Keys over 100 characters are refused as a route parameter: patch those by id.
    let ref = key;
    if (key.length > 90) {
      const found = await (await fetch(`${TE}/api/v1/test-cases?q=${encodeURIComponent(key)}&limit=5`)).json();
      ref = (found.data || []).find((c) => c.key === key)?.id || key;
    }
    const res = await fetch(`${TE}/api/v1/test-cases/${encodeURIComponent(ref)}/triage`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', 'x-actor-id': 'known-defects' },
      body: JSON.stringify({ triageStatus: 'Issue linked', linkedIssueUrl: `${JIRA}/${ticket}` }),
    });
    if (!res.ok) failed++;
    console.log(`${key} -> ${ticket}: ${res.ok ? 'linked' : `HTTP ${res.status} ${(await res.text()).slice(0, 160)}`}`);
  }
}
process.exit(failed ? 1 : 0);

