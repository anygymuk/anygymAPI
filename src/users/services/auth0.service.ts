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
    this.managementApiUrl = this.configService.get<string>('AUTH0_DOMAIN') || '';
    this.managementApiClientId = this.configService.get<string>('AUTH0_MANAGEMENT_CLIENT_ID') || '';
    this.managementApiClientSecret = this.configService.get<string>('AUTH0_MANAGEMENT_CLIENT_SECRET') || '';
    this.managementApiAudience = this.configService.get<string>('AUTH0_MANAGEMENT_AUDIENCE') || `https://${this.managementApiUrl}/api/v2/`;
    this.connection = this.configService.get<string>('AUTH0_CONNECTION') || 'Username-Password-Authentication';
  }

  /**
   * Get access token for Auth0 Management API
   */
  private async getAccessToken(): Promise<string> {
    // Check if we have a valid token
    if (this.accessToken && this.tokenExpiry && this.tokenExpiry > new Date()) {
      return this.accessToken;
    }

    try {
      const response = await axios.post(`https://${this.managementApiUrl}/oauth/token`, {
        client_id: this.managementApiClientId,
        client_secret: this.managementApiClientSecret,
        audience: this.managementApiAudience,
        grant_type: 'client_credentials',
      });

      this.accessToken = response.data.access_token;
      // Set token expiry to 23 hours (Auth0 tokens typically last 24 hours)
      this.tokenExpiry = new Date(Date.now() + 23 * 60 * 60 * 1000);
      this.logger.log('Successfully obtained Auth0 Management API access token');
      return this.accessToken;
    } catch (error) {
      this.logger.error(`Failed to get Auth0 access token: ${error.message}`, error.stack);
      throw new Error(`Failed to authenticate with Auth0 Management API: ${error.message}`);
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

