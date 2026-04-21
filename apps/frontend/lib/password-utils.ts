export interface PasswordStrength {
  minLength: boolean;
  hasUppercase: boolean;
  hasLowercase: boolean;
  hasNumber: boolean;
}

export function checkPasswordStrength(password: string): PasswordStrength {
  return {
    minLength:    password.length >= 8,
    hasUppercase: /[A-Z]/.test(password),
    hasLowercase: /[a-z]/.test(password),
    hasNumber:    /[0-9]/.test(password),
  };
}

export function validatePassword(password: string): string | null {
  const s = checkPasswordStrength(password);
  if (!s.minLength)    return 'Password must be at least 8 characters';
  if (!s.hasUppercase) return 'Password must contain at least one uppercase letter';
  if (!s.hasLowercase) return 'Password must contain at least one lowercase letter';
  if (!s.hasNumber)    return 'Password must contain at least one number';
  return null;
}

export function isPasswordValid(password: string): boolean {
  return validatePassword(password) === null;
}
