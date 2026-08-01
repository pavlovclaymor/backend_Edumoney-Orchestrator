export const processPayment = async ({ from, to, amount }) => {
  try {
    console.log(`Transferindo ${amount} de ${from} para ${to}`);
    //simula tempo de resposta da API bancaria
    await new Promise((r) => setTimeout(r, 1500));

    return { success: true, transactionId: 'Tx-' + Date.now() };
  } catch (error) {
    return { success: false, error: error.message };
  }
};
