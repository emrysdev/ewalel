
import React, { useState } from "react";
import "./MpesaPayment.css";

const PAYBILL = "522533";
const ACCOUNT = "7845616";

export default function MpesaPayment({
  booking,
  onSubmitted
}) {
  const [receipt, setReceipt] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [copied, setCopied] = useState("");

  async function copyNumber(value, name) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(name);
    } catch {
      setMessage("Unable to copy. Please copy the number manually.");
    }
  }

  async function submitPayment(e) {
    e.preventDefault();

    if (!booking?.id) {
      setMessage("Please complete your reservation first.");
      return;
    }

    const code = receipt.trim().toUpperCase();

    if (!/^[A-Z0-9]{8,20}$/.test(code)) {
      setMessage("Enter a valid M-PESA receipt number.");
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      const response = await fetch(
        "/api/payments/mpesa/submit",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            bookingId: booking.id,
            receipt: code
          })
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "Unable to submit payment."
        );
      }

      setSubmitted(true);
      setMessage(
        "Your M-PESA receipt has been submitted. " +
        "Management will verify the payment and " +
        "confirm your booking."
      );

      onSubmitted?.(data);
    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="ewalel-mpesa">
      <div className="ewalel-mpesa-header">
        <h3>Ewalel Cottages — Payment</h3>
        <span className="ewalel-mpesa-badge">
          M-PESA
        </span>
      </div>

      <div className="ewalel-payment-number">
        <div>
          <p>PayBill number</p>
          <strong>{PAYBILL}</strong>
        </div>

        <button
          type="button"
          onClick={() => copyNumber(PAYBILL, "paybill")}
        >
          {copied === "paybill" ? "Copied!" : "▢ Copy"}
        </button>
      </div>

      <div className="ewalel-payment-number">
        <div>
          <p>Account number</p>
          <strong>{ACCOUNT}</strong>
        </div>

        <button
          type="button"
          onClick={() => copyNumber(ACCOUNT, "account")}
        >
          {copied === "account" ? "Copied!" : "▢ Copy"}
        </button>
      </div>

      <form onSubmit={submitPayment}>
        <label htmlFor="ewalel-receipt">
          M-PESA receipt number
        </label>

        <input
          id="ewalel-receipt"
          type="text"
          placeholder="Enter receipt after payment"
          value={receipt}
          onChange={(e) =>
            setReceipt(e.target.value.toUpperCase())
          }
          maxLength={20}
          disabled={submitted || loading}
          required
        />

        <button
          className="ewalel-pay-button"
          type="submit"
          disabled={
            loading ||
            submitted ||
            !booking?.id ||
            !receipt.trim()
          }
        >
          {loading
            ? "Submitting..."
            : submitted
              ? "Receipt submitted"
              : "Pay — Submit receipt"}
        </button>
      </form>

      {message && (
        <p className="ewalel-payment-message" role="status">
          {message}
        </p>
      )}

      <p className="ewalel-payment-note">
        Your payment remains pending until Ewalel
        management verifies the transaction.
      </p>
    </section>
  );
}
