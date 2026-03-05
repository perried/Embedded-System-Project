/**
 * notificationService.js
 * ======================
 * Firebase Cloud Messaging (FCM) push notification service.
 * Sends alerts to the 'alerts' topic when a site enters warning or critical state.
 *
 * Firebase is optional — if no credentials are provided, notifications are silently skipped.
 */

import admin from 'firebase-admin';
import dotenv from 'dotenv';

dotenv.config();

let isFirebaseInitialized = false;

try {
    // Option 1: Raw JSON string in env var (Docker / CI-friendly)
    const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT;
    // Option 2: Path to a service account JSON file on disk
    const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
    
    if (serviceAccountJson) {
        const credentials = JSON.parse(serviceAccountJson);
        admin.initializeApp({
            credential: admin.credential.cert(credentials)
        });
        isFirebaseInitialized = true;
        console.log('[NOTIFICATION] Firebase Admin initialized via ENV string.');
    } else if (serviceAccountPath) {
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccountPath)
        });
        isFirebaseInitialized = true;
        console.log('[NOTIFICATION] Firebase Admin initialized via file path.');
    } else {
        console.warn('[NOTIFICATION] No Firebase credentials found in ENV. Push notifications disabled.');
    }
} catch (error) {
    console.error('[NOTIFICATION] Error initializing Firebase:', error.message);
}

/**
 * Sends a push notification to the 'alerts' topic.
 * @param {string} siteName - The name of the site.
 * @param {string} level - Alert level (warning, critical).
 * @param {object} sensors - Current sensor readings.
 */
export async function sendPushNotification(siteName, level, sensors) {
    if (!isFirebaseInitialized) return;

    const title = level === 'critical' ? '🚨 CRITICAL ALERT' : '⚠️ WARNING';
    const smokeAlert = sensors.smoke > 0 ? 'SMOKE DETECTED! ' : '';
    const body = `${siteName}: ${smokeAlert}Temp: ${sensors.temperature}°C, Humid: ${sensors.humidity}%`;

    const message = {
        notification: {
            title: title,
            body: body,
        },
        android: {
            priority: 'high',
            notification: {
                channelId: 'high_importance_channel',
                clickAction: 'FLUTTER_NOTIFICATION_CLICK',
            },
        },
        apns: {
            payload: {
                aps: {
                    contentAvailable: true,
                    sound: 'default',
                    badge: 1,
                },
            },
        },
        data: {
            siteName: siteName,
            level: level,
        },
        topic: 'alerts',
    };

    try {
        const response = await admin.messaging().send(message);
        console.log(`[NOTIFICATION] Successfully sent message to topic 'alerts':`, response);
    } catch (error) {
        console.error('[NOTIFICATION] Error sending message:', error);
    }
}
