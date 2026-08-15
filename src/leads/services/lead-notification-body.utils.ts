export const NEWSLETTER_NOTIFICATION_SUBJECT = 'Newsletter subscription';
export const GYM_GROUP_NOTIFICATION_SUBJECT = 'Gym group enquiry';
export const INVESTOR_NOTIFICATION_SUBJECT = 'Investor enquiry';

export function buildNewsletterNotificationBody(email: string): string {
  return [
    'A new newsletter subscription was received.',
    '',
    `Email: ${email}`,
  ].join('\n');
}

export function buildGymGroupNotificationBody(data: {
  contactName: string;
  email: string;
  companyName: string;
  locations: string;
  phone?: string;
  message?: string;
}): string {
  const lines = [
    'A new gym group enquiry was received.',
    '',
    `Contact name: ${data.contactName}`,
    `Email: ${data.email}`,
    `Company: ${data.companyName}`,
    `Locations: ${data.locations}`,
  ];
  if (data.phone) lines.push(`Phone: ${data.phone}`);
  if (data.message) lines.push(`Message: ${data.message}`);
  return lines.join('\n');
}

export function buildInvestorNotificationBody(data: {
  fullName: string;
  email: string;
  company?: string;
  investmentRange?: string;
  message?: string;
}): string {
  const lines = [
    'A new investor enquiry was received.',
    '',
    `Name: ${data.fullName}`,
    `Email: ${data.email}`,
  ];
  if (data.company) lines.push(`Company: ${data.company}`);
  if (data.investmentRange) lines.push(`Investment range: ${data.investmentRange}`);
  if (data.message) lines.push(`Message: ${data.message}`);
  return lines.join('\n');
}
