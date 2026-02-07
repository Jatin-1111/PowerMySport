interface QRCodeDisplayProps {
  qrCode: string;
  bookingId: string;
}

export default function QRCodeDisplay({
  qrCode,
  bookingId,
}: QRCodeDisplayProps) {
  return (
    <div className="bg-card border border-border rounded-lg p-6 text-center">
      <h3 className="text-lg font-semibold mb-4 text-deep-slate">
        ✅ Booking Confirmed!
      </h3>

      <div className="bg-white p-4 rounded-lg inline-block mb-4">
        <img src={qrCode} alt="Booking QR Code" className="w-48 h-48 mx-auto" />
      </div>

      <p className="text-sm text-muted-foreground mb-2">
        Show this QR code at the venue
      </p>
      <p className="text-xs text-muted-foreground">Booking ID: {bookingId}</p>
    </div>
  );
}

