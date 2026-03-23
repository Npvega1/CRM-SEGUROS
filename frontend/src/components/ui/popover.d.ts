import * as React from 'react';

export interface PopoverProps {
  children?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  defaultOpen?: boolean;
  modal?: boolean;
}

export interface PopoverTriggerProps {
  children?: React.ReactNode;
  asChild?: boolean;
}

export interface PopoverContentProps {
  children?: React.ReactNode;
  className?: string;
  align?: 'start' | 'center' | 'end';
  sideOffset?: number;
  side?: 'top' | 'right' | 'bottom' | 'left';
  'data-testid'?: string;
}

export interface PopoverAnchorProps {
  children?: React.ReactNode;
}

export const Popover: React.FC<PopoverProps>;
export const PopoverTrigger: React.FC<PopoverTriggerProps>;
export const PopoverContent: React.FC<PopoverContentProps>;
export const PopoverAnchor: React.FC<PopoverAnchorProps>;
