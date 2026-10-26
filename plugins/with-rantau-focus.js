const { withAndroidManifest, withDangerousMod, AndroidConfig } = require("@expo/config-plugins");
const fs = require("fs");
const path = require("path");

function withFocusManifest(config) {
  return withAndroidManifest(config, (modConfig) => {
    const manifest = modConfig.modResults.manifest;
    const app = manifest.application?.[0];
    if (!app) throw new Error("RantauYuk Focus Guard: AndroidManifest application tidak ditemukan.");

    const serviceName = ".focus.RantauFocusAccessibilityService";
    const activityName = ".focus.FocusBlockActivity";

    const services = app.service || (app.service = []);
    if (!services.some((x) => x.$?.["android:name"] === serviceName)) {
      services.push({
        $: {
          "android:name": serviceName,
          "android:label": "RantauYuk Focus Guard",
          "android:permission": "android.permission.BIND_ACCESSIBILITY_SERVICE",
          "android:exported": "true",
        },
        "intent-filter": [{
          action: [{ $: { "android:name": "android.accessibilityservice.AccessibilityService" } }],
        }],
        "meta-data": [{
          $: {
            "android:name": "android.accessibilityservice",
            "android:resource": "@xml/rantau_focus_accessibility",
          },
        }],
      });
    }

    const activities = app.activity || (app.activity = []);
    if (!activities.some((x) => x.$?.["android:name"] === activityName)) {
      activities.push({
        $: {
          "android:name": activityName,
          "android:exported": "false",
          "android:excludeFromRecents": "true",
          "android:launchMode": "singleTop",
          "android:theme": "@android:style/Theme.Material.Light.NoActionBar",
        },
      });
    }

    return modConfig;
  });
}

