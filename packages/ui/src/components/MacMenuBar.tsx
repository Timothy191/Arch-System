'use client';

import React from 'react';
import { OperationsAppBar, type OperationsAppBarProps } from './header/OperationsAppBar';

export interface MacMenuBarProps extends OperationsAppBarProps {
  menuItems?: readonly string[];
  centerSlot?: React.ReactNode;
}

/**
 * MacMenuBar
 *
 * Modernized industrial operations app bar that satisfies legacy MacMenuBar
 * imports while rendering the new 3-zone operations app bar.
 */
export function MacMenuBar({ centerSlot, rightSlot, className, ...props }: MacMenuBarProps) {
  return <OperationsAppBar className={className} rightSlot={rightSlot} {...props} />;
}
