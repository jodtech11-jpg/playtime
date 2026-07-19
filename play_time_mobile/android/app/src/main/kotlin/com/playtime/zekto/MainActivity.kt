package com.playtime.zekto

import android.os.Bundle
import androidx.core.view.WindowCompat
import io.flutter.embedding.android.FlutterActivity

class MainActivity : FlutterActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        // Tell Android to let our content draw behind the status bar and
        // navigation bar (edge-to-edge). Must be called before super.onCreate()
        // so the window flag is set before Flutter configures the bars.
        // Uses WindowCompat (androidx.core) to avoid version conflicts with the
        // activity-ktx enableEdgeToEdge() receiver type.
        WindowCompat.setDecorFitsSystemWindows(window, false)
        super.onCreate(savedInstanceState)
    }
}
