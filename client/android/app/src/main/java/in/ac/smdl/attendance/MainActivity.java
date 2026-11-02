package in.ac.smdl.attendance;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;
import com.google.firebase.FirebaseApp;
import com.google.firebase.FirebaseOptions;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Ensure Firebase is properly initialized before any push notification call
        try {
            if (FirebaseApp.getApps(this).isEmpty()) {
                FirebaseApp app = FirebaseApp.initializeApp(this);
                if (app == null || FirebaseApp.getApps(this).isEmpty()) {
                    FirebaseOptions options = new FirebaseOptions.Builder()
                        .setApplicationId("1:1055325335219:android:8c5871c30ab73d58ce8ac6")
                        .setApiKey("AIzaSyDbMxOhQ2HXf18ZYDfQb8594PT9SOC7qj4")
                        .setProjectId("gaurav-f685e")
                        .setGcmSenderId("1055325335219")
                        .setStorageBucket("gaurav-f685e.firebasestorage.app")
                        .build();
                    FirebaseApp.initializeApp(this, options);
                }
            }
        } catch (Exception e) {
            try {
                FirebaseOptions options = new FirebaseOptions.Builder()
                    .setApplicationId("1:1055325335219:android:8c5871c30ab73d58ce8ac6")
                    .setApiKey("AIzaSyDbMxOhQ2HXf18ZYDfQb8594PT9SOC7qj4")
                    .setProjectId("gaurav-f685e")
                    .setGcmSenderId("1055325335219")
                    .setStorageBucket("gaurav-f685e.firebasestorage.app")
                    .build();
                FirebaseApp.initializeApp(this, options);
            } catch (Exception ex) {
                ex.printStackTrace();
            }
        }
    }
}
