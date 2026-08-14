export interface NewUserGymData {
  name: string;
  address: string;
  postcode: string;
  city: string;
  url: string;
  image: string;
}

/** Variables for the Resend "new-user" template. */
export interface NewUserEmailTemplateData {
  recipient_name: string;
  membership_name: string;
  gym_1?: NewUserGymData;
  gym_2?: NewUserGymData;
  gym_3?: NewUserGymData;
}

export const NEW_USER_EMAIL_TEMPLATE_ID =
  process.env.RESEND_NEW_USER_TEMPLATE_ID ?? 'new-user';

export function buildNewUserEmailSubject(membershipName: string): string {
  return `Welcome to AnyGym — ${membershipName} membership`;
}

function gymVariables(
  index: 1 | 2 | 3,
  gym?: NewUserGymData,
): Record<string, string> {
  const prefix = `gym_${index}`;

  return {
    [`${prefix}_name`]: gym?.name ?? '',
    [`${prefix}_address`]: gym?.address ?? '',
    [`${prefix}_postcode`]: gym?.postcode ?? '',
    [`${prefix}_city`]: gym?.city ?? '',
    [`${prefix}_url`]: gym?.url ?? '',
    [`${prefix}_image`]: gym?.image ?? '',
    // SendGrid-compatible aliases for migrated templates
    [`Gym_${index}_Name`]: gym?.name ?? '',
    [`Gym_${index}_Address`]: gym?.address ?? '',
    [`Gym_${index}_Postcode`]: gym?.postcode ?? '',
    [`Gym_${index}_City`]: gym?.city ?? '',
    [`Gym_${index}_Url`]: gym?.url ?? '',
    [`Gym_${index}_Image`]: gym?.image ?? '',
  };
}

export function toNewUserEmailTemplateVariables(
  data: NewUserEmailTemplateData,
): Record<string, string> {
  return {
    recipient_name: data.recipient_name,
    membership_name: data.membership_name,
    Recipient_Name: data.recipient_name,
    Membership_Name: data.membership_name,
    ...gymVariables(1, data.gym_1),
    ...gymVariables(2, data.gym_2),
    ...gymVariables(3, data.gym_3),
  };
}
