import {
  Activity, Award, BarChart3, Bell, Building2, ClipboardList, FileSpreadsheet, History, LayoutDashboard, ListChecks,
  Receipt, Settings, Users, Wallet, Globe2,
} from 'lucide-react';

// Sidebar navigation for each role. `badge` names a count from /api/stats/badges.
const account = {
  label: 'Account',
  items: [
    { to: '/notifications', label: 'Notifications', icon: Bell, badge: 'unread' },
    { to: '/account', label: 'Account settings', icon: Settings },
  ],
};

export const NAV = {
  student: [
    {
      label: 'My clearance',
      items: [
        { to: '/student', label: 'Overview', icon: LayoutDashboard, end: true },
        { to: '/student/clearance', label: 'Clearance request', icon: ListChecks },
        { to: '/student/dues', label: 'Dues & payments', icon: Wallet, badge: 'openDues', tone: 'warn' },
        { to: '/student/certificate', label: 'Certificate', icon: Award },
      ],
    },
    account,
  ],
  officer: [
    {
      label: 'Department desk',
      items: [
        { to: '/officer', label: 'Overview', icon: LayoutDashboard, end: true },
        { to: '/officer/requests', label: 'Clearance requests', icon: ClipboardList, badge: 'pending' },
        { to: '/officer/receipts', label: 'Receipts to verify', icon: Receipt, badge: 'receipts', tone: 'warn' },
        { to: '/officer/dues', label: 'Dues register', icon: Wallet },
        { to: '/officer/activity', label: 'Activity history', icon: History },
      ],
    },
    account,
  ],
  admin: [
    {
      label: 'Clearance',
      items: [
        { to: '/admin', label: 'Overview', icon: LayoutDashboard, end: true },
        { to: '/admin/requests', label: 'All requests', icon: ClipboardList, badge: 'active' },
        { to: '/admin/reports', label: 'Reports', icon: BarChart3 },
      ],
    },
    {
      label: 'People & setup',
      items: [
        { to: '/admin/students', label: 'Official student list', icon: FileSpreadsheet },
        { to: '/admin/users', label: 'Users & staff', icon: Users },
        { to: '/admin/departments', label: 'Departments', icon: Building2 },
        { to: '/admin/audit', label: 'Audit log', icon: Activity },
      ],
    },
    account,
  ],
  superadmin: [
    {
      label: 'Platform',
      items: [
        { to: '/platform', label: 'Overview', icon: LayoutDashboard, end: true },
        { to: '/platform/universities', label: 'Universities', icon: Globe2 },
        { to: '/platform/audit', label: 'Audit log', icon: Activity },
      ],
    },
    account,
  ],
};

// Title shown in the top bar for the current address
export const titleFor = (role, pathname) => {
  for (const group of NAV[role] || []) {
    const hit = group.items
      .filter((i) => (i.end ? pathname === i.to : pathname === i.to || pathname.startsWith(`${i.to}/`)))
      .sort((a, b) => b.to.length - a.to.length)[0];
    if (hit) return { section: group.label, title: hit.label };
  }
  return { section: '', title: '' };
};
