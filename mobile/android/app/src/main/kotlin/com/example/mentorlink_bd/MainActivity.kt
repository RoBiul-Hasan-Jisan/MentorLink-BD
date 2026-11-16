package com.example.mentorlink_bd

import android.app.NotificationChannel
import android.app.Notification
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Intent
import android.os.Build
import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel

class MainActivity : FlutterActivity() {
    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)
        val nm = getSystemService(NOTIFICATION_SERVICE) as NotificationManager

        // High-importance channel: heads-up banner + the number badge on the launcher icon.
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val ch = NotificationChannel("mentorlink_alerts", "MentorLink alerts", NotificationManager.IMPORTANCE_HIGH)
            ch.description = "Requests, messages, sessions and other updates"
            ch.setShowBadge(true)
            nm.createNotificationChannel(ch)
            // Quiet channel for the "you have N unread" summary the app posts itself when it goes to the background.
            val un = NotificationChannel("mentorlink_unread", "Unread count", NotificationManager.IMPORTANCE_LOW)
            un.setShowBadge(true)
            nm.createNotificationChannel(un)
        }

        // Dart calls this when everything is read, so the number on the app icon goes away.
        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, "mentorlink/badge").setMethodCallHandler { call, result ->
            when (call.method) {
                "clear" -> { nm.cancelAll(); setLauncherNumber(0); result.success(null) }
                // The app went to the background with N unread: show the number on the app icon.
                "set" -> { setBadge(nm, (call.arguments as? Int) ?: 0); result.success(null) }
                // The app is open again: take our own summary notification away (the number stays until everything is read).
                "hide" -> { nm.cancel(SUMMARY_ID); result.success(null) }
                else -> result.notImplemented()
            }
        }
    }

    private val SUMMARY_ID = 7001

    // Samsung (and some other launchers) read this broadcast to draw the number on the icon.
    private fun setLauncherNumber(count: Int) {
        try {
            val i = Intent("android.intent.action.BADGE_COUNT_UPDATE")
            i.putExtra("badge_count", count)
            i.putExtra("badge_count_package_name", packageName)
            i.putExtra("badge_count_class_name", packageManager.getLaunchIntentForPackage(packageName)?.component?.className ?: "")
            sendBroadcast(i)
        } catch (_: Exception) {}
    }

    private fun setBadge(nm: NotificationManager, count: Int) {
        if (count <= 0) { nm.cancel(SUMMARY_ID); setLauncherNumber(0); return }
        setLauncherNumber(count)
        // Other launchers count notifications in the tray. If a push is already there, it counts; otherwise post one summary.
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && nm.activeNotifications.any { it.id != SUMMARY_ID }) return
        val open = PendingIntent.getActivity(this, 0, Intent(this, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP), PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
        val b = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) Notification.Builder(this, "mentorlink_unread") else Notification.Builder(this)
        b.setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle("MentorLink BD")
            .setContentText(if (count == 1) "You have 1 unread notification" else "You have $count unread notifications")
            .setNumber(count)
            .setOnlyAlertOnce(true)
            .setAutoCancel(false)
            .setContentIntent(open)
        nm.notify(SUMMARY_ID, b.build())
    }
}
