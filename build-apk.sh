#!/bin/bash
set -e

export JAVA_HOME=$(ls -d ~/.local/java/jdk-21* | head -1)
export ANDROID_HOME=~/android-sdk
export PATH="$JAVA_HOME/bin:$ANDROID_HOME/build-tools/34.0.0:$PATH"

APK_DIR="/tmp/kinza-apk"
rm -rf "$APK_DIR"
mkdir -p "$APK_DIR"/{src/com/kinza/snake,res/{layout,values,mipmap-hdpi,mipmap-xhdpi,mipmap-xxhdpi},assets,gen,obj,dex}

cp dist/index.html "$APK_DIR/assets/"

cat > "$APK_DIR/AndroidManifest.xml" << 'MANIFEST'
<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android" package="com.kinza.snake">
    <uses-permission android:name="android.permission.INTERNET"/>
    <application android:allowBackup="true" android:icon="@mipmap/ic_launcher" android:label="KINZA SNAKE" android:theme="@android:style/Theme.NoTitleBar.Fullscreen" android:hardwareAccelerated="true">
        <activity android:name=".MainActivity" android:exported="true" android:configChanges="orientation|screenSize|keyboardHidden" android:screenOrientation="portrait">
            <intent-filter>
                <action android:name="android.intent.action.MAIN"/>
                <category android:name="android.intent.category.LAUNCHER"/>
            </intent-filter>
        </activity>
    </application>
</manifest>
MANIFEST

cat > "$APK_DIR/src/com/kinza/snake/MainActivity.java" << 'JAVA'
package com.kinza.snake;
import android.app.Activity;
import android.os.Bundle;
import android.view.View;
import android.view.Window;
import android.view.WindowManager;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
public class MainActivity extends Activity {
    private WebView webView;
    protected void onCreate(Bundle b) {
        super.onCreate(b);
        requestWindowFeature(Window.FEATURE_NO_TITLE);
        getWindow().setFlags(WindowManager.LayoutParams.FLAG_FULLSCREEN, WindowManager.LayoutParams.FLAG_FULLSCREEN);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        webView = new WebView(this);
        setContentView(webView);
        WebSettings s = webView.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setAllowFileAccess(true);
        webView.setWebViewClient(new WebViewClient());
        webView.setWebChromeClient(new WebChromeClient());
        webView.setSystemUiVisibility(View.SYSTEM_UI_FLAG_FULLSCREEN|View.SYSTEM_UI_FLAG_HIDE_NAVIGATION|View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY);
        webView.loadUrl("file:///android_asset/index.html");
    }
    public void onBackPressed() { if(webView.canGoBack()) webView.goBack(); else super.onBackPressed(); }
}
JAVA

cat > "$APK_DIR/res/values/strings.xml" << 'XML'
<?xml version="1.0" encoding="utf-8"?>
<resources><string name="app_name">KINZA SNAKE</string></resources>
XML

python3 -c "
import struct, zlib
def mkp(sz):
    def ch(t,d):
        c=t+d; return struct.pack('>I',len(d))+c+struct.pack('>I',zlib.crc32(c)&0xffffffff)
    r=b''
    for y in range(sz):
        r+=b'\x00'
        for x in range(sz):
            cx,cy=x-sz//2,y-sz//2
            if cx*cx+cy*cy<(sz//3)**2: r+=bytes([163,230,53])
            else: r+=bytes([4,19,11])
    return b'\x89PNG\r\n\x1a\n'+ch(b'IHDR',struct.pack('>IIBBBBB',sz,sz,8,2,0,0,0))+ch(b'IDAT',zlib.compress(r))+ch(b'IEND',b'')
for s,d in [(72,'mipmap-hdpi'),(48,'mipmap-xhdpi'),(96,'mipmap-xxhdpi')]:
    open(f'/tmp/kinza-apk/res/{d}/ic_launcher.png','wb').write(mkp(s))
print('Icons created')
"

echo "Step 1: R.java..."
aapt package -f -m -J "$APK_DIR/gen" -M "$APK_DIR/AndroidManifest.xml" -S "$APK_DIR/res" -I "$ANDROID_HOME/platforms/android-34/android.jar"

echo "Step 2: Compile..."
javac --release 11 -classpath "$ANDROID_HOME/platforms/android-34/android.jar" -d "$APK_DIR/obj" "$APK_DIR/gen/com/kinza/snake/R.java" "$APK_DIR/src/com/kinza/snake/MainActivity.java"

echo "Step 3: DEX..."
d8 --output "$APK_DIR/dex" --lib "$ANDROID_HOME/platforms/android-34/android.jar" "$APK_DIR/obj/com/kinza/snake"/*.class

echo "Step 4: Package..."
aapt package -f -M "$APK_DIR/AndroidManifest.xml" -S "$APK_DIR/res" -A "$APK_DIR/assets" -I "$ANDROID_HOME/platforms/android-34/android.jar" -F "$APK_DIR/kinza-snake-unsigned.apk"
cd "$APK_DIR" && aapt add -f "$APK_DIR/kinza-snake-unsigned.apk" "$APK_DIR/dex/classes.dex"

echo "Step 5: Keystore..."
keytool -genkeypair -v -keystore "$APK_DIR/debug.keystore" -storepass android -alias androiddebugkey -keypass android -keyalg RSA -keysize 2048 -validity 10000 -dname "CN=Debug,O=Debug,C=US" 2>/dev/null

echo "Step 6: Sign..."
jarsigner -sigalg SHA1withRSA -digestalg SHA1 -keystore "$APK_DIR/debug.keystore" -storepass android -keypass android "$APK_DIR/kinza-snake-unsigned.apk" androiddebugkey

echo "Step 7: Zipalign..."
zipalign -f 4 "$APK_DIR/kinza-snake-unsigned.apk" "$APK_DIR/kinza-snake.apk"

cp "$APK_DIR/kinza-snake.apk" "kinza-snake.apk"
ls -lh "kinza-snake.apk"
echo "✅ APK BUILT SUCCESSFULLY!"
