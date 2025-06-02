import { Grid, type GridProps } from '@mui/material';
import type { ElementType } from 'react';

interface CustomGridProps extends Omit<GridProps, 'component'> {
  component?: ElementType;
}

export const CustomGrid = ({ children, ...props }: CustomGridProps) => (
  <Grid component="div" {...props}>
    {children}
  </Grid>
);