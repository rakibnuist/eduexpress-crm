/**
 * roles.js — Role-Based Access Control (RBAC) for EduExpress CRM
 * ============================================================
 * Defines all roles, permissions, navigation items, and access rules.
 * One employee can hold 2-3 roles simultaneously.
 *
 * Roles: founder_ceo, managing_director, investor, consultant,
 *        application_manager, marketing_manager
 */

// ─── Permissions (atomic capability flags) ─────────────────────────────────
export const PERMISSIONS = {
  // Dashboard & Executive
  VIEW_EXECUTIVE_DASHBOARD: 'view_executive_dashboard',
  VIEW_PERSONAL_DASHBOARD:  'view_personal_dashboard',
  VIEW_COCKPIT:             'view_cockpit',
  VIEW_REPORTS:             'view_reports',
  VIEW_ANALYTICS:           'view_analytics',

  // Daily Workspace
  VIEW_MY_DAY:              'view_my_day',

  // Leads & Pipeline
  MANAGE_ALL_LEADS:         'manage_all_leads',
  MANAGE_OWN_LEADS:         'manage_own_leads',
  VIEW_LEADS:               'view_leads',

  // Applications
  MANAGE_APPLICATIONS:      'manage_applications',
  VIEW_APPLICATIONS:        'view_applications',
  ADD_APPLICATION_CHINA:    'add_application_china',

  // Chat Inbox
  VIEW_CHAT_INBOX:          'view_chat_inbox',
  VIEW_ALL_CONVERSATIONS:   'view_all_conversations',
  VIEW_OWN_CONVERSATIONS:   'view_own_conversations',
  MANAGE_CHANNEL_ACCOUNTS:  'manage_channel_accounts',
  REPLY_ALL_CHANNELS:       'reply_all_channels',
  REPLY_OWN_CHANNELS:       'reply_own_channels',

  // Marketing
  MANAGE_MARKETING:         'manage_marketing',
  VIEW_MARKETING:           'view_marketing',

  // Automation
  MANAGE_AUTOMATION:        'manage_automation',
  VIEW_AUTOMATION:          'view_automation',

  // Finance
  MANAGE_FINANCE:           'manage_finance',
  VIEW_FINANCE:             'view_finance',

  // HR
  MANAGE_HR:                'manage_hr',
  VIEW_HR:                  'view_hr',

  // Settings & Admin
  MANAGE_SETTINGS:          'manage_settings',
  MANAGE_USERS:             'manage_users',
  MANAGE_ROLES:             'manage_roles',

  // China Data Isolation (EduExpress Business Model)
  VIEW_CHINA_DATA:          'view_china_data',
  VIEW_CHINA_APPLICATIONS:   'view_china_applications',

  // Broadcast & Communications
  SEND_BROADCASTS:          'send_broadcasts',
  VIEW_BROADCASTS:          'view_broadcasts',
};

