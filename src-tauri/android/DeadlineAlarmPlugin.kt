package com.yeonsik.note

import android.app.Activity
import android.app.AlarmManager
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import app.tauri.plugin.JSObject
import app.tauri.annotation.Command
import app.tauri.annotation.TauriPlugin
import app.tauri.plugin.Invoke
import app.tauri.plugin.Plugin

/** Permission bridge only. Scheduling remains in tauri-plugin-notification. */
@TauriPlugin
class DeadlineAlarmPlugin(private val activity: Activity) : Plugin(activity) {
    @Command
    fun status(invoke: Invoke) {
        val alarm = activity.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        val granted = Build.VERSION.SDK_INT < Build.VERSION_CODES.S || alarm.canScheduleExactAlarms()
        val result = JSObject()
        result.put("granted", granted)
        invoke.resolve(result)
    }

    @Command
    fun openSettings(invoke: Invoke) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            activity.startActivity(Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM,
                Uri.parse("package:" + activity.packageName)))
        }
        invoke.resolve()
    }
}
