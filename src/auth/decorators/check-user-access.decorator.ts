import { SetMetadata } from '@nestjs/common';

export const CHECK_USER_ACCESS_KEY = 'checkUserAccess';

export interface CheckUserAccessOptions {
  /** The name of the param containing the user ID. Defaults to 'id' */
  paramName?: string;
  /** Where to look for the user ID: 'params' (route), 'query', or 'body'. Defaults to checking all */
  source?: 'params' | 'query' | 'body';
  /** If true, team leaders and above can access any user (useful for GET/view endpoints) */
  allowTeamLeadersViewAll?: boolean;
}

/**
 * Decorator to mark an endpoint for user access validation.
 * Used with UserAccessGuard to automatically check if the current user
 * has permission to access the target user.
 *
 * @example
 * // Basic usage - checks if user can access the :id param
 * @CheckUserAccess()
 * @Patch(':id')
 * async update(@Param('id') id: string) {}
 *
 * @example
 * // Allow team leaders to view any user
 * @CheckUserAccess({ allowTeamLeadersViewAll: true })
 * @Get(':id')
 * async findOne(@Param('id') id: string) {}
 *
 * @example
 * // Custom param name
 * @CheckUserAccess({ paramName: 'userId' })
 * @Get(':userId/schedules')
 * async getSchedules(@Param('userId') userId: string) {}
 */
export const CheckUserAccess = (options: CheckUserAccessOptions = {}) =>
  SetMetadata(CHECK_USER_ACCESS_KEY, options);
