import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';

@Injectable()
export class GeocodingService {
  private readonly logger = new Logger(GeocodingService.name);

  async geocodePostcode(postcode: string): Promise<{ latitude: number; longitude: number } | null> {
    try {
      // Using UK Postcodes API (free tier available)
      // You can also use Google Geocoding API or other services
      const response = await axios.get(`https://api.postcodes.io/postcodes/${encodeURIComponent(postcode)}`);
      
      if (response.data && response.data.result) {
        return {
          latitude: response.data.result.latitude,
          longitude: response.data.result.longitude,
        };
      }
      
      return null;
    } catch (error) {
      this.logger.warn(`Failed to geocode postcode ${postcode}: ${error.message}`);
      return null;
    }
  }
}

