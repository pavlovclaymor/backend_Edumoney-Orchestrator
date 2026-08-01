export const generateRUPE = () => {
  const timestamp = Date.now().toString(); // 13 dígitos
  const random = Math.floor(1000000 + Math.random() * 9000000); // 7 dígitos
  return `${timestamp}${random}`;
};

// Simula apenas a lógica de sucesso/falha sem enviar callback automático.
// Em produção, substituir por integração real com o gateway RUPE angolano.
export const simulateRupePayment = async (_rupeReference, _amount) => {
  // 90% de chance de sucesso
  return Math.random() < 0.9 ? 'success' : 'failed';
};
