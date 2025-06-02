import { Grid, type GridProps } from '@mui/material';
import type { ReactNode } from 'react';

interface Props extends Omit<GridProps, 'item'> {
  children: ReactNode;
}

export const GridItem = ({ children, ...props }: Props) => (
  <Grid item {...props}>
    {children}
  </Grid>
);