/// <reference types="astro/client" />
declare namespace App {
  interface Locals {
    admin?: { id: string; email: string; name: string; twoFactorEnabled?: boolean | null };
  }
}
