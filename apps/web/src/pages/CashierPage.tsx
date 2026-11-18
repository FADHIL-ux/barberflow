import { useEffect, useState } from "react";
import { api, ApiError } from "../lib/api.ts";
import { generateTempReceiptRef, saveOfflineTransaction } from "../lib/offline.ts";
import { Button } from "../components/ui/Button.tsx";
import { Input } from "../components/ui/Input.tsx";
import { Modal } from "../components/ui/Modal.tsx";

interface ItemOption {
  id: string;
  name: string;
  priceIdr: number;
  kind: "service" | "product";
  stock?: number;
}

interface BarberOption {
  id: string;
  displayName: string;
}

interface QueueOption {
  id: string;
  queueNumber: number;
  customerName: string;
  barberId: string | null;
  services: Array<{ id: string; name: string }>;
}

interface CartItem {
  kind: "service" | "product";
  refId: string;
  name: string;
  priceIdr: number;
  quantity: number;
}

// Data prefill dari halaman Booking
interface BookingPrefill {
  bookingId: string;
  customerName: string;
  barberId: string;
  barberName: string;
  serviceId: string;
  serviceName: string;
  servicePriceIdr: number;
}

interface CreatedReceipt {
  id: string;
  receiptNumber: string;
  publicToken: string;
  totals: {
    subtotalIdr: number;
    discountIdr: number;
    totalIdr: number;
  };
}

