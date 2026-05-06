interface Window {
  // Razorpay checkout SDK — loaded dynamically via script tag in parent fees page
  Razorpay: new (options: Record<string, unknown>) => { open(): void };
}
