export default function BillingSuccessPage() {
  return (
    <div className="space-y-3">
      <h1 className="text-xl font-semibold tracking-tight">Pago iniciado</h1>
      <p className="text-sm text-white/70">
        PayPal devolvió el flujo correctamente. La suscripción se activará cuando llegue el webhook.
      </p>
    </div>
  );
}
