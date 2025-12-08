/* eslint-disable */

const functions = require("firebase-functions");
const admin = require("firebase-admin");
const nodemailer = require("nodemailer");

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

/**
 * Nodemailer transport using Gmail.
 *
 * Set credentials once with:
 *   firebase functions:config:set mail.user="yourgmail@gmail.com" mail.pass="your-app-password"
 */
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: functions.config().mail.user,
    pass: functions.config().mail.pass,
  },
});

function sendMail({ to, subject, text, html }) {
  const from = `"EcoTrack by Viridis" <${functions.config().mail.user}>`;

  return transporter.sendMail({
    from,
    to,
    subject,
    text,
    html,
  });
}

/**
 * 1) Callable: sendCriticalAlertEmail
 * Called from the questionnaire when a critical ESG condition is detected.
 */
exports.sendCriticalAlertEmail = functions
  .region("europe-west1")
  .https.onCall(async (data) => {
    const {
      user,
      profile,
      scores,
      threshold = 0.2,
      source = "unknown",
      assessmentId,
    } = data || {};

    if (!scores || ["E", "S", "G"].some((k) => typeof scores[k] !== "number")) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "Missing or invalid scores"
      );
    }

    // Log lead in Firestore (server-only)
    const leadRef = db.collection("leads").doc();
    await leadRef.set({
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      type: "critical-esg-gate",
      user: {
        uid: user && user.uid ? user.uid : null,
        email: user && user.email ? user.email : null,
        displayName: user && user.displayName ? user.displayName : null,
      },
      profile: profile || null,
      scores: {
        E: scores.E,
        S: scores.S,
        G: scores.G,
        overall: scores.overall != null ? scores.overall : null,
      },
      threshold,
      source,
      assessmentId: assessmentId || null,
      status: "new",
    });

    const pct = (x) => `${Math.round((x || 0) * 100)}%`;

    const html = `
      <h2>Critical ESG Alert (Questionnaire)</h2>
      <p><strong>User:</strong> ${(user && user.displayName) || "-"} (${(user && user.email) || "-"})</p>
      <p><strong>UID:</strong> ${(user && user.uid) || "-"}</p>
      <p><strong>Assessment ID:</strong> ${assessmentId || "-"}</p>
      <p><strong>Profile:</strong> ${profile ? JSON.stringify(profile) : "-"}</p>
      <p><strong>Scores:</strong> E: ${pct(scores.E)} | S: ${pct(scores.S)} | G: ${pct(scores.G)} | Overall: ${
      scores.overall != null ? pct(scores.overall) : "N/A"
    }</p>
      <p><strong>Threshold:</strong> ${Math.round(threshold * 100)}%</p>
      <p><strong>Source:</strong> ${source}</p>
    `;

    const text = `
Critical ESG Alert (Questionnaire)

User: ${(user && user.displayName) || "-"} (${(user && user.email) || "-"})
UID: ${(user && user.uid) || "-"}
Assessment ID: ${assessmentId || "-"}
Profile: ${profile ? JSON.stringify(profile) : "-"}

Scores:
  E: ${pct(scores.E)}
  S: ${pct(scores.S)}
  G: ${pct(scores.G)}
  Overall: ${scores.overall != null ? pct(scores.overall) : "N/A"}

Threshold: ${Math.round(threshold * 100)}%
Source: ${source}
    `.trim();

    await sendMail({
      to: "info@viridisconsultancy.com",
      subject: `Critical ESG Gate — ${(user && user.email) || "Unknown user"} (${
        scores.overall != null ? pct(scores.overall) : "N/A"
      })`,
      text,
      html,
    });

    return { ok: true, leadId: leadRef.id };
  });

/**
 * 2) Scheduled: sendAssessmentReminders
 * Runs every day at 09:00 Europe/Rome and emails users who:
 *   - have settings.remindAssessments === true
 *   - AND have no assessment in the last 6 months
 */
exports.sendAssessmentReminders = functions
  .region("europe-west1")
  .pubsub.schedule("every day 09:00")
  .timeZone("Europe/Rome")
  .onRun(async () => {
    const now = new Date();

    const snap = await db
      .collection("users")
      .where("settings.remindAssessments", "==", true)
      .get();

    if (snap.empty) {
      console.log("[sendAssessmentReminders] no opted-in users.");
      return null;
    }

    var sentCount = 0;
    var SIX_MONTHS = 6;

    for (var i = 0; i < snap.docs.length; i += 1) {
      var docSnap = snap.docs[i];
      var u = docSnap.data();

      var email = u.email;
      if (!email) {
        continue;
      }

      var lastTs = u.lastAssessmentAt;
      var lastDate =
        lastTs && typeof lastTs.toDate === "function"
          ? lastTs.toDate()
          : null;

      var monthsDiff = null;
      if (lastDate) {
        monthsDiff =
          (now.getFullYear() - lastDate.getFullYear()) * 12 +
          (now.getMonth() - lastDate.getMonth());
      }

      // If last assessment is < 6 months, skip
      if (lastDate && monthsDiff < SIX_MONTHS) {
        continue;
      }

      var name = u.name || "";
      var sector = (u.profile && u.profile.sector) || "your company";
      var lastStr = lastDate
        ? lastDate.toLocaleDateString("en-GB")
        : "no completed assessment yet";

      var subject = "EcoTrack reminder: time to review your ESG score";

      var text = `
Hi ${name},

you enabled reminders to review your ESG performance with EcoTrack.

We noticed that your last ESG assessment was: ${lastStr}.
We recommend running a new ESG self-assessment for ${sector} to keep your ESG strategy up to date.

You can log in and start a new assessment from your dashboard.

If you no longer wish to receive these reminders, disable them in Profile & Settings.

EcoTrack by Viridis
      `.trim();

      var html = `
        <p>Hi ${name},</p>
        <p>You enabled reminders to review your ESG performance with <b>EcoTrack</b>.</p>
        <p>
          We noticed that your last ESG assessment was:
          <b>${lastStr}</b>.<br/>
          We recommend running a new ESG self-assessment for <b>${sector}</b> to keep your ESG strategy up to date.
        </p>
        <p>You can log in and start a new assessment from your dashboard.</p>
        <p style="font-size:12px;color:#6b7280;">
          If you no longer wish to receive these reminders, disable them in <b>Profile &amp; Settings</b>.
        </p>
        <p>EcoTrack by Viridis</p>
      `;

      try {
        await sendMail({ to: email, subject, text, html });
        sentCount += 1;
        console.log(
          "[sendAssessmentReminders] sent reminder to " +
            email +
            " (uid=" +
            docSnap.id +
            ")"
        );
      } catch (err) {
        console.error(
          "[sendAssessmentReminders] failed to send to " + email + ":",
          err
        );
      }
    }

    console.log(
      "[sendAssessmentReminders] finished. Sent " +
        sentCount +
        " reminder(s)."
    );

    return null;
  });




