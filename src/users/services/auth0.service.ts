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
    this.managementApiAudience = this.configService.get<string>('AUTH0_MANAGEMENT_AUDIENCE') || `https://${this.managementApiUrl}/api/v2/`;
    this.connection = this.configService.get<string>('AUTH0_CONNECTION') || 'Username-Password-Authentication';
    
    if (!this.managementApiUrl) {
      this.logger.warn('AUTH0_DOMAIN is not set in environment variables');
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
      
      const requestBody = {
        client_id: this.managementApiClientId,
        client_secret: this.managementApiClientSecret,
        audience: this.managementApiAudience,
        grant_type: 'client_credentials',
      };
      
      const response = await axios.post(tokenUrl, requestBody, {
        headers: {
          'Content-Type': 'application/json',
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
      
      if (error.response?.data) {
        errorDetails = JSON.stringify(error.response.data);
        errorMessage = error.response.data.error_description || error.response.data.error || error.response.data.message || error.message;
      }
      
      this.logger.error(`Failed to get Auth0 access token: ${errorMessage}`);
      if (errorDetails) {
        this.logger.error(`Auth0 error details: ${errorDetails}`);
      }
      
      if (error.response?.status === 401) {
        throw new Error(
          `Authentication failed (401). Please verify:\n` +
          `1. AUTH0_MANAGEMENT_CLIENT_ID is correct\n` +
          `2. AUTH0_MANAGEMENT_CLIENT_SECRET is correct\n` +
          `3. The application has "Management API" enabled in Auth0 Dashboard\n` +
          `4. The application has the necessary scopes/permissions (e.g., "read:users", "create:users", "read:roles", "assign:roles")\n` +
          `5. AUTH0_DOMAIN is correct: ${this.managementApiUrl}\n` +
          `6. AUTH0_MANAGEMENT_AUDIENCE is correct: ${this.managementApiAudience}\n` +
          `Auth0 Error: ${errorMessage}`
        );
      }
      
      if (error.code === 'ENOTFOUND') {
        throw new Error(`Failed to connect to Auth0 domain "${this.managementApiUrl}". Please verify AUTH0_DOMAIN is set correctly (e.g., "your-domain.auth0.com" without https://)`);
      }
      
      throw new Error(`Failed to authenticate with Auth0 Management API: ${errorMessage}`);
    }
  }

  /**
   * Get role ID by role name from Auth0
   */
  private async getRoleIdByName(roleName: string): Promise<string | null> {
    try {
      const token = await this.getAccessToken();

      // Auth0 roles API returns roles array directly, can filter by name
      const response = await axios.get(
        `https://${this.managementApiUrl}/api/v2/roles`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          params: {
            name_filter: roleName,
            per_page: 100,
          },
        }
      );

      // Auth0 returns roles as an array directly
      const roles = response.data || [];
      const role = Array.isArray(roles) ? roles.find((r: any) => r.name === roleName) : null;
      
      if (role && role.id) {
        this.logger.log(`Found Auth0 role "${roleName}" with ID: ${role.id}`);
        return role.id;
      }

      this.logger.warn(`Role "${roleName}" not found in Auth0`);
      return null;
    } catch (error: any) {
      this.logger.error(`Failed to get role ID for "${roleName}": ${error.message}`, error.stack);
      return null;
    }
  }

  /**
   * Assign a role to a user in Auth0
   */
  private async assignRoleToUser(userId: string, roleName: string): Promise<void> {
    try {
      const token = await this.getAccessToken();

      // Get role ID by name
      const roleId = await this.getRoleIdByName(roleName);
      if (!roleId) {
        throw new Error(`Role "${roleName}" not found in Auth0`);
      }

      // Assign role to user
      await axios.post(
        `https://${this.managementApiUrl}/api/v2/users/${encodeURIComponent(userId)}/roles`,
        { roles: [roleId] },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      this.logger.log(`Successfully assigned role "${roleName}" to user ${userId}`);
    } catch (error: any) {
      this.logger.error(`Failed to assign role "${roleName}" to user: ${error.message}`, error.stack);
      throw new Error(`Failed to assign role "${roleName}" to user: ${error.message}`);
    }
  }

  /**
   * Create a new user in Auth0
   */
  async createUser(email: string, name: string, role: string, password?: string): Promise<Auth0User> {
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

      // Assign role to the user (required)
      try {
        await this.assignRoleToUser(userId, role);
      } catch (roleError: any) {
        // Role assignment is required, so we should fail if it doesn't work
        // Attempt to clean up the created user
        this.logger.error(`Role assignment failed for user ${userId}, attempting cleanup`);
        try {
          const cleanupToken = await this.getAccessToken();
          await axios.delete(
            `https://${this.managementApiUrl}/api/v2/users/${encodeURIComponent(userId)}`,
            {
              headers: {
                Authorization: `Bearer ${cleanupToken}`,
              },
            }
          );
          this.logger.log(`Cleaned up Auth0 user ${userId} after role assignment failure`);
        } catch (cleanupError) {
          this.logger.error(`Failed to clean up Auth0 user ${userId} after role assignment failure`);
        }
        throw new Error(`User created but role assignment failed: ${roleError.message}`);
      }

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