function withFocusNativeFiles(config) {
  return withDangerousMod(config, ["android", async (modConfig) => {
    const projectRoot = modConfig.modRequest.projectRoot;
    const pkg = modConfig.android?.package || "com.rantauyuk.app";
    const packagePath = pkg.replace(/\./g, path.sep);
    const javaDir = path.join(projectRoot, "android", "app", "src", "main", "java", packagePath, "focus");
    const resDir = path.join(projectRoot, "android", "app", "src", "main", "res", "xml");
    fs.mkdirSync(javaDir, { recursive: true });
    fs.mkdirSync(resDir, { recursive: true });

    fs.writeFileSync(path.join(resDir, "rantau_focus_accessibility.xml"), `<?xml version="1.0" encoding="utf-8"?>
<accessibility-service xmlns:android="http://schemas.android.com/apk/res/android"
    android:accessibilityEventTypes="typeWindowStateChanged|typeWindowsChanged"
    android:accessibilityFeedbackType="feedbackGeneric"
    android:notificationTimeout="100"
    android:canRetrieveWindowContent="false"
    android:description="@string/rantau_focus_accessibility_description" />
`);

    const valuesDir = path.join(projectRoot, "android", "app", "src", "main", "res", "values");
    fs.mkdirSync(valuesDir, { recursive: true });
    const stringsPath = path.join(valuesDir, "strings.xml");
    let strings = fs.existsSync(stringsPath) ? fs.readFileSync(stringsPath, "utf8") : '<?xml version="1.0" encoding="utf-8"?><resources></resources>';
    if (!strings.includes('name="rantau_focus_accessibility_description"')) {
      strings = strings.replace("</resources>", '  <string name="rantau_focus_accessibility_description">Mendeteksi aplikasi yang dibuka selama sesi fokus RantauYuk.</string>\n</resources>');
      fs.writeFileSync(stringsPath, strings);
    }

    fs.writeFileSync(path.join(javaDir, "RantauFocusAccessibilityService.kt"), `package ${pkg}.focus

import android.accessibilityservice.AccessibilityService
import android.content.Intent
import android.database.sqlite.SQLiteDatabase
import android.view.accessibility.AccessibilityEvent
import org.json.JSONObject
import java.time.Instant

class RantauFocusAccessibilityService : AccessibilityService() {
  private var lastBlockedPackage: String? = null

  override fun onAccessibilityEvent(event: AccessibilityEvent?) {
    val packageName = event?.packageName?.toString() ?: return
    if (packageName == applicationContext.packageName) {
      lastBlockedPackage = null
      return
    }
    if (event.eventType != AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED &&
        event.eventType != AccessibilityEvent.TYPE_WINDOWS_CHANGED) return

    val blocked = getBlockedPackages()
    if (packageName !in blocked) {
      lastBlockedPackage = null
      return
    }
    if (packageName == lastBlockedPackage) return
    lastBlockedPackage = packageName

    val intent = Intent(this, FocusBlockActivity::class.java).apply {
      addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP)
      putExtra("blocked_package", packageName)
    }
    try { startActivity(intent) } catch (_: Exception) { lastBlockedPackage = null }
  }

  private fun getBlockedPackages(): Set<String> {
    val dbFile = getDatabasePath("rantau-yuk.db")
    if (!dbFile.exists()) return emptySet()
    return try {
      val db = SQLiteDatabase.openDatabase(dbFile.absolutePath, null, SQLiteDatabase.OPEN_READONLY)
      db.use {
        val settingsCursor = it.rawQuery("SELECT value FROM app_settings WHERE key = ?", arrayOf("app_blocker_focus"))
        val raw = settingsCursor.use { c -> if (c.moveToFirst()) c.getString(0) else null } ?: return emptySet()
        val settings = JSONObject(raw)
        if (!settings.optBoolean("enabled", false)) return emptySet()
        val startedAt = settings.optString("startedAt", "")
        val duration = settings.optInt("durationMinutes", 25)
        val startMs = try { Instant.parse(startedAt).toEpochMilli() } catch (_: Exception) { return emptySet() }
        if (System.currentTimeMillis() >= startMs + duration * 60_000L) return emptySet()

        val packages = mutableSetOf<String>()
        val cursor = it.rawQuery("SELECT package_name FROM blocked_apps WHERE is_enabled = 1", null)
        cursor.use { c -> while (c.moveToNext()) packages.add(c.getString(0)) }
        packages
      }
    } catch (_: Exception) { emptySet() }
  }

  override fun onInterrupt() {}
}
`);

    fs.writeFileSync(path.join(javaDir, "FocusBlockActivity.kt"), `package ${pkg}.focus

import android.app.Activity
import android.os.Bundle
import android.graphics.Color
import android.view.Gravity
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView

class FocusBlockActivity : Activity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    val blockedPackage = intent.getStringExtra("blocked_package") ?: "Aplikasi ini"
    val root = LinearLayout(this).apply {
      orientation = LinearLayout.VERTICAL
      gravity = Gravity.CENTER
      setPadding(48, 48, 48, 48)
      setBackgroundColor(Color.rgb(13, 25, 43))
    }
    val title = TextView(this).apply {
      text = "Tetap fokus dulu"
      textSize = 28f
      setTextColor(Color.WHITE)
      gravity = Gravity.CENTER
    }
    val detail = TextView(this).apply {
      text = "Aplikasi $blockedPackage dibatasi selama sesi Strict Focus RantauYuk aktif."
      textSize = 16f
      setTextColor(Color.LTGRAY)
      gravity = Gravity.CENTER
      setPadding(0, 24, 0, 32)
    }
    val button = Button(this).apply {
      text = "Kembali"
      setOnClickListener { finish() }
    }
    root.addView(title)
    root.addView(detail)
    root.addView(button)
    setContentView(root)
  }
}
`);
    return modConfig;
  }]);
}

module.exports = function withRantauFocus(config) {
  config = withFocusManifest(config);
  config = withFocusNativeFiles(config);
  return config;
};
