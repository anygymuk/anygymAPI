import { Gym } from '../../gyms/entities/gym.entity';
import { NewUserGymData } from './new-user.template';

export function resolveGymEmailImage(gym: Gym): string {
  return gym.gymChain?.logo || gym.imageUrl || '';
}

export function toNewUserGymData(
  gym: Gym,
  frontendUrl = process.env.FRONTEND_URL || 'https://any-gym.com',
): NewUserGymData {
  return {
    name: gym.name,
    address: gym.address,
    postcode: gym.postcode,
    city: gym.city,
    url: `${frontendUrl}/gyms/${gym.id}`,
    image: resolveGymEmailImage(gym),
  };
}
