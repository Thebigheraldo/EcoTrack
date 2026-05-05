import { getApp } from "firebase/app";
import {
  getStripePayments,
  createCheckoutSession,
  getCurrentUserSubscriptions,
} from "@invertase/firestore-stripe-payments";

const app = getApp();

export const payments = getStripePayments(app, {
  productsCollection: "products",
  customersCollection: "customers",
});

export const ECOTRACK_YEARLY_PRICE_ID = "price_1TDQ4GQrvg0FwjcjcYKY3d0L";

export async function startEcoTrackSubscriptionCheckout() {
  const session = await createCheckoutSession(payments, {
    price: ECOTRACK_YEARLY_PRICE_ID,
    success_url: `${window.location.origin}/payment-success`,
    cancel_url: `${window.location.origin}/checkout`,
  });

  window.location.assign(session.url);
}

export async function hasActiveEcoTrackSubscription() {
  const subscriptions = await getCurrentUserSubscriptions(payments);

  console.log("EcoTrack subscriptions found:", subscriptions);

  return subscriptions.some((sub) =>
    ["active", "trialing"].includes(sub.status)
  );
}