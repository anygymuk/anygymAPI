import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';

interface Auth0User {
  user_id: string;
  email: string;
  name?: string;
}

interface CreateAuth0UserRequest {
  email: string;
  password?: string;
  name?: string;
  connection: string;
}

@Injectable()
export class Auth0Service {
  private readonly logger = new Logger(Auth0Service.name);
  private readonly managementApiUrl: string;
  private readonly managementApiClientId: string;
  private readonly managementApiClientSecret: string;
  private readonly managementApiAudience: string;
  private readonly connection: string;
  private accessToken: string | null = null;
  private tokenExpiry: Date | null = null;

  constructor(private configService: ConfigService) {
    // Get domain and strip protocol if present
    let domain = this.configService.get<string>('AUTH0_DOMAIN') || '';
    // Remove https:// or http:// prefix if present
    domain = domain.replace(/^https?:\/\//, '');
    // Remove trailing slash if present
    domain = domain.replace(/\/$/, '');
    
    this.managementApiUrl = domain;
    this.managementApiClientId = this.configService.get<string>('AUTH0_MANAGEMENT_CLIENT_ID') || '';
    this.managementApiClientSecret = this.configService.get<string>('AUTH0_MANAGEMENT_CLIENT_SECRET') || '';
    
    // Handle audience - ensure proper format for Auth0 Management API
    let audience = this.configService.get<string>('AUTH0_MANAGEMENT_AUDIENCE') || '';
    if (audience) {
      // Ensure it starts with https://
      if (!audience.startsWith('https://')) {
        audience = `https://${audience}`;
      }
      // Ensure it ends with /api/v2/ (Auth0 Management API requires this format)
      if (!audience.endsWith('/api/v2/')) {
        // Remove trailing slash if present, then add /api/v2/
        audience = audience.replace(/\/$/, '');
        if (!audience.endsWith('/api/v2')) {
          audience = `${audience}/api/v2/`;
        } else {
          audience = `${audience}/`;
        }
      }
    } else {
      // Default audience format - Auth0 Management API requires trailing slash
      audience = `https://${this.managementApiUrl}/api/v2/`;
    }
    this.managementApiAudience = audience;
    
    this.connection = this.configService.get<string>('AUTH0_CONNECTION') || 'Username-Password-Authentication';
    
    // Log configuration status (without exposing secrets)
    this.logger.log(`Auth0 Service initialized:`);
    this.logger.log(`  - Domain: ${this.managementApiUrl || 'NOT SET'}`);
    this.logger.log(`  - Client ID: ${this.managementApiClientId ? 'SET' : 'NOT SET'}`);
    this.logger.log(`  - Client Secret: ${this.managementApiClientSecret ? 'SET' : 'NOT SET'}`);
    this.logger.log(`  - Audience: ${this.managementApiAudience}`);
    this.logger.log(`  - Connection: ${this.connection}`);
    
    if (!this.managementApiUrl) {
      this.logger.error('AUTH0_DOMAIN is not set in environment variables');
    }
    if (!this.managementApiClientId || !this.managementApiClientSecret) {
      this.logger.error('AUTH0_MANAGEMENT_CLIENT_ID or AUTH0_MANAGEMENT_CLIENT_SECRET is not set');
    }
  }

  /**
   * Get access token for Auth0 Management API
   */
  private async getAccessToken(): Promise<string> {
    // Check if we have a valid token
    if (this.accessToken && this.tokenExpiry && this.tokenExpiry > new Date()) {
      return this.accessToken;
    }

    // Validate configuration
    if (!this.managementApiUrl) {
      throw new Error('AUTH0_DOMAIN is not configured. Please set it in your environment variables.');
    }

    if (!this.managementApiClientId || !this.managementApiClientSecret) {
      throw new Error('AUTH0_MANAGEMENT_CLIENT_ID and AUTH0_MANAGEMENT_CLIENT_SECRET must be configured.');
    }

    try {
      const tokenUrl = `https://${this.managementApiUrl}/oauth/token`;
      this.logger.log(`Attempting to authenticate with Auth0 at: ${tokenUrl}`);
      this.logger.log(`Using audience: ${this.managementApiAudience}`);
      
      // Auth0 OAuth token endpoint prefers form-encoded data
      const params = new URLSearchParams();
      params.append('client_id', this.managementApiClientId);
      params.append('client_secret', this.managementApiClientSecret);
      params.append('audience', this.managementApiAudience);
      params.append('grant_type', 'client_credentials');
      
      const response = await axios.post(tokenUrl, params.toString(), {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      });

      this.accessToken = response.data.access_token;
      // Set token expiry to 23 hours (Auth0 tokens typically last 24 hours)
      this.tokenExpiry = new Date(Date.now() + 23 * 60 * 60 * 1000);
      this.logger.log('Successfully obtained Auth0 Management API access token');
      return this.accessToken;
    } catch (error: any) {
      let errorMessage = error.message;
      let errorDetails = '';
      let errorCode = '';
      
      if (error.response?.data) {
        errorDetails = JSON.stringify(error.response.data, null, 2);
        errorCode = error.response.data.error || '';
        errorMessage = error.response.data.error_description || error.response.data.error || error.response.data.message || error.message;
      }
      
      this.logger.error(`Failed to get Auth0 access token: ${errorMessage}`);
      this.logger.error(`Auth0 error code: ${errorCode || 'N/A'}`);
      if (errorDetails) {
        this.logger.error(`Auth0 error details: ${errorDetails}`);
      }
      this.logger.error(`Request URL: https://${this.managementApiUrl}/oauth/token`);
      this.logger.error(`Client ID: ${this.managementApiClientId ? 'SET (length: ' + this.managementApiClientId.length + ', starts with: ' + this.managementApiClientId.substring(0, 10) + '...)' : 'NOT SET'}`);
      this.logger.error(`Client Secret: ${this.managementApiClientSecret ? 'SET (length: ' + this.managementApiClientSecret.length + ')' : 'NOT SET'}`);
      this.logger.error(`Audience: ${this.managementApiAudience}`);
      this.logger.error(`Full request body would be: client_id=${this.managementApiClientId}&client_secret=***&audience=${this.managementApiAudience}&grant_type=client_credentials`);
      
      if (error.response?.status === 401) {
        // Provide specific error messages based on Auth0 error codes
        let specificMessage = '';
        if (errorCode === 'invalid_client') {
          specificMessage = 'Invalid client credentials. Please verify AUTH0_MANAGEMENT_CLIENT_ID and AUTH0_MANAGEMENT_CLIENT_SECRET are correct.';
        } else if (errorCode === 'invalid_audience') {
          specificMessage = `Invalid audience. Expected: ${this.managementApiAudience}. Make sure your Auth0 application is authorized for the Management API.`;
        } else if (errorCode === 'access_denied') {
          specificMessage = 'Access denied. The application may not be authorized for the Management API or may be missing required scopes.';
        }
        
        throw new Error(
          `Authentication failed (401). ${specificMessage || ''}\n\n` +
          `Please verify:\n` +
          `1. AUTH0_MANAGEMENT_CLIENT_ID is correct (currently: ${this.managementApiClientId ? 'SET' : 'NOT SET'})\n` +
          `2. AUTH0_MANAGEMENT_CLIENT_SECRET is correct (currently: ${this.managementApiClientSecret ? 'SET' : 'NOT SET'})\n` +
          `3. The application is a Machine-to-Machine application in Auth0 Dashboard\n` +
          `4. The application has "Management API" enabled in Auth0 Dashboard (APIs → Auth0 Management API → Machine to Machine Applications)\n` +
          `5. The application has the necessary scopes/permissions enabled:\n` +
          `   - read:users\n` +
          `   - create:users\n` +
          `   - update:users\n` +
          `6. AUTH0_DOMAIN is correct: ${this.managementApiUrl || 'NOT SET'}\n` +
          `7. AUTH0_MANAGEMENT_AUDIENCE is correct: ${this.managementApiAudience}\n\n` +
          `Auth0 Error Code: ${errorCode || 'N/A'}\n` +
          `Auth0 Error Message: ${errorMessage}`
        );
      }
      
      if (error.code === 'ENOTFOUND') {
        throw new Error(`Failed to connect to Auth0 domain "${this.managementApiUrl}". Please verify AUTH0_DOMAIN is set correctly (e.g., "your-domain.auth0.com" without https://)`);
      }
      
      throw new Error(`Failed to authenticate with Auth0 Management API: ${errorMessage}`);
    }
  }

  /**
   * Test Auth0 connection - useful for debugging
   */
  async testConnection(): Promise<{ success: boolean; message: string; details?: any }> {
    try {
      const token = await this.getAccessToken();
      return {
        success: true,
        message: 'Successfully authenticated with Auth0 Management API',
        details: {
          domain: this.managementApiUrl,
          audience: this.managementApiAudience,
          connection: this.connection,
          clientIdSet: !!this.managementApiClientId,
          clientSecretSet: !!this.managementApiClientSecret,
        },
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.message,
        details: {
          domain: this.managementApiUrl,
          audience: this.managementApiAudience,
          connection: this.connection,
          clientIdSet: !!this.managementApiClientId,
          clientSecretSet: !!this.managementApiClientSecret,
        },
      };
    }
  }


  /**
   * Create a new user in Auth0
   * Note: Role assignment has been removed as assign:roles scope is not available
   */
  async createUser(email: string, name: string, password?: string): Promise<Auth0User> {
    try {
      const token = await this.getAccessToken();

      const userData: CreateAuth0UserRequest = {
        email,
        name,
        connection: this.connection,
        ...(password && { password }),
      };

      const response = await axios.post(
        `https://${this.managementApiUrl}/api/v2/users`,
        userData,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const userId = response.data.user_id;
      this.logger.log(`Successfully created Auth0 user: ${email} with ID: ${userId}`);
      this.logger.log(`Note: Role assignment skipped - user created without role assignment`);

      return {
        user_id: userId,
        email: response.data.email,
        name: response.data.name,
      };
    } catch (error: any) {
      this.logger.error(`Failed to create Auth0 user: ${error.message}`, error.stack);
      
      if (error.response?.data) {
        const errorMessage = error.response.data.message || error.response.data.error_description || error.message;
        throw new Error(`Failed to create user in Auth0: ${errorMessage}`);
      }
      
      throw new Error(`Failed to create user in Auth0: ${error.message}`);
    }
  }
}