// ─── Role Definitions ──────────────────────────────────────────────────────
export const ROLE_DEFS = {
  founder_ceo: {
    label: 'Founder & CEO',
    badgeColor: 'bg-purple-100 text-purple-700',
    permissions: Object.values(PERMISSIONS), // Full access to everything
  },
  managing_director: {
    label: 'Managing Director',
    badgeColor: 'bg-indigo-100 text-indigo-700',
    permissions: Object.values(PERMISSIONS).filter(p => p !== PERMISSIONS.VIEW_CHINA_DATA && p !== PERMISSIONS.VIEW_CHINA_APPLICATIONS && p !== PERMISSIONS.ADD_APPLICATION_CHINA),
  },
  investor: {
    label: 'Investor',
    badgeColor: 'bg-emerald-100 text-emerald-700',
    permissions: [
      PERMISSIONS.VIEW_EXECUTIVE_DASHBOARD,
      PERMISSIONS.VIEW_COCKPIT,
      PERMISSIONS.VIEW_REPORTS,
      PERMISSIONS.VIEW_ANALYTICS,
      PERMISSIONS.VIEW_LEADS,
      PERMISSIONS.VIEW_APPLICATIONS,
      PERMISSIONS.VIEW_FINANCE,
      PERMISSIONS.VIEW_HR,
      PERMISSIONS.VIEW_MARKETING,
      PERMISSIONS.VIEW_AUTOMATION,
      PERMISSIONS.VIEW_BROADCASTS,
    ],
  },
  consultant: {
    label: 'Consultant',
    badgeColor: 'bg-blue-100 text-blue-700',
    permissions: [
      PERMISSIONS.VIEW_PERSONAL_DASHBOARD,
      PERMISSIONS.VIEW_MY_DAY,
      PERMISSIONS.MANAGE_OWN_LEADS,
      PERMISSIONS.VIEW_LEADS,
      PERMISSIONS.VIEW_APPLICATIONS,
      PERMISSIONS.VIEW_CHAT_INBOX,
      PERMISSIONS.VIEW_OWN_CONVERSATIONS,
      PERMISSIONS.REPLY_OWN_CHANNELS,
      PERMISSIONS.REPLY_ALL_CHANNELS,   // Can reply to all channels but own WhatsApp only
      PERMISSIONS.VIEW_BROADCASTS,
    ],
  },
  application_manager: {
    label: 'Application Manager',
    badgeColor: 'bg-amber-100 text-amber-700',
    permissions: [
      PERMISSIONS.VIEW_PERSONAL_DASHBOARD,
      PERMISSIONS.VIEW_MY_DAY,
      PERMISSIONS.VIEW_LEADS,
      PERMISSIONS.MANAGE_APPLICATIONS,
      PERMISSIONS.VIEW_APPLICATIONS,
      PERMISSIONS.ADD_APPLICATION_CHINA,
      PERMISSIONS.VIEW_CHINA_DATA,
      PERMISSIONS.VIEW_CHINA_APPLICATIONS,
      PERMISSIONS.VIEW_CHAT_INBOX,
      PERMISSIONS.VIEW_ALL_CONVERSATIONS,
      PERMISSIONS.REPLY_ALL_CHANNELS,
      PERMISSIONS.VIEW_BROADCASTS,
      PERMISSIONS.VIEW_ANALYTICS,
    ],
  },
  marketing_manager: {
    label: 'Marketing Manager',
    badgeColor: 'bg-rose-100 text-rose-700',
    permissions: [
      PERMISSIONS.VIEW_PERSONAL_DASHBOARD,
      PERMISSIONS.VIEW_MY_DAY,
      PERMISSIONS.VIEW_LEADS,
      PERMISSIONS.VIEW_APPLICATIONS,
      PERMISSIONS.VIEW_CHAT_INBOX,
      PERMISSIONS.VIEW_ALL_CONVERSATIONS,
      PERMISSIONS.REPLY_ALL_CHANNELS,
      PERMISSIONS.MANAGE_MARKETING,
      PERMISSIONS.VIEW_MARKETING,
      PERMISSIONS.MANAGE_AUTOMATION,
      PERMISSIONS.VIEW_AUTOMATION,
      PERMISSIONS.SEND_BROADCASTS,
      PERMISSIONS.VIEW_BROADCASTS,
      PERMISSIONS.VIEW_ANALYTICS,
    ],
  },
};

