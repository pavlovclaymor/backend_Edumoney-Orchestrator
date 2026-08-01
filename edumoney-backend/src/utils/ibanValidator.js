export const validateAngolaIBAN = (iban) => {
  if (!iban) return false;

  // Remove espaços e deixa maiúsculo
  const cleanIban = iban.replace(/\s+/g, '').toUpperCase();

  //  Verifica país e tamanho
  if (!cleanIban.startsWith('AO')) return false;
  if (cleanIban.length !== 25) return false;

  //  Move os 4 primeiros caracteres para o final
  const rearranged = cleanIban.slice(4) + cleanIban.slice(0, 4);

  //  Converte letras para números (A=10, B=11...)
  const numericIban = rearranged
    .split('')
    .map((char) => {
      if (/[A-Z]/.test(char)) {
        return char.charCodeAt(0) - 55;
      }
      return char;
    })
    .join('');

  //  MOD 97
  let remainder = numericIban;

  while (remainder.length > 2) {
    const block = remainder.slice(0, 9);
    remainder = (parseInt(block, 10) % 97) + remainder.slice(block.length);
  }

  return parseInt(remainder, 10) % 97 === 1;
};
