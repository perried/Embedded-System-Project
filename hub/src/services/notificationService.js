import admin from 'firebase-admin';
import dotenv from 'dotenv';

dotenv.config();

let isFirebaseInitialized = false;

try {
    // 1. Check for raw JSON string in ENV (Vercel-friendly)
    const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT;
    // 2. Check for file path in ENV (Legacy/Local)
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
