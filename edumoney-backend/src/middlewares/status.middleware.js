export const requireActiveStatus = (req, res, next) => {
  if (req.user && req.user.status === 'inativo') {
    return res.status(403).json({
      message:
        'Acesso bloqueado. Conta inactiva. Por favor, defina o PIN nas configurações de segurança para ativar a sua conta.',
      status: 'inativo',
      requiresActivation: true,
    });
  }
  next();
};
