import * as React from 'react';

export interface DropdownMenuProps {
  children?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  defaultOpen?: boolean;
  modal?: boolean;
}

export interface DropdownMenuTriggerProps {
  children?: React.ReactNode;
  asChild?: boolean;
}

export interface DropdownMenuContentProps {
  children?: React.ReactNode;
  className?: string;
  align?: 'start' | 'center' | 'end';
  sideOffset?: number;
  side?: 'top' | 'right' | 'bottom' | 'left';
}

export interface DropdownMenuItemProps {
  children?: React.ReactNode;
  className?: string;
  onClick?: () => void;
  disabled?: boolean;
  inset?: boolean;
}

export interface DropdownMenuLabelProps {
  children?: React.ReactNode;
  className?: string;
  inset?: boolean;
}

export interface DropdownMenuSeparatorProps {
  className?: string;
}

export const DropdownMenu: React.FC<DropdownMenuProps>;
export const DropdownMenuTrigger: React.FC<DropdownMenuTriggerProps>;
export const DropdownMenuContent: React.FC<DropdownMenuContentProps>;
export const DropdownMenuItem: React.FC<DropdownMenuItemProps>;
export const DropdownMenuCheckboxItem: React.FC<DropdownMenuItemProps & { checked?: boolean }>;
export const DropdownMenuRadioItem: React.FC<DropdownMenuItemProps>;
export const DropdownMenuLabel: React.FC<DropdownMenuLabelProps>;
export const DropdownMenuSeparator: React.FC<DropdownMenuSeparatorProps>;
export const DropdownMenuShortcut: React.FC<{ className?: string; children?: React.ReactNode }>;
export const DropdownMenuGroup: React.FC<{ children?: React.ReactNode }>;
export const DropdownMenuPortal: React.FC<{ children?: React.ReactNode }>;
export const DropdownMenuSub: React.FC<{ children?: React.ReactNode }>;
export const DropdownMenuSubContent: React.FC<DropdownMenuContentProps>;
export const DropdownMenuSubTrigger: React.FC<DropdownMenuTriggerProps & { inset?: boolean }>;
export const DropdownMenuRadioGroup: React.FC<{ children?: React.ReactNode; value?: string; onValueChange?: (value: string) => void }>;