// ─── Navigation Items (route + icon key + label + required permission) ─────
export const NAV_ITEMS = [
  {
    id: 'executive_dashboard',
    to: '/',
    icon: 'LayoutDashboard',
    label: 'Executive Dashboard',
    permission: PERMISSIONS.VIEW_EXECUTIVE_DASHBOARD,
    roles: ['founder_ceo', 'managing_director', 'investor'],
  },
  {
    id: 'personal_dashboard',
    to: '/',
    icon: 'LayoutDashboard',
    label: 'My Dashboard',
    permission: PERMISSIONS.VIEW_PERSONAL_DASHBOARD,
    roles: ['consultant', 'application_manager', 'marketing_manager'],
  },
  {
    id: 'cockpit',
    to: '/cockpit',
    icon: 'Eye',
    label: 'Executive Cockpit',
    permission: PERMISSIONS.VIEW_COCKPIT,
    roles: ['founder_ceo', 'managing_director'],
  },
  {
    id: 'reports',
    to: '/reports',
    icon: 'FileBarChart',
    label: 'Reports & Analytics',
    permission: PERMISSIONS.VIEW_REPORTS,
    roles: ['founder_ceo', 'managing_director', 'investor', 'marketing_manager', 'application_manager'],
  },
  {
    id: 'my_day',
    to: '/my-day',
    icon: 'Sun',
    label: 'Daily Workspace',
    permission: PERMISSIONS.VIEW_MY_DAY,
    roles: ['founder_ceo', 'managing_director', 'investor', 'consultant', 'application_manager', 'marketing_manager'],
  },
  {
    id: 'leads',
    to: '/leads',
    icon: 'Users',
    label: 'Leads & Pipeline',
    permission: PERMISSIONS.VIEW_LEADS,
    roles: ['founder_ceo', 'managing_director', 'investor', 'consultant', 'application_manager', 'marketing_manager'],
  },
  {
    id: 'applications',
    to: '/applications',
    icon: 'Plane',
    label: 'Applications Hub',
    permission: PERMISSIONS.VIEW_APPLICATIONS,
    roles: ['founder_ceo', 'managing_director', 'investor', 'consultant', 'application_manager', 'marketing_manager'],
  },
  {
    id: 'add_application_china',
    to: '/applications?action=add&region=china',
    icon: 'PlusCircle',
    label: 'Add Application (China)',
    permission: PERMISSIONS.ADD_APPLICATION_CHINA,
    roles: ['founder_ceo', 'application_manager'],
    // Special: only shown when user has application_manager role and is on China tab
    isAction: true,
  },
  {
    id: 'chat_inbox',
    to: '/conversations',
    icon: 'MessageSquare',
    label: 'Chat Inbox',
    permission: PERMISSIONS.VIEW_CHAT_INBOX,
    roles: ['founder_ceo', 'managing_director', 'investor', 'consultant', 'application_manager', 'marketing_manager'],
  },
  {
    id: 'marketing',
    to: '/marketing',
    icon: 'Megaphone',
    label: 'Marketing Hub',
    permission: PERMISSIONS.VIEW_MARKETING,
    roles: ['founder_ceo', 'managing_director', 'marketing_manager'],
  },
  {
    id: 'automation',
    to: '/automation',
    icon: 'Zap',
    label: 'Automation Hub',
    permission: PERMISSIONS.VIEW_AUTOMATION,
    roles: ['founder_ceo', 'managing_director', 'marketing_manager'],
  },
  {
    id: 'finance',
    to: '/finance',
    icon: 'DollarSign',
    label: 'Finance',
    permission: PERMISSIONS.VIEW_FINANCE,
    roles: ['founder_ceo', 'managing_director', 'investor'],
  },
  {
    id: 'hr',
    to: '/hr',
    icon: 'UserCheck',
    label: 'HR',
    permission: PERMISSIONS.VIEW_HR,
    roles: ['founder_ceo', 'managing_director'],
  },
  {
    id: 'destinations',
    to: '/destinations',
    icon: 'Globe',
    label: 'Destinations',
    permission: PERMISSIONS.MANAGE_SETTINGS,
    roles: ['founder_ceo', 'managing_director'],
  },
  {
    id: 'settings',
    to: '/settings',
    icon: 'Settings',
    label: 'Settings',
    permission: PERMISSIONS.MANAGE_SETTINGS,
    roles: ['founder_ceo', 'managing_director'],
  },
];

// ─── Icon Map (for dynamic import or string-based lookup) ───────────────────
// These are the Lucide icon names used in NAV_ITEMS
export const ICON_NAMES = [
  'LayoutDashboard', 'Eye', 'FileBarChart', 'Sun', 'Users', 'Plane',
  'PlusCircle', 'MessageSquare', 'Megaphone', 'Zap', 'DollarSign',
  'UserCheck', 'Settings', 'Globe',
];

// ─── Permission Helpers ─────────────────────────────────────────────────────

/**
 * Get all permissions for a list of role keys.
 * Returns a Set of unique permissions.
 */
export function getPermissionsForRoles(roleKeys) {
  const perms = new Set();
  for (const key of roleKeys) {
    const def = ROLE_DEFS[key];
    if (def?.permissions) {
      for (const p of def.permissions) perms.add(p);
    }
  }
  return perms;
}

/**
 * Check if a user (with roles array) has a specific permission.
 */
export function hasPermission(user, permission) {
  if (!user?.roles || !Array.isArray(user.roles)) return false;
  const perms = getPermissionsForRoles(user.roles);
  return perms.has(permission);
}

/**
 * Check if a user has ANY of the given permissions.
 */
export function hasAnyPermission(user, ...permissions) {
  if (!user?.roles || !Array.isArray(user.roles)) return false;
  const perms = getPermissionsForRoles(user.roles);
  return permissions.some(p => perms.has(p));
}

