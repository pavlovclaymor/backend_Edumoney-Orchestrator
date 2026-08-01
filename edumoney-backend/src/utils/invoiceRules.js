export const canGeneratePdf = (invoice) => {
  return invoice.status === 'paid' || invoice.paymentMethod === 'cash';
};
