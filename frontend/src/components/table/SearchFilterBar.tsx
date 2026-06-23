// src/components/table/SearchFilterBar.tsx
// Toolbar above tables: a debounced search box plus arbitrary filter slots (passed as
// children, typically Selects bound to useServerTable.setFilter).

import { Box, InputAdornment, Stack, TextField } from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import { useEffect, useRef, useState, type ReactNode } from 'react';

interface Props {
  search: string;
  onSearch: (value: string) => void;
  placeholder?: string;
  children?: ReactNode; // filter controls
  action?: ReactNode; // right-aligned primary action (e.g. "New")
}

export function SearchFilterBar({ search, onSearch, placeholder = 'Search…', children, action }: Props) {
  const [value, setValue] = useState(search);
  const timer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => setValue(search), [search]);

  const handleChange = (next: string) => {
    setValue(next);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => onSearch(next), 350);
  };

  return (
    <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} sx={{ mb: 2 }} alignItems={{ md: 'center' }}>
      <TextField
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        placeholder={placeholder}
        size="small"
        sx={{ minWidth: 260 }}
        InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }}
      />
      {children}
      <Box sx={{ flex: 1 }} />
      {action}
    </Stack>
  );
}
