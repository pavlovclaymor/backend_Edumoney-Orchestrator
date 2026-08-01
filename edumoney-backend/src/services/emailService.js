import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER || 'comerciapavsoftware@gmail.com',
    pass: process.env.EMAIL_PASS, // App password should be added to .env
  },
});

export const sendVerificationEmail = async (to, code) => {
  const mailOptions = {
    from: `"Edumony" <${process.env.EMAIL_USER || 'comerciapavsoftware@gmail.com'}>`,
    to,
    subject: 'Edumony - Código de Verificação de Email',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
        <h2 style="color: #4CAF50; text-align: center;">Verificação de Email</h2>
        <p>Olá,</p>
        <p>Você solicitou a adição/alteração do seu email no sistema Edumony.</p>
        <p>Seu código de verificação é:</p>
        <div style="text-align: center; margin: 30px 0;">
          <span style="font-size: 32px; font-weight: bold; letter-spacing: 5px; background-color: #f5f5f5; padding: 10px 20px; border-radius: 5px;">${code}</span>
        </div>
        <p>Este código expira em 10 minutos.</p>
        <p>Se você não solicitou esta alteração, ignore este email.</p>
      </div>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`Email de verificação enviado para ${to}`);
  } catch (error) {
    console.error('Erro ao enviar email de verificação:', error);
    throw new Error('Não foi possível enviar o email de verificação.');
  }
};

export const sendPasswordResetEmail = async (to, code) => {
  const mailOptions = {
    from: `"Edumony" <${process.env.EMAIL_USER || 'comerciapavsoftware@gmail.com'}>`,
    to,
    subject: 'Edumony - Recuperação de Senha',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
        <h2 style="color: #4CAF50; text-align: center;">Recuperação de Senha</h2>
        <p>Olá,</p>
        <p>Você solicitou a redefinição de sua senha.</p>
        <p>Seu código para redefinir a senha é:</p>
        <div style="text-align: center; margin: 30px 0;">
          <span style="font-size: 32px; font-weight: bold; letter-spacing: 5px; background-color: #f5f5f5; padding: 10px 20px; border-radius: 5px;">${code}</span>
        </div>
        <p>Este código expira em 10 minutos.</p>
        <p>Se você não solicitou a redefinição de senha, ignore este email e sua senha permanecerá a mesma.</p>
      </div>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`Email de recuperação de senha enviado para ${to}`);
  } catch (error) {
    console.error('Erro ao enviar email de recuperação:', error);
    throw new Error('Não foi possível enviar o email de recuperação de senha.');
  }
};