/**
 * Check if a user has ALL of the given permissions.
 */
export function hasAllPermissions(user, ...permissions) {
  if (!user?.roles || !Array.isArray(user.roles)) return false;
  const perms = getPermissionsForRoles(user.roles);
  return permissions.every(p => perms.has(p));
}

/**
 * Normalize a user's roles array. If missing/empty/invalid, fall back to the legacy
 * single-role field so the navigation and permission checks never break.
 */
export function normalizeUserRoles(user) {
  if (!user) return user;
  const hasValidRoles = Array.isArray(user.roles) && user.roles.length > 0 && user.roles.some(r => ROLE_DEFS[r]);
  if (!hasValidRoles) {
    return { ...user, roles: legacyRoleToRoles(user.role) };
  }
  return user;
}

/**
 * Get navigation items filtered for a user's roles.
 * Returns items the user is allowed to see, deduplicated by route.
 */
export function getNavForUser(user) {
  if (!user?.roles || !Array.isArray(user.roles)) return [];
  const perms = getPermissionsForRoles(user.roles);

  // Filter by permission and role
  const visible = NAV_ITEMS.filter(item => {
    const hasPerm = perms.has(item.permission);
    const hasRole = item.roles.some(r => user.roles.includes(r));
    return hasPerm && hasRole;
  });

  // Deduplicate by route — if multiple roles grant the same route, keep first
  const seen = new Set();
  const deduped = [];
  for (const item of visible) {
    if (seen.has(item.to)) continue;
    seen.add(item.to);
    deduped.push(item);
  }

  return deduped;
}

/**
 * Get the primary role label for display (uses the highest-priority role).
 */
export function getPrimaryRoleLabel(user) {
  if (!user?.roles || !Array.isArray(user.roles)) return 'User';
  const priority = ['founder_ceo', 'managing_director', 'investor', 'application_manager', 'marketing_manager', 'consultant'];
  for (const r of priority) {
    if (user.roles.includes(r)) return ROLE_DEFS[r]?.label || r;
  }
  return 'User';
}

/**
 * Get the badge color class for a user's primary role.
 */
export function getPrimaryRoleBadgeClass(user) {
  if (!user?.roles || !Array.isArray(user.roles)) return 'bg-slate-100 text-slate-700';
  const priority = ['founder_ceo', 'managing_director', 'investor', 'application_manager', 'marketing_manager', 'consultant'];
  for (const r of priority) {
    if (user.roles.includes(r)) return ROLE_DEFS[r]?.badgeColor || 'bg-slate-100 text-slate-700';
  }
  return 'bg-slate-100 text-slate-700';
}

/**
 * Check if a user has a specific role.
 */
export function userHasRole(user, role) {
  if (!user?.roles || !Array.isArray(user.roles)) return false;
  return user.roles.includes(role);
}

/**
 * Check if a user has any of the given roles.
 */
export function userHasAnyRole(user, ...roles) {
  if (!user?.roles || !Array.isArray(user.roles)) return false;
  return roles.some(r => user.roles.includes(r));
}

/**
 * Check if user has full admin access (Founder, MD, or legacy admin).
 */
export function isFullAdmin(user) {
  if (!user) return false;
  if (user.role === 'admin') return true; // Legacy support
  const roles = user.roles || [];
  return roles.includes('founder_ceo') || roles.includes('managing_director');
}

/**
 * Check if user is an investor (read-only executive).
 */
export function isInvestor(user) {
  if (!user) return false;
  const roles = user.roles || [];
  return roles.includes('investor');
}

/**
 * Check if user can access a specific conversation.
 * Rules:
 *   - Full admins (Founder & CEO, Managing Director, Admin): ALL conversations
 *   - Application Manager, Marketing Manager, and any role with VIEW_ALL_CONVERSATIONS: ALL conversations
 *   - Consultant: own WhatsApp conversations ONLY + all other public channel conversations (Messenger, Instagram, TikTok, etc.)
 *   - Investor: no conversations (view-only role)
 */
