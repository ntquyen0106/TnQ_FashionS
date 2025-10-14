import { toast } from 'react-hot-toast';
import React from 'react';
import AddToCartToast from './AddToCartToast.jsx';

let currentToastId = null;

export function showAddToCartToast({
  name,
  variantText,
  price,
  imageUrl,
  duration = 2500,
  onViewCart,
}) {
  if (currentToastId) toast.dismiss(currentToastId);
  currentToastId = toast.custom(
    (t) => (
      <AddToCartToast
        name={name}
        variantText={variantText}
        price={price}
        imageUrl={imageUrl}
        onViewCart={onViewCart}
        onClose={() => toast.dismiss(t.id)}
      />
    ),
    { id: 'add-to-cart', duration, position: 'top-right' },
  );
}
