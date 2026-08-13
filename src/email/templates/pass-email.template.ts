/** Variables for the Resend "new-pass" template. */
export interface PassEmailTemplateData {
  recipient_name: string;
  gym_name: string;
  gym_address: string;
  gym_city: string;
  gym_postcode: string;
  gym_lng: number;
  gym_lat: number;
  pass_id: string;
}

export const PASS_EMAIL_TEMPLATE_ID =
  process.env.RESEND_PASS_TEMPLATE_ID ?? 'new-pass';

export function buildPassEmailSubject(gymName: string): string {
  return `Your AnyGym pass for ${gymName}`;
}

export function toPassEmailTemplateVariables(
  data: PassEmailTemplateData,
): Record<string, string | number> {
  return {
    recipient_name: data.recipient_name,
    gym_name: data.gym_name,
    gym_address: data.gym_address,
    gym_city: data.gym_city,
    gym_postcode: data.gym_postcode,
    gym_lng: data.gym_lng,
    gym_lat: data.gym_lat,
    pass_id: data.pass_id,
  };
}
