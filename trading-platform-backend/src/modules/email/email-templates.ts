/**
 * SendGrid dynamic template IDs and default data.
 * Replace placeholder IDs with actual SendGrid template identifiers.
 */
export interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  defaultData?: Record<string, any>;
}

export const EMAIL_TEMPLATES: Record<string, EmailTemplate> = {
  WELCOME: {
    id: process.env.SENDGRID_TEMPLATE_WELCOME || 'd-PLACEHOLDER_WELCOME',
    name: 'Welcome Email',
    subject: 'Welcome to Trading Platform!',
    defaultData: {
      appName: 'Trading Platform',
      supportEmail: 'support@tradingplatform.com',
    },
  },
  EMAIL_VERIFICATION: {
    id: process.env.SENDGRID_TEMPLATE_VERIFY || 'd-PLACEHOLDER_VERIFY',
    name: 'Email Verification',
    subject: 'Verify your email address',
    defaultData: { appName: 'Trading Platform', expiryHours: 24 },
  },
  PASSWORD_RESET: {
    id: process.env.SENDGRID_TEMPLATE_RESET || 'd-PLACEHOLDER_RESET',
    name: 'Password Reset',
    subject: 'Reset your password',
    defaultData: { appName: 'Trading Platform', expiryMinutes: 30 },
  },
  TRADE_REPORT: {
    id: process.env.SENDGRID_TEMPLATE_REPORT || 'd-PLACEHOLDER_REPORT',
    name: 'Trade Report',
    subject: 'Your Trading Performance Report',
    defaultData: { appName: 'Trading Platform' },
  },
  SUBSCRIPTION_CONFIRMED: {
    id:
      process.env.SENDGRID_TEMPLATE_SUB_CONFIRM || 'd-PLACEHOLDER_SUB_CONFIRM',
    name: 'Subscription Confirmed',
    subject: 'Subscription Activated',
    defaultData: { appName: 'Trading Platform' },
  },
  PAYMENT_FAILED: {
    id: process.env.SENDGRID_TEMPLATE_PAY_FAIL || 'd-PLACEHOLDER_PAY_FAIL',
    name: 'Payment Failed',
    subject: 'Action Required: Payment Failed',
    defaultData: {
      appName: 'Trading Platform',
      supportEmail: 'support@tradingplatform.com',
    },
  },
  TRIAL_ENDING: {
    id: process.env.SENDGRID_TEMPLATE_TRIAL_END || 'd-PLACEHOLDER_TRIAL_END',
    name: 'Trial Ending',
    subject: 'Your trial is ending soon',
    defaultData: { appName: 'Trading Platform' },
  },
};

export function buildTemplateData(
  templateKey: string,
  customData: Record<string, any>,
): { templateId: string; data: Record<string, any> } {
  const template = EMAIL_TEMPLATES[templateKey];
  if (!template) throw new Error(`Unknown email template: ${templateKey}`);
  return {
    templateId: template.id,
    data: { ...template.defaultData, ...customData },
  };
}
