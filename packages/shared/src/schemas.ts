import { z } from "zod";

const idr = z.number({ invalid_type_error: "Harga harus berupa angka" }).int("Harga harus bilangan bulat").min(0, "Harga tidak boleh negatif").max(100_000_000, "Harga terlalu besar");
const phone = z
  .string()
  .trim()
  .regex(/^[0-9+]{8,16}$/, "Nomor telepon tidak valid (8-16 digit)");

export const loginSchema = z.object({
  email: z.string().trim().email("Email tidak valid").max(200),
  password: z.string().min(1, "Password wajib diisi").max(200),
});

export const registerSchema = z.object({
  barbershopName: z.string().trim().min(2, "Nama barbershop minimal 2 karakter").max(120),
  ownerName: z.string().trim().min(2, "Nama minimal 2 karakter").max(120),
  email: z.string().trim().email("Email tidak valid").max(200),
  password: z.string().min(10, "Password minimal 10 karakter").max(200),
});

export const serviceSchema = z.object({
  name: z.string().trim().min(2, "Nama layanan minimal 2 karakter").max(80),
  priceIdr: idr,
  durationMinutes: z.number().int().min(5, "Durasi minimal 5 menit").max(480, "Durasi maksimal 480 menit"),
  description: z.string().trim().max(500).default(""),
  isActive: z.boolean().default(true),
});

export const barberSchema = z.object({
  displayName: z.string().trim().min(2, "Nama kapster minimal 2 karakter").max(80),
  phone: phone.nullable().default(null),
  skills: z.array(z.string().trim().min(1).max(40)).max(10).default([]),
  isActive: z.boolean().default(true),
});

export const profileSchema = z.object({
  name: z.string().trim().min(2).max(120),
  address: z.string().trim().max(300),
  phone: phone.nullable(),
  receiptFooter: z.string().trim().max(200),
  paperWidthMm: z.union([z.literal(58), z.literal(80)]),
  openTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Format jam HH:MM"),
  closeTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Format jam HH:MM"),
});

export const productSchema = z.object({
  name: z.string().trim().min(2, "Nama produk minimal 2 karakter").max(80),
  priceIdr: idr,
  stockQuantity: z.number().int().min(0, "Stok tidak boleh negatif").default(0),
  isActive: z.boolean().default(true),
});

export const inviteUserSchema = z.object({
  email: z.string().trim().email("Email tidak valid").max(200),
  fullName: z.string().trim().min(2, "Nama minimal 2 karakter").max(120),
  role: z.enum(["cashier", "barber"], { errorMap: () => ({ message: "Peran tidak valid" }) }),
});

export const updateUserSchema = z.object({
  fullName: z.string().trim().min(2, "Nama minimal 2 karakter").max(120),
  role: z.enum(["cashier", "barber"], { errorMap: () => ({ message: "Peran tidak valid" }) }),
  isActive: z.boolean(),
});

export const addQueueEntrySchema = z.object({
  customerName: z.string().trim().min(1, "Nama pelanggan wajib diisi").max(120),
  barberId: z.string().uuid().nullable().optional(),
  customerId: z.string().uuid().nullable().optional(),
  serviceIds: z.array(z.string().uuid()).min(1, "Pilih minimal satu layanan"),
});

export const transactionItemSchema = z.object({
  kind: z.enum(["service", "product"]),
  refId: z.string().uuid("ID referensi tidak valid"),
  quantity: z.number().int().min(1).max(999),
});

export const createTransactionSchema = z.object({
  barberId: z.string().uuid().optional(),
  customerId: z.string().uuid().optional(),
  queueEntryId: z.string().uuid().optional(),
  items: z.array(transactionItemSchema).min(1, "Transaksi harus memiliki minimal satu item"),
  discountType: z.enum(["none", "percent", "fixed"]).default("none"),
  discountValue: z.number().min(0).default(0),
  paymentMethod: z.enum(["cash", "qris", "transfer"], { errorMap: () => ({ message: "Metode pembayaran tidak valid" }) }),
  idempotencyKey: z.string().min(16).max(100),
  occurredAt: z.string().datetime({ offset: true }).optional(),
});

export const customerSchema = z.object({
  name: z.string().trim().min(1, "Nama pelanggan wajib diisi").max(120),
  phone: z.string().trim().regex(/^[0-9+]{8,16}$/, "Nomor telepon harus 8-16 digit").nullable().optional(),
  hairPreference: z.string().trim().max(300).nullable().optional(),
  favoriteBarberId: z.string().uuid().nullable().optional(),
  notes: z.string().trim().max(500).nullable().optional(),
});

export const customerConsentSchema = z.object({
  purpose: z.enum(["data_processing", "whatsapp_reminder"], {
    errorMap: () => ({ message: "Tujuan persetujuan tidak valid." }),
  }),
  isGranted: z.boolean(),
});

export const commissionRuleSchema = z.object({
  serviceId: z.string().uuid("ID layanan tidak valid"),
  barberId: z.string().uuid("ID kapster tidak valid").nullable().optional(),
  type: z.enum(["percent", "fixed"], { errorMap: () => ({ message: "Tipe komisi harus persen atau fixed" }) }),
  value: z.number().min(0, "Nilai komisi minimal 0"),
}).refine(
  (data) => (data.type === "percent" ? data.value <= 100 : true),
  { message: "Komisi persentase maksimal 100%", path: ["value"] }
);

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type ServiceInput = z.infer<typeof serviceSchema>;
export type BarberInput = z.infer<typeof barberSchema>;
export type ProfileInput = z.infer<typeof profileSchema>;
export type ProductInput = z.infer<typeof productSchema>;
export type InviteUserInput = z.infer<typeof inviteUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type AddQueueEntryInput = z.infer<typeof addQueueEntrySchema>;
export type CreateTransactionInput = z.infer<typeof createTransactionSchema>;
export type CustomerInput = z.infer<typeof customerSchema>;
export type CustomerConsentInput = z.infer<typeof customerConsentSchema>;
export type CommissionRuleInput = z.infer<typeof commissionRuleSchema>;
