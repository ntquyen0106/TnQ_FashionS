import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
} from '@mui/material';

export default function SuccessModal({ open, title = 'Thành công', message = '', onClose }) {
  return (
    <Dialog open={Boolean(open)} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        <Typography variant="body1">{message}</Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} autoFocus>
          Đóng
        </Button>
      </DialogActions>
    </Dialog>
  );
}
