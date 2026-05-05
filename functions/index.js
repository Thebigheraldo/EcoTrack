// functions/index.js
const admin = require("firebase-admin");
const Stripe = require("stripe");
const { onRequest, onCall, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret, defineString } = require("firebase-functions/params");

admin.initializeApp();

const db = admin.firestore();

const STRIPE_SECRET_KEY = defineSecret("STRIPE_SECRET_KEY");
const STRIPE_WEBHOOK_SECRET = defineSecret("STRIPE_WEBHOOK_SECRET");

const ECOTRACK_PRICE_ID = defineString("ECOTRACK_PRICE_ID");
const APP_BASE_URL = defineString("APP_BASE_URL");

const ACTIVE_STATUSES = ["active", "trialing"];

function getStripe() {
  return new Stripe(STRIPE_SECRET_KEY.value());
}

function toTimestampFromUnix(seconds) {
  if (!seconds) return null;
  return admin.firestore.Timestamp.fromMillis(seconds * 1000);
}

async function markEventProcessed(eventId) {
  const eventRef = db.collection("stripeEvents").doc(eventId);

  const result = await db.runTransaction(async (tx) => {
    const snap = await tx.get(eventRef);

    if (snap.exists) {
      return false;
    }

    tx.set(eventRef, {
      processedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return true;
  });

  return result;
}

async function updateUserSubscription(uid, data) {
  if (!uid) {
    console.warn("[stripeWebhook] Missing Firebase UID.");
    return;
  }

  await db.collection("users").doc(uid).set(
    {
      subscriptionProvider: "stripe",
      subscriptionStatus: data.subscriptionStatus || "unknown",
      subscriptionPlan: "annual_99",
      stripeCustomerId: data.stripeCustomerId || null,
      stripeSubscriptionId: data.stripeSubscriptionId || null,
      subscriptionCurrentPeriodEnd: data.subscriptionCurrentPeriodEnd || null,
      subscriptionCancelAtPeriodEnd:
        data.subscriptionCancelAtPeriodEnd === true,
      subscriptionAccessActive: ACTIVE_STATUSES.includes(
        data.subscriptionStatus,
      ),
      subscriptionUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true },
  );
}

async function findUserByStripeSubscription(subscription) {
  if (!subscription) return null;

  const subscriptionId = subscription.id;
  const customerId =
    typeof subscription.customer === "string" ?
      subscription.customer :
      subscription.customer?.id;

  if (subscriptionId) {
    const bySub = await db
      .collection("users")
      .where("stripeSubscriptionId", "==", subscriptionId)
      .limit(1)
      .get();

    if (!bySub.empty) {
      return bySub.docs[0].id;
    }
  }

  if (customerId) {
    const byCustomer = await db
      .collection("users")
      .where("stripeCustomerId", "==", customerId)
      .limit(1)
      .get();

    if (!byCustomer.empty) {
      return byCustomer.docs[0].id;
    }
  }

  return null;
}

async function syncSubscription(subscription, fallbackUid = null) {
  const uid = fallbackUid || (await findUserByStripeSubscription(subscription));

  if (!uid) {
    console.warn(
      "[stripeWebhook] Could not find user for subscription:",
      subscription?.id,
    );
    return;
  }

  const customerId =
    typeof subscription.customer === "string" ?
      subscription.customer :
      subscription.customer?.id;

  await updateUserSubscription(uid, {
    subscriptionStatus: subscription.status,
    stripeCustomerId: customerId || null,
    stripeSubscriptionId: subscription.id,
    subscriptionCurrentPeriodEnd: toTimestampFromUnix(
      subscription.current_period_end,
    ),
    subscriptionCancelAtPeriodEnd: subscription.cancel_at_period_end === true,
  });
}

exports.createEcoTrackCheckoutSession = onCall(
  {
    region: "europe-west1",
    secrets: [STRIPE_SECRET_KEY],
  },
  async (request) => {
    const uid = request.auth?.uid;
    const email = request.auth?.token?.email;

    if (!uid) {
      throw new HttpsError(
        "unauthenticated",
        "You must be logged in to start checkout.",
      );
    }

    const stripe = getStripe();

    const userRef = db.collection("users").doc(uid);
    const userSnap = await userRef.get();
    const userData = userSnap.exists ? userSnap.data() : {};

    let customerId = userData.stripeCustomerId;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: email || undefined,
        metadata: {
          firebaseUid: uid,
          product: "ecotrack",
        },
      });

      customerId = customer.id;

      await userRef.set(
        {
          stripeCustomerId: customerId,
          stripeCustomerCreatedAt:
            admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
    }

    const baseUrl = APP_BASE_URL.value().replace(/\/$/, "");

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      client_reference_id: uid,
      line_items: [
        {
          price: ECOTRACK_PRICE_ID.value(),
          quantity: 1,
        },
      ],
      success_url: `${baseUrl}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/payment-cancelled`,
      metadata: {
        firebaseUid: uid,
        product: "ecotrack",
        plan: "annual_99",
      },
      subscription_data: {
        metadata: {
          firebaseUid: uid,
          product: "ecotrack",
          plan: "annual_99",
        },
      },
      allow_promotion_codes: false,
      billing_address_collection: "auto",
    });

    return {
      url: session.url,
    };
  },
);

exports.stripeWebhook = onRequest(
  {
    region: "europe-west1",
    secrets: [STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET],
  },
  async (req, res) => {
    if (req.method !== "POST") {
      res.status(405).send("Method not allowed");
      return;
    }

    const stripe = getStripe();
    const signature = req.headers["stripe-signature"];

    let event;

    try {
      event = stripe.webhooks.constructEvent(
        req.rawBody,
        signature,
        STRIPE_WEBHOOK_SECRET.value(),
      );
    } catch (error) {
      console.error("[stripeWebhook] Invalid signature:", error.message);
      res.status(400).send(`Webhook Error: ${error.message}`);
      return;
    }

    try {
      const shouldProcess = await markEventProcessed(event.id);

      if (!shouldProcess) {
        res.status(200).send("Duplicate event ignored");
        return;
      }

      switch (event.type) {
        case "checkout.session.completed": {
          const session = event.data.object;

          const uid =
            session.client_reference_id || session.metadata?.firebaseUid;

          if (!session.subscription) {
            console.warn(
              "[stripeWebhook] checkout.session.completed without subscription",
            );
            break;
          }

          const subscription = await stripe.subscriptions.retrieve(
            session.subscription,
          );

          await syncSubscription(subscription, uid);
          break;
        }

        case "customer.subscription.created":
        case "customer.subscription.updated":
        case "customer.subscription.deleted": {
          const subscription = event.data.object;
          await syncSubscription(subscription);
          break;
        }

        case "invoice.paid":
        case "invoice.payment_failed": {
          const invoice = event.data.object;

          if (!invoice.subscription) {
            break;
          }

          const subscription = await stripe.subscriptions.retrieve(
            invoice.subscription,
          );

          await syncSubscription(subscription);
          break;
        }

        default:
          console.log("[stripeWebhook] Unhandled event:", event.type);
      }

      res.status(200).send("ok");
    } catch (error) {
      console.error("[stripeWebhook] Handler error:", error);
      res.status(500).send("Webhook handler failed");
    }
  },
);