export function canAccessConversation(user, conversation) {
  if (!user) return false;
  if (isFullAdmin(user)) return true;
  if (canViewAllConversations(user)) return true;

  // Consultant: all public channels + own WhatsApp only
  if (user.roles?.includes('consultant')) {
    const channelType = conversation?.channel_type || 'whatsapp';
    if (channelType === 'whatsapp' || channelType === 'waba') {
      // Only their own WhatsApp account (matched by channel consultant name or assigned_to)
      return conversation?.assigned_to === user.id ||
             conversation?.channel_consultant === user.consultant_name ||
             conversation?.consultant === user.consultant_name;
    }
    // All other channels (Messenger, Instagram, TikTok, etc.) are public
    return true;
  }

  return false;
}

/**
 * Check if user can view all conversations (all channels, all consultants' WhatsApp).
 * Full admins + Application Manager + Marketing Manager + any role with VIEW_ALL_CONVERSATIONS permission.
 */
export function canViewAllConversations(user) {
  if (!user) return false;
  if (isFullAdmin(user)) return true;
  return hasPermission(user, PERMISSIONS.VIEW_ALL_CONVERSATIONS) ||
         userHasAnyRole(user, 'application_manager', 'marketing_manager');
}

/**
 * Check if user can view China applications specifically.
 */
export function canViewChinaApplications(user) {
  return userHasRole(user, 'founder_ceo') || userHasRole(user, 'application_manager');
}

/**
 * Check if user can view China data (applications, leads, stats).
 * Only Founder & CEO and Application Manager can access China data.
 * Managing Director, Consultants, Investors, and Marketing Managers cannot see China data.
 */
export function canViewChinaData(user) {
  return userHasRole(user, 'founder_ceo') || userHasRole(user, 'application_manager');
}

/**
 * Check if user can add China applications.
 */
export function canAddChinaApplication(user) {
  return hasPermission(user, PERMISSIONS.ADD_APPLICATION_CHINA) ||
         hasPermission(user, PERMISSIONS.MANAGE_APPLICATIONS) ||
         isFullAdmin(user);
}

/**
 * Check if user can view the leaderboard/performance data.
 */
export function canViewLeaderboard(user) {
  return isFullAdmin(user) || isInvestor(user) || hasPermission(user, PERMISSIONS.VIEW_ANALYTICS);
}

/**
 * Check if user can only view own leads.
 */
export function canViewOwnLeadsOnly(user) {
  return !canViewAllLeads(user) && hasPermission(user, PERMISSIONS.MANAGE_OWN_LEADS);
}

/**
 * Check if user can manage (create/edit/delete) channel accounts.
 */
export function canManageChannelAccounts(user) {
  return isFullAdmin(user) || hasPermission(user, PERMISSIONS.MANAGE_CHANNEL_ACCOUNTS);
}

/**
 * Check if user can view reports.
 */
export function canViewReports(user) {
  return isFullAdmin(user) || isInvestor(user) || userHasAnyRole(user, 'application_manager', 'marketing_manager');
}

/**
 * Check if user can view automation hub.
 */
export function canViewAutomation(user) {
  return isFullAdmin(user) || userHasRole(user, 'marketing_manager');
}

/**
 * Check if user can view all leads.
 */
export function canViewAllLeads(user) {
  return isFullAdmin(user) || isInvestor(user) || userHasAnyRole(user, 'application_manager', 'marketing_manager');
}

/**
 * Check if user can manage applications.
 */
export function canManageApplications(user) {
  return isFullAdmin(user) || userHasRole(user, 'application_manager');
}

/**
 * Check if user can manage marketing.
 */
export function canManageMarketing(user) {
  return isFullAdmin(user) || userHasRole(user, 'marketing_manager');
}

/**
 * For legacy compatibility: map old single-role string to new roles array.
 */
export function legacyRoleToRoles(oldRole) {
  switch (oldRole) {
    case 'admin':    return ['founder_ceo'];
    case 'manager':  return ['application_manager'];
    case 'consultant': return ['consultant'];
    default:         return ['consultant'];
  }
}

/**
 * Map new roles array to legacy single role (for backward compatibility).
 * Returns the highest-priority role.
 */
export function rolesToLegacyRole(roles) {
  if (!roles || !Array.isArray(roles)) return 'consultant';
  if (roles.includes('founder_ceo')) return 'admin';
  if (roles.includes('managing_director')) return 'admin';
  if (roles.includes('investor')) return 'admin'; // Investors get admin-level data access
  if (roles.includes('application_manager')) return 'manager';
  if (roles.includes('marketing_manager')) return 'manager';
  if (roles.includes('consultant')) return 'consultant';
  return 'consultant';
}
