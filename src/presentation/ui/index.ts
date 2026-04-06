/**
 * Design System barrel export.
 *
 * Import all UI primitives from a single location:
 *
 *   import { Button, Input, Card, Badge } from "@/presentation/ui";
 *
 * Components are pure presentational — no business logic, no API calls.
 * They consume only props and the global Tailwind design tokens.
 */

export { Button, Spinner } from "./Button";
export type { ButtonProps } from "./Button";

export { Input } from "./Input";
export type { InputProps } from "./Input";

export { Select } from "./Select";
export type { SelectProps, SelectOption } from "./Select";

export { Card } from "./Card";
export type { CardProps } from "./Card";

export { Badge } from "./Badge";
export type { BadgeProps, BadgeVariant } from "./Badge";

export { SkeletonRows, SkeletonBlock, PageLoader } from "./Loader";

export { EmptyState } from "./EmptyState";
export type { EmptyStateProps } from "./EmptyState";

export { theme } from "./theme";

export { Avatar } from "./Avatar";
export type { AvatarProps } from "./Avatar";

export { Dropdown, DropdownItem, DropdownSeparator, DropdownLabel } from "./Dropdown";
export type { DropdownProps, DropdownItemProps } from "./Dropdown";

export { RoleTagInput } from "./RoleTagInput";
export type { RoleTagInputProps } from "./RoleTagInput";

export { OrgBadge, OrgBadgeOrDash } from "./OrgBadge";
export type { OrgBadgeProps, OrgBadgeVariant } from "./OrgBadge";
