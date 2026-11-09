
import { useEffect, useState } from "react";
import { api } from "./api";

const kes = value =>
  "KES " + Number(value || 0).toLocaleString("en-KE");

export default function BookingConfirmation() {
  const [bookings, setBookings] = useState([]);
  const [receipts, setReceipts] = useState([]);
  const [bookingId, setBookingId] = useState("");
  const [receiptNumber, setReceiptNumber] = useState("");
  const [amount, setAmount] = useState("");
  const [evidence, setEvidence] = useState("");
  const [checked, setChecked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function load() {
    try {
      const [b, p] = await Promise.all([
        api("/admin/bookings", { auth: true }),
        api("/admin/mpesa", { auth: true })
      ]);

      setBookings(Array.isArray(b) ? b : []);
      setReceipts(Array.isArray(p) ? p : []);
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const eligible = bookings.filter(b =>
    ["awaiting_payment", "payment_submitted"]
      .includes(b.status)
  );

  const selected = bookings.find(
    b => String(b.id) === String(bookingId)
  );

  const pendingReceipt = receipts.find(
    p =>
      p.receipt_number ===
        receiptNumber.trim().toUpperCase() &&
      String(p.booking_id) === String(bookingId) &&
      p.status === "pending"
  );

  async function recordReceipt() {
    setError("");
    setMessage("");

    const receipt = receiptNumber.trim().toUpperCase();

    if (!bookingId || !/^[A-Z0-9]{8,20}$/.test(receipt)) {
      setError("Select a booking and enter a valid receipt.");
      return;
    }

    setBusy(true);

    try {
      await api("/admin/mpesa/record", {
        method: "POST",
        auth: true,
        body: {
          booking_id: bookingId,
          receipt_number: receipt
        }
      });

      setMessage("Receipt recorded. Verification is still required.");
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function confirmBooking() {
    setError("");
    setMessage("");

    const verifiedAmount = Number(amount);

    if (!pendingReceipt) {
      setError("Record a pending receipt for this booking first.");
      return;
    }

    if (!Number.isSafeInteger(verifiedAmount) ||
        verifiedAmount <= 0) {
      setError("Enter a valid verified amount in KES.");
      return;
    }

    if (evidence.trim().length < 5) {
      setError("Enter the Safaricom verification reference.");
      return;
    }

    if (!checked) {
      setError("Confirm that you independently checked the payment.");
      return;
    }

    if (!window.confirm(
      `Confirm verified payment of ${kes(verifiedAmount)} ` +
      `for booking ${selected?.ref || bookingId}?`
    )) return;

    setBusy(true);

    try {
      await api("/admin/mpesa/verify", {
        method: "POST",
        auth: true,
        body: {
          receipt_number: receiptNumber.trim().toUpperCase(),
          verified_amount: verifiedAmount,
          verification_reference: evidence.trim()
        }
      });

      setMessage("Payment recorded and booking confirmed.");
      setBookingId("");
      setReceiptNumber("");
      setAmount("");
      setEvidence("");
      setChecked(false);

      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel" style={{ padding: 24 }}>
      <h2>Booking Confirmation</h2>

      <p>
        Verify the M-PESA payment before confirming
        a guest reservation.
      </p>

      <div className="row">
        <label>
          Select booking
          <select
            value={bookingId}
            onChange={e => {
              setBookingId(e.target.value);
              setReceiptNumber("");
              setChecked(false);
            }}
          >
            <option value="">Choose booking</option>
            {eligible.map(b => (
              <option key={b.id} value={b.id}>
                {b.ref} — {b.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      {selected && (
        <div className="panel">
          <h3>Reservation details</h3>
          <p><b>Booking:</b> {selected.ref}</p>
          <p><b>Guest:</b> {selected.name}</p>
          <p><b>Cottage:</b> {selected.cottage_name || selected.unit_id}</p>
          <p><b>Total:</b> {kes(selected.total)}</p>
          <p><b>Status:</b> {selected.status}</p>
        </div>
      )}

      <h3>M-PESA payment details</h3>

      <div className="row">
        <label>
          Receipt number
          <input
            value={receiptNumber}
            onChange={e => {
              setReceiptNumber(e.target.value.toUpperCase());
              setChecked(false);
            }}
            placeholder="M-PESA receipt code"
          />
        </label>

        <button
          className="sm go"
          disabled={busy || !bookingId}
          onClick={recordReceipt}
        >
          Record Receipt
        </button>
      </div>

      <p>
        Receipt status:{" "}
        <b>{pendingReceipt ? "Pending verification" : "Not recorded as pending"}</b>
      </p>

      <div className="row">
        <label>
          Verified amount (KES)
          <input
            type="number"
            min="1"
            step="1"
            value={amount}
            onChange={e => setAmount(e.target.value)}
          />
        </label>

        <label>
          Safaricom verification reference
          <input
            value={evidence}
            onChange={e => setEvidence(e.target.value)}
            placeholder="Statement or transaction reference"
          />
        </label>
      </div>

      <label style={{ display: "block", margin: "16px 0" }}>
        <input
          type="checkbox"
          checked={checked}
          onChange={e => setChecked(e.target.checked)}
        />
        {" "}I independently checked the receipt, amount,
        PayBill recipient and transaction in official records.
      </label>

      {error && (
        <p role="alert" style={{ color: "crimson" }}>
          {error}
        </p>
      )}

      {message && <p role="status">{message}</p>}

      <button
        className="btn"
        disabled={busy || !pendingReceipt || !checked}
        onClick={confirmBooking}
      >
        {busy ? "Processing..." : "Confirm Booking & Payment"}
      </button>
    </section>
  );
}
