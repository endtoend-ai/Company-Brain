# Security and Compliance Overview

Owner: Priya Shah, Head of Security. Last reviewed: September 2026.

## Certifications and reports

- SOC 2 Type II. The current report covers the observation period from February 1, 2026 through
  July 31, 2026. The auditor is Prescient Assurance.
- HIPAA. Northwind Labs signs a business associate agreement (BAA) with healthcare customers,
  including Acme Health.
- CCPA. Northwind acts as a service provider for California personal information.
- Annual penetration test completed in August 2026; no critical findings remain open.

## Data protection

- Encryption at rest: AES-256.
- Encryption in transit: TLS 1.2 or higher.
- Production data residency: AWS us-east-1 and us-west-2 (United States only).
- Customer data is logically separated by tenant; backups are encrypted and retained for 35 days.

## Vendor security review

New vendors complete a security questionnaire and a SIG assessment. The standard review takes two
weeks. Vendors that process protected health information require a signed BAA before onboarding.

## Incident response

- Security incidents are triaged within one hour.
- Customers are notified of a confirmed data breach within 72 hours.
- The security team publishes a post-incident report within five business days.
- Security contact: security@northwindlabs.com.

## Access control

- Single sign-on with SAML and enforced multi-factor authentication.
- Production access requires least-privilege roles and quarterly access reviews.
- Administrative access is logged and retained for one year.