export default function CashierPage() {
  const [items, setItems] = useState<ItemOption[]>([]);
  const [barbers, setBarbers] = useState<BarberOption[]>([]);
  const [activeQueue, setActiveQueue] = useState<QueueOption[]>([]);
  const [loading, setLoading] = useState(true);

  // Cart state
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedBarberId, setSelectedBarberId] = useState<string>("");
  const [selectedQueueId, setSelectedQueueId] = useState<string>("");

  // Booking prefill state
  const [bookingPrefill, setBookingPrefill] = useState<BookingPrefill | null>(null);

  // Discount & Payment
  const [discountType, setDiscountType] = useState<"none" | "percent" | "fixed">("none");
  const [discountValue, setDiscountValue] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "qris" | "transfer">("cash");

  // Receipt Modal
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdReceipt, setCreatedReceipt] = useState<CreatedReceipt | null>(null);

  const formatRupiah = (val: number) =>
    new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(val);

  const loadData = async () => {
    try {
      setLoading(true);
      const [svcRes, prodRes, barbRes, qRes] = await Promise.all([
        api.get<{ items: Array<{ id: string; name: string; priceIdr: number; isActive: boolean }> }>("/api/services"),
        api.get<{ items: Array<{ id: string; name: string; priceIdr: number; stockQuantity: number; isActive: boolean }> }>("/api/products"),
        api.get<{ items: BarberOption[] }>("/api/barbers"),
        api.get<{ items: Array<{ id: string; queueNumber: number; customerName: string; barberId: string | null; status: string; services: Array<{ id: string; name: string }> }> }>("/api/queue/today"),
      ]);

      const availableItems: ItemOption[] = [
        ...svcRes.items.filter((s) => s.isActive).map((s) => ({ ...s, kind: "service" as const })),
        ...prodRes.items.filter((p) => p.isActive).map((p) => ({ ...p, kind: "product" as const, stock: p.stockQuantity })),
      ];

      setItems(availableItems);
      setBarbers(barbRes.items);
      setActiveQueue(qRes.items.filter((q) => q.status === "in_service" || q.status === "waiting"));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  // Baca prefill dari booking setelah data dimuat
  useEffect(() => {
    if (loading) return;
    const raw = sessionStorage.getItem("prefillFromBooking");
    if (!raw) return;
    try {
      const prefill = JSON.parse(raw) as BookingPrefill;
      setBookingPrefill(prefill);
      if (prefill.barberId) setSelectedBarberId(prefill.barberId);
      if (prefill.serviceId && prefill.serviceName) {
        const matchedItem = items.find((i) => i.id === prefill.serviceId && i.kind === "service");
        setCart([
          {
            kind: "service",
            refId: prefill.serviceId,
            name: prefill.serviceName,
            priceIdr: matchedItem?.priceIdr ?? prefill.servicePriceIdr,
            quantity: 1,
          },
        ]);
      }
      sessionStorage.removeItem("prefillFromBooking");
    } catch {
      sessionStorage.removeItem("prefillFromBooking");
    }
  }, [loading, items]);

  const addToCart = (item: ItemOption) => {
    setCart((prev) => {
      const idx = prev.findIndex((c) => c.refId === item.id && c.kind === item.kind);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx]!, quantity: next[idx]!.quantity + 1 };
        return next;
      }
      return [...prev, { kind: item.kind, refId: item.id, name: item.name, priceIdr: item.priceIdr, quantity: 1 }];
    });
  };

  const updateQuantity = (refId: string, quantity: number) => {
    if (quantity <= 0) {
      setCart((prev) => prev.filter((c) => c.refId !== refId));
    } else {
      setCart((prev) => prev.map((c) => (c.refId === refId ? { ...c, quantity } : c)));
    }
  };

  // Pilih dari antrean
  const handleSelectQueue = (queueId: string) => {
    setSelectedQueueId(queueId);
    if (!queueId) return;
    const q = activeQueue.find((x) => x.id === queueId);
    if (q) {
      if (q.barberId) setSelectedBarberId(q.barberId);
      // Auto tambahkan layanan yang dipilih saat antrean
      const newCart: CartItem[] = [];
      for (const s of q.services) {
        const match = items.find((i) => i.id === s.id && i.kind === "service");
        if (match) {
          newCart.push({ kind: "service", refId: match.id, name: match.name, priceIdr: match.priceIdr, quantity: 1 });
        }
      }
      setCart(newCart);
    }
  };

  // Kalkulasi harga
  const subtotal = cart.reduce((sum, item) => sum + item.priceIdr * item.quantity, 0);
  let discountAmount = 0;
  if (discountType === "percent") {
    discountAmount = Math.min(subtotal, Math.round((subtotal * discountValue) / 100));
  } else if (discountType === "fixed") {
    discountAmount = Math.min(subtotal, discountValue);
  }
  const total = Math.max(0, subtotal - discountAmount);

  // Proses Transaksi
  const handleCheckout = async () => {
    if (cart.length === 0) {
      alert("Pilih minimal satu layanan atau produk.");
      return;
    }
    setProcessing(true);
    setError(null);

    const idempotencyKey = `web-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    const tempReceiptRef = generateTempReceiptRef();

    // Mode Offline: Simpan langsung ke IndexedDB jika navigator.onLine false
    if (!navigator.onLine) {
      try {
        await saveOfflineTransaction({
          tempReceiptRef,
          idempotencyKey,
          barberId: selectedBarberId ? selectedBarberId : undefined,
          customerId: undefined,
          items: cart.map((c) => ({
            kind: c.kind,
            refId: c.refId,
            quantity: c.quantity,
            name: c.name,
            unitPriceIdr: c.priceIdr,
          })),
          discountType,
          discountValue: Number(discountValue),
          paymentMethod,
          occurredAt: new Date().toISOString(),
          subtotalIdr: subtotal,
          discountIdr: discountAmount,
          totalIdr: total,
        });

        // Tampilkan modal struk offline
        setCreatedReceipt({
          id: idempotencyKey,
          receiptNumber: tempReceiptRef,
          publicToken: "",
          totals: {
            subtotalIdr: subtotal,
            discountIdr: discountAmount,
            totalIdr: total,
          },
        });

        setCart([]);
        setSelectedBarberId("");
        setSelectedQueueId("");
        setDiscountType("none");
        setDiscountValue(0);
        void loadData();
      } catch (err) {
        setError("Gagal menyimpan transaksi offline ke memori lokal.");
      } finally {
        setProcessing(false);
      }
      return;
    }

    try {
      const payload = {
        barberId: selectedBarberId ? selectedBarberId : undefined,
        queueEntryId: selectedQueueId ? selectedQueueId : undefined,
        items: cart.map((c) => ({
          kind: c.kind,
          refId: c.refId,
          quantity: c.quantity,
        })),
        discountType,
        discountValue: Number(discountValue),
        paymentMethod,
        idempotencyKey,
      };

      const res = await api.post<CreatedReceipt>("/api/transactions", payload);
      setCreatedReceipt(res);
      // Jika transaksi dari booking, update status booking → done
      if (bookingPrefill?.bookingId) {
        try {
          await api.patch(`/api/bookings/${bookingPrefill.bookingId}/status`, { status: "done" });
        } catch {
          // Gagal update booking status bukan masalah kritis, transaksi sudah tersimpan
          console.warn("Gagal update status booking setelah pembayaran.");
        }
        setBookingPrefill(null);
      }
      // If datang dari antrean, tandai antrean selesai secara otomatis
      if (selectedQueueId) {
        void api.patch(`/api/queue/${selectedQueueId}/status`, { status: "done" });
      }

      // Reset form kasir
      setCart([]);
      setSelectedBarberId("");
      setSelectedQueueId("");
      setDiscountType("none");
      setDiscountValue(0);
      void loadData();
    } catch (err) {
      // Jika jaringan gagal di tengah checkout, fallback simpan ke offline queue
      if (!window.navigator.onLine || (err instanceof TypeError && err.message.includes("fetch"))) {
        await saveOfflineTransaction({
          tempReceiptRef,
          idempotencyKey,
          barberId: selectedBarberId ? selectedBarberId : undefined,
          items: cart.map((c) => ({
            kind: c.kind,
            refId: c.refId,
            quantity: c.quantity,
            name: c.name,
            unitPriceIdr: c.priceIdr,
          })),
          discountType,
          discountValue: Number(discountValue),
          paymentMethod,
          occurredAt: new Date().toISOString(),
          subtotalIdr: subtotal,
          discountIdr: discountAmount,
          totalIdr: total,
        });

        setCreatedReceipt({
          id: idempotencyKey,
          receiptNumber: tempReceiptRef,
          publicToken: "",
          totals: {
            subtotalIdr: subtotal,
            discountIdr: discountAmount,
            totalIdr: total,
          },
        });
        setCart([]);
        setSelectedBarberId("");
        setSelectedQueueId("");
        setDiscountType("none");
        setDiscountValue(0);
        void loadData();

      } else {
        setError(err instanceof ApiError ? err.message : "Gagal memproses transaksi kasir.");
      }
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#f4f4f5]">Kasir Pembayaran</h1>
        <p className="text-sm text-[#71717a] mt-1">Pilih item, catat metode bayar, dan buat struk digital</p>
      </div>

      {/* Banner info booking yang sedang diproses */}
      {bookingPrefill && (
        <div className="p-4 bg-blue-900/30 border border-blue-700 rounded-2xl flex items-start gap-3">
          <span className="text-2xl">📋</span>
          <div className="flex-1">
            <p className="text-sm font-bold text-blue-300">Pembayaran dari Booking</p>
            <p className="text-xs text-blue-400 mt-0.5">
              Pelanggan: <span className="font-semibold text-[#f4f4f5]">{bookingPrefill.customerName}</span>
              {" · "}Layanan: <span className="font-semibold text-[#f4f4f5]">{bookingPrefill.serviceName}</span>
              {" · "}Kapster: <span className="font-semibold text-[#f4f4f5]">{bookingPrefill.barberName}</span>
            </p>
            <p className="text-xs text-blue-500 mt-1">Keranjang sudah diisi otomatis. Konfirmasi pembayaran dan klik "Bayar &amp; Cetak Struk".</p>
          </div>
          <button
            onClick={() => setBookingPrefill(null)}
            className="text-blue-500 hover:text-blue-300 text-lg leading-none cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-[#71717a]">Memuat katalog kasir...</p>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Kolom Kiri: Katalog Layanan & Produk */}
          <div className="lg:col-span-2 space-y-4">
            {/* Quick Pick dari Antrean */}
            {activeQueue.length > 0 && (
              <div className="p-4 bg-[#1a1a20] rounded-2xl border border-[#27272a] space-y-2">
                <label className="text-xs font-semibold text-[#C6FF3D] uppercase tracking-wider">
                  Ambil dari Antrean Aktif
                </label>
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {activeQueue.map((q) => (
                    <button
                      key={q.id}
                      onClick={() => handleSelectQueue(q.id)}
                      className={`px-3 py-2 rounded-xl text-xs font-medium border text-left whitespace-nowrap transition-colors cursor-pointer ${
                        selectedQueueId === q.id
                          ? "bg-[#C6FF3D] text-[#101014] border-[#C6FF3D]"
                          : "bg-[#27272a] text-[#f4f4f5] border-[#3f3f46] hover:bg-[#3f3f46]"
                      }`}
                    >
                      #{q.queueNumber} - {q.customerName}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* List Layanan */}
            <div className="space-y-3">
              <h2 className="text-base font-semibold text-[#f4f4f5]">Layanan Pangkas & Perawatan</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {items
                  .filter((i) => i.kind === "service")
                  .map((svc) => (
                    <button
                      key={svc.id}
                      onClick={() => addToCart(svc)}
                      className="p-3 bg-[#1a1a20] border border-[#27272a] rounded-xl text-left hover:border-[#C6FF3D] transition-colors flex flex-col justify-between min-h-24 cursor-pointer"
                    >
                      <span className="font-medium text-sm text-[#f4f4f5] line-clamp-2">{svc.name}</span>
                      <span className="text-xs text-[#C6FF3D] font-bold mt-2">{formatRupiah(svc.priceIdr)}</span>
                    </button>
                  ))}
              </div>
            </div>

            {/* List Produk Retail */}
            <div className="space-y-3 pt-4">
              <h2 className="text-base font-semibold text-[#f4f4f5]">Produk Retail</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {items
                  .filter((i) => i.kind === "product")
                  .map((prod) => (
                    <button
                      key={prod.id}
                      onClick={() => addToCart(prod)}
                      className="p-3 bg-[#1a1a20] border border-[#27272a] rounded-xl text-left hover:border-[#C6FF3D] transition-colors flex flex-col justify-between min-h-24 cursor-pointer"
                    >
                      <div>
                        <span className="font-medium text-sm text-[#f4f4f5] line-clamp-2">{prod.name}</span>
                        <span className="text-[10px] text-[#71717a] block mt-0.5">Stok: {prod.stock ?? 0}</span>
                      </div>
                      <span className="text-xs text-[#C6FF3D] font-bold mt-2">{formatRupiah(prod.priceIdr)}</span>
                    </button>
                  ))}
              </div>
            </div>
          </div>

          {/* Kolom Kanan: Keranjang & Pembayaran */}
          <div className="bg-[#1a1a20] rounded-2xl border border-[#27272a] p-5 space-y-4 flex flex-col justify-between h-fit sticky top-4">
            <h2 className="text-lg font-bold text-[#f4f4f5] border-b border-[#27272a] pb-3">
              Rincian Pembayaran
            </h2>

            {error && <div className="p-3 bg-red-900/30 border border-red-800 text-red-400 text-xs rounded-xl">{error}</div>}

            {/* Pilih Kapster */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-[#71717a]">Kapster yang Melayani</label>
              <select
                value={selectedBarberId}
                onChange={(e) => setSelectedBarberId(e.target.value)}
                className="w-full px-3 py-2 bg-[#101014] border border-[#27272a] rounded-xl text-sm text-[#f4f4f5]"
              >
                <option value="">-- Tanpa Kapster / Kasir Saja --</option>
                {barbers.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.displayName}
                  </option>
                ))}
              </select>
            </div>

            {/* Daftar Cart Items */}
            <div className="space-y-2 min-h-32 max-h-56 overflow-y-auto divide-y divide-[#27272a] pr-1">
              {cart.length === 0 ? (
                <p className="text-xs text-[#71717a] text-center py-8">Keranjang belanja masih kosong</p>
              ) : (
                cart.map((c) => (
                  <div key={c.refId} className="pt-2 flex justify-between items-center text-sm">
                    <div className="flex-1 pr-2">
                      <div className="text-[#f4f4f5] font-medium leading-tight">{c.name}</div>
                      <span className="text-xs text-[#71717a]">{formatRupiah(c.priceIdr)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => updateQuantity(c.refId, c.quantity - 1)}
                        className="w-7 h-7 bg-[#27272a] hover:bg-[#3f3f46] text-[#f4f4f5] rounded-lg flex items-center justify-center cursor-pointer"
                      >
                        -
                      </button>
                      <span className="text-sm font-semibold w-4 text-center">{c.quantity}</span>
                      <button
                        onClick={() => updateQuantity(c.refId, c.quantity + 1)}
                        className="w-7 h-7 bg-[#27272a] hover:bg-[#3f3f46] text-[#f4f4f5] rounded-lg flex items-center justify-center cursor-pointer"
                      >
                        +
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Diskon */}
            <div className="space-y-2 pt-2 border-t border-[#27272a]">
              <div className="flex justify-between items-center text-xs">
                <span className="text-[#71717a]">Diskon / Potongan</span>
                <div className="flex gap-1">
                  <button
                    onClick={() => { setDiscountType("none"); setDiscountValue(0); }}
                    className={`px-2 py-1 rounded text-[10px] ${discountType === "none" ? "bg-[#C6FF3D] text-[#101014]" : "bg-[#27272a]"}`}
                  >
                    Tidak
                  </button>
                  <button
                    onClick={() => { setDiscountType("percent"); setDiscountValue(10); }}
                    className={`px-2 py-1 rounded text-[10px] ${discountType === "percent" ? "bg-[#C6FF3D] text-[#101014]" : "bg-[#27272a]"}`}
                  >
                    %
                  </button>
                  <button
                    onClick={() => { setDiscountType("fixed"); setDiscountValue(5000); }}
                    className={`px-2 py-1 rounded text-[10px] ${discountType === "fixed" ? "bg-[#C6FF3D] text-[#101014]" : "bg-[#27272a]"}`}
                  >
                    Rp
                  </button>
                </div>
              </div>

              {discountType !== "none" && (
                <Input
                  type="number"
                  min={0}
                  value={discountValue}
                  onChange={(e) => setDiscountValue(Number(e.target.value))}
                  placeholder={discountType === "percent" ? "Persen (1-100)" : "Nominal Rupiah"}
                  className="py-2 text-xs min-h-10"
                />
              )}
            </div>

            {/* Metode Pembayaran */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-[#71717a]">Metode Pembayaran (Dicatat)</label>
              <div className="grid grid-cols-3 gap-2">
                {(["cash", "qris", "transfer"] as const).map((m) => (
                  <button
                    key={m}
                    onClick={() => setPaymentMethod(m)}
                    className={`py-2 px-1 rounded-xl text-xs font-semibold uppercase border transition-colors cursor-pointer ${
                      paymentMethod === m
                        ? "bg-[#C6FF3D] text-[#101014] border-[#C6FF3D]"
                        : "bg-[#101014] text-[#71717a] border-[#27272a] hover:text-[#f4f4f5]"
                    }`}
                  >
                    {m === "cash" ? "Tunai" : m.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>

            {/* Summary Tagihan */}
            <div className="space-y-1 pt-3 border-t border-[#27272a] text-sm">
              <div className="flex justify-between text-[#71717a]">
                <span>Subtotal</span>
                <span>{formatRupiah(subtotal)}</span>
              </div>
              {discountAmount > 0 && (
                <div className="flex justify-between text-red-400">
                  <span>Diskon</span>
                  <span>-{formatRupiah(discountAmount)}</span>
                </div>
              )}
              <div className="flex justify-between text-base font-bold text-[#f4f4f5] pt-1">
                <span>Total Bayar</span>
                <span className="text-[#C6FF3D]">{formatRupiah(total)}</span>
              </div>
            </div>

            <Button
              onClick={() => void handleCheckout()}
              loading={processing}
              disabled={cart.length === 0}
              className="w-full text-base font-bold"
              size="lg"
            >
              Bayar & Cetak Struk
            </Button>
          </div>
        </div>
      )}

      {/* Modal Sukses Transaksi & Struk */}
      <Modal
        open={Boolean(createdReceipt)}
        onClose={() => setCreatedReceipt(null)}
        title="Transaksi Berhasil!"
      >
        <div className="space-y-4 text-center">
          <div className="w-14 h-14 bg-green-900/40 text-[#C6FF3D] rounded-full flex items-center justify-center mx-auto text-3xl font-black">
            ✓
          </div>
          <div>
            <h3 className="text-xl font-bold text-[#f4f4f5]">
              Nota #{createdReceipt?.receiptNumber}
            </h3>
            <p className="text-2xl font-black text-[#C6FF3D] mt-1">
              {formatRupiah(createdReceipt?.totals.totalIdr ?? 0)}
            </p>
          </div>

          <div className="p-3 bg-[#101014] rounded-xl border border-[#27272a] text-xs text-[#71717a] space-y-2 text-left">
            <p>
              Tautan nota digital publik untuk pelanggan:
            </p>
            <div className="font-mono text-[11px] text-[#f4f4f5] break-all bg-[#27272a] p-2 rounded">
              {window.location.origin}/receipt/{createdReceipt?.publicToken}
            </div>
          </div>

          <div className="flex flex-col gap-2 pt-2">
            <Button
              onClick={() => {
                window.open(`/receipt/${createdReceipt?.publicToken}`, "_blank");
              }}
              className="w-full"
            >
              Buka & Cetak Struk (window.print)
            </Button>

            <Button
              variant="secondary"
              onClick={() => {
                const url = encodeURIComponent(`${window.location.origin}/receipt/${createdReceipt?.publicToken}`);
                const text = encodeURIComponent(`Halo, terima kasih telah mencukur di barbershop kami! Berikut nota digital Anda: `);
                window.open(`https://wa.me/?text=${text}${url}`, "_blank");
              }}
              className="w-full"
            >
              Bagikan via WhatsApp (wa.me)
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
