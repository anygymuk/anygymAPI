/** Variables for the Resend "internal-notification" template. */
export interface InternalNotificationTemplateData {
  notification_subject: string;
  notification_body: string;
}

export const INTERNAL_NOTIFICATION_TEMPLATE_ID =
  process.env.RESEND_INTERNAL_NOTIFICATION_TEMPLATE_ID ?? 'internal-notification';

export function buildInternalNotificationSubject(
  notificationSubject: string,
): string {
  return notificationSubject;
}

export function toInternalNotificationTemplateVariables(
  data: InternalNotificationTemplateData,
): Record<string, string> {
  return {
    notification_subject: data.notification_subject,
    notification_body: data.notification_body,
  };
}
