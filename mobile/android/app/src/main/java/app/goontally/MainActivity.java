package app.goontally;

import android.os.Bundle;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // The app's own plugins are registered before the bridge starts.
        registerPlugin(PrivacyPlugin.class);
        super.onCreate(savedInstanceState);

        // The WebView draws its own scroll bars on top of the page, over the
        // top bar and the bottom nav. Android apps scroll by touch without
        // them, so they're off; CSS hides the ones inside the page.
        WebView webView = getBridge().getWebView();
        webView.setVerticalScrollBarEnabled(false);
        webView.setHorizontalScrollBarEnabled(false);
    }
}
