export type NavItem = {
  label: string;
  href: string;
};

/**
 * Sidebar menu. Add an entry here when you create a new page under app/(app)/.
 */
export const navigation: NavItem[] = [
  { label: "Dashboard", href: "/dashboard" },
  { label: "Browsers", href: "/browsers" },
  { label: "Campaigns", href: "/campaigns" },
];
