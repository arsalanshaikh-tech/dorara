import { z } from "zod";

/**
 * Zod schema for the login form. Mirrors the payload expected by
 * POST /api/v1/auth/login: { email, password }.
 */
export const loginSchema = z.object({
  email: z
    .string()
    .min(1, { message: "Email is required" })
    .email({ message: "Enter a valid email address" }),
  password: z
    .string()
    .min(1, { message: "Password is required" })
    .min(8, { message: "Password must be at least 8 characters" }),
  remember: z.boolean().optional().default(false),
});

export type LoginValues = z.infer<typeof loginSchema>;

const passwordField = z
  .string()
  .min(1, { message: "Password is required" })
  .min(8, { message: "Password must be at least 8 characters" });

/**
 * Sign up form schema. Mirrors POST /api/v1/auth/register.
 */
export const signupSchema = z
  .object({
    name: z
      .string()
      .min(1, { message: "Full name is required" })
      .min(2, { message: "Please enter your full name" }),
    email: z
      .string()
      .min(1, { message: "Email is required" })
      .email({ message: "Enter a valid email address" }),
    password: passwordField,
    confirmPassword: z.string().min(1, { message: "Please confirm your password" }),
    terms: z.literal(true, {
      message: "You must accept the terms to continue",
    }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match",
  });

export type SignupValues = z.infer<typeof signupSchema>;

/**
 * Forgot password schema. Mirrors POST /api/v1/auth/forgot-password.
 */
export const forgotPasswordSchema = z.object({
  email: z
    .string()
    .min(1, { message: "Email is required" })
    .email({ message: "Enter a valid email address" }),
});

export type ForgotPasswordValues = z.infer<typeof forgotPasswordSchema>;

/**
 * Reset password schema. Mirrors POST /api/v1/auth/reset-password.
 */
export const resetPasswordSchema = z
  .object({
    password: passwordField,
    confirmPassword: z.string().min(1, { message: "Please confirm your password" }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match",
  });

export type ResetPasswordValues = z.infer<typeof resetPasswordSchema>;

/**
 * Profile details schema. Mirrors PATCH /api/v1/users/me.
 */
export const profileSchema = z.object({
  name: z
    .string()
    .min(1, { message: "Full name is required" })
    .min(2, { message: "Please enter your full name" }),
  email: z
    .string()
    .min(1, { message: "Email is required" })
    .email({ message: "Enter a valid email address" }),
  location: z.string().optional().default(""),
  bio: z.string().max(280, { message: "Bio must be 280 characters or fewer" }).optional().default(""),
});

export type ProfileValues = z.infer<typeof profileSchema>;

/**
 * Change password schema. Mirrors POST /api/v1/users/me/password.
 */
export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, { message: "Enter your current password" }),
    newPassword: passwordField,
    confirmPassword: z.string().min(1, { message: "Please confirm your new password" }),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match",
  });

export type ChangePasswordValues = z.infer<typeof changePasswordSchema>;
