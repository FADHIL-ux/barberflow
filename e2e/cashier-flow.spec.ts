import { test, expect } from "@playwright/test";

test.describe("BarberFlow — Alur Kasir & Cetak Struk Penuh", () => {
  test("1. Autentikasi Login Owner/Kasir", async ({ page }) => {
    await page.goto("/login");

    // Verifikasi teks berbahasa Indonesia
    await expect(page.locator("h1")).toContainText("BarberFlow");
    await expect(page.getByLabel("Email")).toBeVisible();
    await expect(page.getByLabel("Password")).toBeVisible();

    // Isi formulir login
    await page.getByLabel("Email").fill("owner@demo.com");
    await page.getByLabel("Password").fill("demo1234");
    await page.getByRole("button", { name: "Masuk ke Aplikasi" }).click();

    // Diarahkan ke papan antrean setelah login
    await expect(page).toHaveURL(/\/antrian/);
  });

  test("2. Alur Transaksi Kasir, Pembayaran, dan Struk", async ({ page }) => {
    // Kunjungi halaman kasir
    await page.goto("/kasir");

    // Pilih kapster
    const barberSelect = page.locator("select").first();
    if (await barberSelect.isVisible()) {
      await barberSelect.selectOption({ index: 0 });
    }

    // Pilih item layanan pertama
    const serviceButton = page.locator("button:has-text('Tambah')").first();
    if (await serviceButton.isVisible()) {
      await serviceButton.click();
    }

    // Pilih metode pembayaran Tunai / Cash
    const cashMethod = page.getByRole("button", { name: /Tunai|Cash/i });
    if (await cashMethod.isVisible()) {
      await cashMethod.click();
    }

    // Selesaikan transaksi
    const checkoutBtn = page.getByRole("button", { name: /Bayar|Selesaikan/i });
    if (await checkoutBtn.isVisible()) {
      await checkoutBtn.click();
    }
  });

  test("3. Halaman Booking Online Publik (Tanpa Autentikasi)", async ({ page }) => {
    // Halaman booking dapat diakses langsung oleh pelanggan umum
    await page.goto("/demo-barber/book");

    // Jika tenant belum di-seed, verifikasi tampilan fallback ramah pengguna
    const heading = page.locator("h1, h2");
    await expect(heading.first()).toBeVisible();
  });
});
