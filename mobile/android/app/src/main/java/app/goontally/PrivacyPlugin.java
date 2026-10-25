package app.goontally;

import android.os.Build;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

// Hides the app's content in the recent apps screen, without blocking
// screenshots the way FLAG_SECURE would. Android 13 (API 33) added the call
// for that; older versions report it as unsupported.
@CapacitorPlugin(name = "Privacy")
public class PrivacyPlugin extends Plugin {

    @PluginMethod
    public void setHideInRecents(PluginCall call) {
        boolean hide = Boolean.TRUE.equals(call.getBoolean("hide", false));
        JSObject result = new JSObject();
        if (Build.VERSION.SDK_INT < 33) {
            result.put("supported", false);
            call.resolve(result);
            return;
        }
        getActivity().runOnUiThread(() -> {
            getActivity().setRecentsScreenshotEnabled(!hide);
            result.put("supported", true);
            call.resolve(result);
        });
    }

    @PluginMethod
    public void isHideInRecentsSupported(PluginCall call) {
        JSObject result = new JSObject();
        result.put("supported", Build.VERSION.SDK_INT >= 33);
        call.resolve(result);
    }
}
