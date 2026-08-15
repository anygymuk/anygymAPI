/** Variables for the Resend "external-notification" template. */
export interface ExternalNotificationTemplateData {
  notification_subject: string;
  notification_body: string;
}

export const EXTERNAL_NOTIFICATION_TEMPLATE_ID =
  process.env.RESEND_EXTERNAL_NOTIFICATION_TEMPLATE_ID ?? 'external-notification';

export function buildExternalNotificationSubject(
  notificationSubject: string,
): string {
  return notificationSubject;
}

export function toExternalNotificationTemplateVariables(
  data: ExternalNotificationTemplateData,
): Record<string, string> {
  return {
    notification_subject: data.notification_subject,
    notification_body: data.notification_body,
  };
}
